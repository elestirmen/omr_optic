"""
Analysis Service for OMRChecker
Provides answer key management, scoring, and cheating detection
"""

import json
import re
from dataclasses import dataclass, asdict
from itertools import combinations
from pathlib import Path
from typing import Any, Dict, List, Optional

# Try to import scipy for Pearson correlation
try:
    from scipy.stats import pearsonr
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False


@dataclass
class StudentResult:
    """Student result with answers and scores"""
    file_name: str
    student_id: str
    student_name: str
    tc_kimlik: str
    answers: str
    correct_count: int = 0
    wrong_count: int = 0
    empty_count: int = 0
    score: float = 0.0


@dataclass
class CheatingPair:
    """A pair of students with suspicious similarity"""
    student1_id: str
    student1_file: str
    student2_id: str
    student2_file: str
    similarity_ratio: float
    pearson_correlation: float
    common_wrong_answers: int
    details: str = ""


class AnalysisService:
    """Service for answer key management and cheating detection"""

    def __init__(self, results_folder: Path):
        self.results_folder = Path(results_folder)
        self.answer_keys_folder = self.results_folder / "_answer_keys"
        self.answer_keys_folder.mkdir(parents=True, exist_ok=True)

    def save_answer_key(
        self,
        name: str,
        answers: Dict[str, str],
        question_count: int,
        correct_points: float = 1.0,
        wrong_points: float = 0.0,
        empty_points: float = 0.0
    ) -> Dict[str, Any]:
        """Save an answer key configuration"""
        answer_key_data = {
            "name": name,
            "question_count": question_count,
            "answers": answers,
            "scoring": {
                "correct_points": correct_points,
                "wrong_points": wrong_points,
                "empty_points": empty_points
            }
        }

        key_path = self.answer_keys_folder / f"{name}.json"
        with open(key_path, 'w', encoding='utf-8') as f:
            json.dump(answer_key_data, f, ensure_ascii=False, indent=2)

        return {"success": True, "name": name, "path": str(key_path)}

    def load_answer_key(self, name: str) -> Optional[Dict[str, Any]]:
        """Load an answer key by name"""
        key_path = self.answer_keys_folder / f"{name}.json"
        if not key_path.exists():
            return None

        with open(key_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def list_answer_keys(self) -> List[Dict[str, Any]]:
        """List all saved answer keys"""
        keys = []
        for key_file in self.answer_keys_folder.glob("*.json"):
            try:
                with open(key_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    keys.append({
                        "name": data.get("name", key_file.stem),
                        "question_count": data.get("question_count", 0),
                        "path": str(key_file)
                    })
            except Exception:
                pass
        return keys

    def delete_answer_key(self, name: str) -> bool:
        """Delete an answer key"""
        key_path = self.answer_keys_folder / f"{name}.json"
        if key_path.exists():
            key_path.unlink()
            return True
        return False

    def calculate_scores(
        self,
        session_id: str,
        answer_key: Dict[str, str],
        scoring: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """Calculate scores for a session based on answer key"""
        import pandas as pd

        # Default scoring
        if scoring is None:
            scoring = {"correct_points": 1.0, "wrong_points": 0.0, "empty_points": 0.0}

        correct_pts = scoring.get("correct_points", 1.0)
        wrong_pts = scoring.get("wrong_points", 0.0)
        empty_pts = scoring.get("empty_points", 0.0)

        # Load session results
        session_folder = self.results_folder / session_id
        results_dir = session_folder / "Results"

        csv_files = list(results_dir.glob("Results_*.csv")) if results_dir.exists() else []
        if not csv_files:
            raise FileNotFoundError(f"No results found for session {session_id}")

        csv_path = max(csv_files, key=lambda p: p.stat().st_mtime)
        df = pd.read_csv(csv_path, dtype=str, na_filter=False)

        # Find question columns (q1, q2, ... or Q1, Q2, ...)
        all_question_cols = self._find_question_columns(df.columns.tolist())
        if not all_question_cols:
            raise ValueError("No question columns found in results")

        # Sadece cevap anahtarındaki soruları al
        answer_key_nums = set()
        for k in answer_key.keys():
            try:
                answer_key_nums.add(int(k))
            except ValueError:
                match = re.search(r'\d+', k)
                if match:
                    answer_key_nums.add(int(match.group()))

        question_cols = []
        for q_col in all_question_cols:
            q_num = self._extract_question_number(q_col)
            if q_num in answer_key_nums:
                question_cols.append(q_col)

        if not question_cols:
            question_cols = all_question_cols

        # Find file/ID column and student info columns
        file_col = self._find_file_column(df.columns.tolist())
        student_cols = self._find_student_columns(df.columns.tolist())

        results = []
        for _, row in df.iterrows():
            file_name = row.get(file_col, "") if file_col else ""
            student_id = self._extract_student_id(file_name, row, student_cols)
            student_name = self._extract_student_name(row, student_cols)
            
            # TC Kimlik
            tc_kimlik = ""
            if student_cols.get("tc_kimlik"):
                tc_kimlik = str(row.get(student_cols["tc_kimlik"], "")).strip()
                if tc_kimlik in ("nan", "None"):
                    tc_kimlik = ""

            correct = 0
            wrong = 0
            empty = 0
            answers_str = ""

            for q_col in question_cols:
                # Extract question number from column name
                q_num = self._extract_question_number(q_col)
                student_answer = str(row.get(q_col, "")).strip().upper()
                correct_answer = str(answer_key.get(str(q_num), answer_key.get(q_col, ""))).strip().upper()

                if not student_answer or student_answer in ("", "*", "-", " "):
                    empty += 1
                    answers_str += "-"
                elif student_answer == correct_answer:
                    correct += 1
                    answers_str += student_answer
                else:
                    wrong += 1
                    answers_str += student_answer  # Tüm cevaplar büyük harf

            score = (correct * correct_pts) + (wrong * wrong_pts) + (empty * empty_pts)

            results.append(StudentResult(
                file_name=file_name,
                student_id=student_id,
                student_name=student_name,
                tc_kimlik=tc_kimlik,
                answers=answers_str,
                correct_count=correct,
                wrong_count=wrong,
                empty_count=empty,
                score=score
            ))

        # Sort by score descending
        results.sort(key=lambda x: (-x.score, x.student_id))

        return {
            "success": True,
            "session_id": session_id,
            "total_students": len(results),
            "total_questions": len(question_cols),
            "question_columns": question_cols,
            "scoring": scoring,
            "results": [asdict(r) for r in results],
            "statistics": self._calculate_statistics(results)
        }

    def detect_cheating(
        self,
        session_id: str,
        similarity_threshold: float = 0.85,
        pearson_threshold: float = 0.90,
        min_common_wrong: int = 5,
        answer_key: Dict[int, str] = None
    ) -> Dict[str, Any]:
        """Detect potential cheating by comparing answer patterns
        
        Uses multiple metrics:
        1. Common Wrong Answers: Same incorrect answer on same question (needs answer_key)
        2. Answer Pattern Similarity: Overall pattern match including blanks
        3. Rare Answer Match: Both giving uncommon answers
        4. Blank Pattern Match: Both leaving same questions blank
        """
        import pandas as pd

        # Load session results
        session_folder = self.results_folder / session_id
        results_dir = session_folder / "Results"

        csv_files = list(results_dir.glob("Results_*.csv")) if results_dir.exists() else []
        if not csv_files:
            raise FileNotFoundError(f"No results found for session {session_id}")

        csv_path = max(csv_files, key=lambda p: p.stat().st_mtime)
        df = pd.read_csv(csv_path, dtype=str, na_filter=False)

        # Find question columns
        question_cols = self._find_question_columns(df.columns.tolist())
        if not question_cols:
            raise ValueError("No question columns found in results")

        file_col = self._find_file_column(df.columns.tolist())
        student_cols = self._find_student_columns(df.columns.tolist())

        # Build student answer vectors
        students = []
        for _, row in df.iterrows():
            file_name = row.get(file_col, "") if file_col else ""
            student_id = self._extract_student_id(file_name, row, student_cols)
            student_name = self._extract_student_name(row, student_cols)

            answers = []
            for q_col in question_cols:
                ans = str(row.get(q_col, "")).strip().upper()
                if not ans or ans in ("", "*", "-", " "):
                    answers.append("")
                else:
                    answers.append(ans)

            display_id = student_id
            if student_name:
                display_id = f"{student_id} ({student_name})"

            students.append({
                "file_name": file_name,
                "student_id": display_id,
                "answers": answers
            })

        # Calculate answer frequencies for rare answer detection
        answer_freq = self._calculate_answer_frequencies(students, len(question_cols))

        # Compare all pairs
        cheating_pairs = []
        total_pairs = len(students) * (len(students) - 1) // 2

        for s1, s2 in combinations(students, 2):
            metrics = self._calculate_cheating_metrics(
                s1["answers"], s2["answers"], 
                answer_key, answer_freq, question_cols
            )

            # Weighted scoring for suspicion
            suspicion_score = self._calculate_suspicion_score(metrics, answer_key is not None)

            # Check if suspicious
            is_suspicious = (
                suspicion_score >= 0.7 or  # High overall suspicion
                (metrics["common_wrong"] >= min_common_wrong and answer_key) or  # Many common wrong answers
                (metrics["rare_match_ratio"] >= 0.5 and metrics["rare_matches"] >= 3) or  # Many rare answer matches
                (metrics["pattern_similarity"] >= similarity_threshold and 
                 metrics["blank_match_ratio"] >= 0.8)  # Very similar pattern with matching blanks
            )

            if is_suspicious:
                details = []
                if answer_key and metrics["common_wrong"] >= 2:
                    details.append(f"Ortak yanlış: {metrics['common_wrong']}")
                if metrics["rare_matches"] >= 2:
                    details.append(f"Nadir cevap eşleşmesi: {metrics['rare_matches']}")
                if metrics["pattern_similarity"] >= 0.8:
                    details.append(f"Desen benzerliği: %{metrics['pattern_similarity']*100:.0f}")
                if metrics["blank_match_ratio"] >= 0.7:
                    details.append(f"Boş eşleşme: %{metrics['blank_match_ratio']*100:.0f}")

                cheating_pairs.append(CheatingPair(
                    student1_id=s1["student_id"],
                    student1_file=s1["file_name"],
                    student2_id=s2["student_id"],
                    student2_file=s2["file_name"],
                    similarity_ratio=round(suspicion_score, 4),
                    pearson_correlation=round(metrics["pattern_similarity"], 4),
                    common_wrong_answers=metrics["common_wrong"] if answer_key else metrics["rare_matches"],
                    details=" | ".join(details) if details else "Şüpheli benzerlik"
                ))

        # Sort by suspicion score descending
        cheating_pairs.sort(key=lambda x: -x.similarity_ratio)

        return {
            "success": True,
            "session_id": session_id,
            "total_students": len(students),
            "total_pairs_checked": total_pairs,
            "suspicious_pairs": len(cheating_pairs),
            "thresholds": {
                "similarity": similarity_threshold,
                "pearson": pearson_threshold,
                "min_common_wrong": min_common_wrong
            },
            "has_answer_key": answer_key is not None,
            "results": [asdict(p) for p in cheating_pairs]
        }

    def _calculate_answer_frequencies(self, students: List[Dict], num_questions: int) -> List[Dict[str, float]]:
        """Calculate how frequently each answer is given for each question"""
        freq = [{} for _ in range(num_questions)]
        total = len(students)
        
        for student in students:
            for i, ans in enumerate(student["answers"]):
                if i < num_questions:
                    freq[i][ans] = freq[i].get(ans, 0) + 1
        
        # Convert to ratios
        for i in range(num_questions):
            for ans in freq[i]:
                freq[i][ans] /= total
        
        return freq

    def _calculate_cheating_metrics(
        self, 
        answers1: List[str], 
        answers2: List[str],
        answer_key: Dict[int, str],
        answer_freq: List[Dict[str, float]],
        question_cols: List[str]
    ) -> Dict[str, Any]:
        """Calculate multiple metrics for cheating detection"""
        n = min(len(answers1), len(answers2))
        
        common_wrong = 0
        rare_matches = 0
        pattern_matches = 0
        blank_matches = 0
        total_blanks = 0
        
        for i in range(n):
            a1, a2 = answers1[i], answers2[i]
            
            # Pattern similarity (including blanks)
            if a1 == a2:
                pattern_matches += 1
            
            # Blank matching
            if a1 == "" or a2 == "":
                total_blanks += 1
                if a1 == "" and a2 == "":
                    blank_matches += 1
            
            # Common wrong answers (both gave same WRONG answer)
            if answer_key and a1 and a2 and a1 == a2:
                q_num = i + 1
                correct = answer_key.get(q_num, answer_key.get(str(q_num), "")).upper()
                if correct and a1 != correct:
                    common_wrong += 1
            
            # Rare answer matching (both gave an uncommon answer)
            if a1 and a2 and a1 == a2 and i < len(answer_freq):
                freq = answer_freq[i].get(a1, 0)
                if freq < 0.15:  # Less than 15% of students gave this answer
                    rare_matches += 1
        
        return {
            "common_wrong": common_wrong,
            "rare_matches": rare_matches,
            "pattern_similarity": pattern_matches / n if n > 0 else 0,
            "blank_match_ratio": blank_matches / total_blanks if total_blanks > 0 else 1.0,
            "rare_match_ratio": rare_matches / n if n > 0 else 0
        }

    def _calculate_suspicion_score(self, metrics: Dict[str, Any], has_answer_key: bool) -> float:
        """Calculate weighted suspicion score from 0 to 1"""
        score = 0.0
        
        if has_answer_key:
            # With answer key: common wrong answers are most important
            score += min(metrics["common_wrong"] / 10, 0.4)  # Up to 40% from common wrong
            score += metrics["rare_match_ratio"] * 0.25  # Up to 25% from rare matches
            score += max(0, (metrics["pattern_similarity"] - 0.6)) * 0.5  # 0-20% from pattern
            score += max(0, (metrics["blank_match_ratio"] - 0.5)) * 0.3  # 0-15% from blank pattern
        else:
            # Without answer key: rely on rare answers and patterns
            score += metrics["rare_match_ratio"] * 0.45  # Up to 45% from rare matches
            score += max(0, (metrics["pattern_similarity"] - 0.7)) * 0.6  # 0-18% from pattern
            score += max(0, (metrics["blank_match_ratio"] - 0.5)) * 0.4  # 0-20% from blank pattern
            score += min(metrics["rare_matches"] / 8, 0.2)  # Up to 20% from absolute rare count
        
        return min(score, 1.0)

    def _find_question_columns(self, columns: List[str]) -> List[str]:
        """Find question columns (q1, q2, ... or Q1, Q2, ...)"""
        pattern = re.compile(r'^[qQ](\d+)$')
        q_cols = []
        for col in columns:
            if pattern.match(col):
                q_cols.append(col)

        # Sort by question number
        q_cols.sort(key=lambda x: int(re.search(r'\d+', x).group()))
        return q_cols

    def _find_file_column(self, columns: List[str]) -> Optional[str]:
        """Find the file/input column"""
        candidates = ["file_id", "file_name", "filename", "file", "input_path", "name"]
        for col in columns:
            if col.lower() in candidates:
                return col
        return columns[0] if columns else None

    def _find_student_columns(self, columns: List[str]) -> Dict[str, Optional[str]]:
        """Find student info columns (TC, Ogrenci No, Ad, etc.)"""
        result = {
            "tc_kimlik": None,
            "ogrenci_no": None,
            "ad": None,
            "telefon": None
        }
        
        columns_lower = {col.lower().replace("_", ""): col for col in columns}
        
        # TC Kimlik
        for key in ["tckimlik", "tc", "tckimlikno", "kimlik", "kimlikno"]:
            if key in columns_lower:
                result["tc_kimlik"] = columns_lower[key]
                break
        
        # Öğrenci No
        for key in ["ogrencino", "ogrenci", "studentid", "studentno", "no"]:
            if key in columns_lower:
                result["ogrenci_no"] = columns_lower[key]
                break
        
        # Ad
        for key in ["ad", "adsoyad", "name", "isim", "ogrenciadi"]:
            if key in columns_lower:
                result["ad"] = columns_lower[key]
                break
        
        # Telefon
        for key in ["telefon", "tel", "phone", "telefonno"]:
            if key in columns_lower:
                result["telefon"] = columns_lower[key]
                break
        
        return result

    def _extract_question_number(self, col_name: str) -> int:
        """Extract question number from column name"""
        match = re.search(r'\d+', col_name)
        return int(match.group()) if match else 0

    def _extract_student_id(self, file_name: str, row: Any, student_cols: Optional[Dict[str, Optional[str]]] = None) -> str:
        """Extract student ID from row data - prioritize Ogrenci_No, then TC_Kimlik"""
        
        # Önce CSV'deki öğrenci bilgisi sütunlarını kontrol et
        if student_cols:
            # Öğrenci numarası varsa onu kullan
            if student_cols.get("ogrenci_no"):
                val = str(row.get(student_cols["ogrenci_no"], "")).strip()
                if val and val not in ("", "nan", "None"):
                    return val
            
            # TC Kimlik varsa onu kullan
            if student_cols.get("tc_kimlik"):
                val = str(row.get(student_cols["tc_kimlik"], "")).strip()
                if val and val not in ("", "nan", "None"):
                    return val
        
        # row dict ise direkt anahtar ara
        if hasattr(row, 'get'):
            # Öğrenci No
            for key in ["Ogrenci_No", "ogrenci_no", "OgrenciNo", "student_id"]:
                val = str(row.get(key, "")).strip()
                if val and val not in ("", "nan", "None"):
                    return val
            
            # TC Kimlik
            for key in ["TC_Kimlik", "tc_kimlik", "TCKimlik", "tc"]:
                val = str(row.get(key, "")).strip()
                if val and val not in ("", "nan", "None"):
                    return val
        
        # Son çare: dosya adından çıkar
        if file_name:
            clean_name = Path(file_name).name
            name_part = Path(clean_name).stem
            
            numbers = re.findall(r'\d{8,}', name_part)
            if numbers:
                return numbers[0]
            
            numbers = re.findall(r'\d{6,}', name_part)
            if numbers:
                return numbers[0]
            
            return name_part

        return "unknown"
    
    def _extract_student_name(self, row: Any, student_cols: Optional[Dict[str, Optional[str]]] = None) -> str:
        """Extract student name from row data"""
        if student_cols and student_cols.get("ad"):
            val = str(row.get(student_cols["ad"], "")).strip()
            if val and val not in ("", "nan", "None"):
                return val
        
        if hasattr(row, 'get'):
            for key in ["ad", "Ad", "AD", "name", "Name", "adsoyad", "AdSoyad"]:
                val = str(row.get(key, "")).strip()
                if val and val not in ("", "nan", "None"):
                    return val
        
        return ""

    def _calculate_statistics(self, results: List[StudentResult]) -> Dict[str, Any]:
        """Calculate statistics for score results"""
        if not results:
            return {}

        scores = [r.score for r in results]
        return {
            "average_score": sum(scores) / len(scores),
            "max_score": max(scores),
            "min_score": min(scores),
            "total_correct": sum(r.correct_count for r in results),
            "total_wrong": sum(r.wrong_count for r in results),
            "total_empty": sum(r.empty_count for r in results)
        }
