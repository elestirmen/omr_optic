import re
from copy import deepcopy
from fractions import Fraction

from deepmerge import Merger
from dotmap import DotMap

from src.constants.common import FIELD_LABEL_NUMBER_REGEX
from src.defaults import CONFIG_DEFAULTS, TEMPLATE_DEFAULTS
from src.schemas.constants import FIELD_STRING_REGEX_GROUPS
from src.utils.file import load_json
from src.utils.validations import (
    validate_config_json,
    validate_evaluation_json,
    validate_template_json,
)

OVERRIDE_MERGER = Merger(
    # pass in a list of tuples,with the
    # strategies you are looking to apply
    # to each type.
    [
        # (list, ["prepend"]),
        (dict, ["merge"])
    ],
    # next, choose the fallback strategies,
    # applied to all other types:
    ["override"],
    # finally, choose the strategies in
    # the case where the types conflict:
    ["override"],
)


def get_concatenated_response(omr_response, template):
    # Multi-column/multi-row questions which need to be concatenated
    concatenated_response = {}
    for field_label, concatenate_keys in template.custom_labels.items():
        custom_label = "".join([omr_response[k] for k in concatenate_keys])
        concatenated_response[field_label] = custom_label

    for field_label in template.non_custom_labels:
        concatenated_response[field_label] = omr_response[field_label]

    return concatenated_response


def get_concatenated_response_grouped(omr_response, template):
    """
    omr_response'u gruplandırarak döndürür.
    ad1, ad2, ad3 gibi numaralı alanları "ad" olarak tek sütunda birleştirir.
    Test soruları (q1, q2, ...) birleştirilmez, ayrı kalır.
    """
    concatenated_response = {}
    
    # Birleştirilecek prefix'ler (ad, tc, ogrenci, tel, alan gibi)
    # "q" ile başlayanlar (sorular) birleştirilmez
    MERGE_PREFIXES = {"ad", "tc", "ogrenci", "tel", "alan"}
    
    # Önce custom_labels'ı işle
    for field_label, concatenate_keys in template.custom_labels.items():
        custom_label = "".join([omr_response[k] for k in concatenate_keys])
        concatenated_response[field_label] = custom_label
    
    # non_custom_labels için otomatik gruplama yap
    # Prefix'e göre grupla (ad1, ad2 -> ad grubu)
    grouped_labels = {}
    for field_label in template.non_custom_labels:
        # Sayısal son eki ayır (örn: "ad12" -> ("ad", "12"))
        match = re.match(r'^([a-zA-Z_]+)(\d+)$', field_label)
        if match:
            prefix = match.group(1)
            number = int(match.group(2))
            # Sadece belirlenen prefix'leri birleştir, diğerlerini ayrı bırak
            if prefix in MERGE_PREFIXES:
                if prefix not in grouped_labels:
                    grouped_labels[prefix] = []
                grouped_labels[prefix].append((number, field_label))
            else:
                # Sorular (q1, q2, ...) gibi alanları ayrı bırak
                concatenated_response[field_label] = omr_response[field_label]
        else:
            # Numaralı değilse direkt ekle
            concatenated_response[field_label] = omr_response[field_label]
    
    # Grupları birleştir
    for prefix, items in grouped_labels.items():
        # Numaraya göre sırala
        items.sort(key=lambda x: x[0])
        # Değerleri birleştir - boş değerleri boşluk karakterine çevir
        values = []
        for _, label in items:
            val = omr_response[label]
            # Boş string ise boşluk yap (isimler arası boşluk için)
            values.append(val if val else " ")
        combined_value = "".join(values)
        # Baştaki ve sondaki boşlukları temizle
        concatenated_response[prefix] = combined_value.strip()
    
    return concatenated_response


def get_grouped_output_columns(output_columns):
    """
    output_columns listesini gruplandırır.
    ad1, ad2, ad3 gibi numaralı sütunları "ad" olarak tek sütuna dönüştürür.
    Sırayı korur - ilk görülen prefix'in pozisyonunu kullanır.
    """
    grouped_columns = []
    seen_prefixes = set()
    
    for col in output_columns:
        # Sayısal son eki ayır (örn: "ad12" -> ("ad", "12"))
        match = re.match(r'^([a-zA-Z_]+)(\d+)$', col)
        if match:
            prefix = match.group(1)
            if prefix not in seen_prefixes:
                seen_prefixes.add(prefix)
                grouped_columns.append(prefix)
        else:
            # Numaralı değilse direkt ekle (eğer daha önce eklenmemişse)
            if col not in seen_prefixes:
                seen_prefixes.add(col)
                grouped_columns.append(col)
    
    return grouped_columns


def open_config_with_defaults(config_path):
    user_tuning_config = load_json(config_path)
    user_tuning_config = OVERRIDE_MERGER.merge(
        deepcopy(CONFIG_DEFAULTS), user_tuning_config
    )
    validate_config_json(user_tuning_config, config_path)
    # https://github.com/drgrib/dotmap/issues/74
    return DotMap(user_tuning_config, _dynamic=False)


def open_template_with_defaults(template_path):
    user_template = load_json(template_path)
    user_template = OVERRIDE_MERGER.merge(deepcopy(TEMPLATE_DEFAULTS), user_template)
    validate_template_json(user_template, template_path)
    return user_template


def open_evaluation_with_validation(evaluation_path):
    user_evaluation_config = load_json(evaluation_path)
    validate_evaluation_json(user_evaluation_config, evaluation_path)
    return user_evaluation_config


def parse_fields(key, fields):
    parsed_fields = []
    fields_set = set()
    for field_string in fields:
        fields_array = parse_field_string(field_string)
        current_set = set(fields_array)
        if not fields_set.isdisjoint(current_set):
            raise Exception(
                f"Given field string '{field_string}' has overlapping field(s) with other fields in '{key}': {fields}"
            )
        fields_set.update(current_set)
        parsed_fields.extend(fields_array)
    return parsed_fields


def parse_field_string(field_string):
    if "." in field_string:
        field_prefix, start, end = re.findall(FIELD_STRING_REGEX_GROUPS, field_string)[
            0
        ]
        start, end = int(start), int(end)
        if start >= end:
            raise Exception(
                f"Invalid range in fields string: '{field_string}', start: {start} is not less than end: {end}"
            )
        return [
            f"{field_prefix}{field_number}" for field_number in range(start, end + 1)
        ]
    else:
        return [field_string]


def custom_sort_output_columns(field_label):
    label_prefix, label_suffix = re.findall(FIELD_LABEL_NUMBER_REGEX, field_label)[0]
    return [label_prefix, int(label_suffix) if len(label_suffix) > 0 else 0]


def parse_float_or_fraction(result):
    if type(result) == str and "/" in result:
        result = float(Fraction(result))
    else:
        result = float(result)
    return result
