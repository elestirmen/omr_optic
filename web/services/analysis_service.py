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
        min_common_wrong: int = 3
    ) -> Dict[str, Any]:
        """Detect potential cheating by comparing answer patterns"""
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

            # Gösterim için: öğrenci no + ad birleştir
            display_id = student_id
            if student_name:
                display_id = f"{student_id} ({student_name})"

            students.append({
                "file_name": file_name,
                "student_id": display_id,
                "answers": answers
            })

        # Compare all pairs
        cheating_pairs = []
        total_pairs = len(students) * (len(students) - 1) // 2

        for s1, s2 in combinations(students, 2):
            sim_ratio = self._similarity_ratio(s1["answers"], s2["answers"])
            pearson = self._pearson_similarity(s1["answers"], s2["answers"])
            common_wrong = self._count_common_wrong_answers(s1["answers"], s2["answers"])

            # Check thresholds
            is_suspicious = (
                sim_ratio >= similarity_threshold and
                pearson >= pearson_threshold
            ) or common_wrong >= min_common_wrong

            if is_suspicious:
                details = []
                if sim_ratio >= similarity_threshold:
                    details.append(f"Yüksek benzerlik: %{sim_ratio*100:.1f}")
                if pearson >= pearson_threshold:
                    details.append(f"Pearson: {pearson:.3f}")
                if common_wrong >= min_common_wrong:
                    details.append(f"Ortak yanlış: {common_wrong}")

                cheating_pairs.append(CheatingPair(
                    student1_id=s1["student_id"],
                    student1_file=s1["file_name"],
                    student2_id=s2["student_id"],
                    student2_file=s2["file_name"],
                    similarity_ratio=round(sim_ratio, 4),
                    pearson_correlation=round(pearson, 4),
                    common_wrong_answers=common_wrong,
                    details=" | ".join(details)
                ))

        # Sort by similarity descending
        cheating_pairs.sort(key=lambda x: (-x.similarity_ratio, -x.pearson_correlation))

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
            "results": [asdict(p) for p in cheating_pairs]
        }

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

    def _similarity_ratio(self, answers1: List[str], answers2: List[str]) -> float:
        """Calculate similarity ratio between two answer sets"""
        if not answers1 or not answers2:
            return 0.0

        total = max(len(answers1), len(answers2))
        similar = sum(
            1 for a1, a2 in zip(answers1, answers2)
            if a1 == a2 and a1 != ""
        )
        return similar / total if total > 0 else 0.0

    def _pearson_similarity(self, answers1: List[str], answers2: List[str]) -> float:
        """Calculate Pearson correlation between answer patterns"""
        if HAS_SCIPY:
            # Convert to numeric (1 for same answer, 0 for different)
            numeric1 = []
            numeric2 = []
            for a1, a2 in zip(answers1, answers2):
                if a1 and a2:  # Both answered
                    numeric1.append(ord(a1[0]) if a1 else 0)
                    numeric2.append(ord(a2[0]) if a2 else 0)

            if len(numeric1) < 2:
                return 0.0

            try:
                corr, _ = pearsonr(numeric1, numeric2)
                return corr if not (corr != corr) else 0.0  # Handle NaN
            except Exception:
                return 0.0
        else:
            return self._simple_correlation(answers1, answers2)

    def _simple_correlation(self, answers1: List[str], answers2: List[str]) -> float:
        """Simple correlation fallback when scipy is not available"""
        if not answers1 or not answers2:
            return 0.0

        matches = sum(1 for a1, a2 in zip(answers1, answers2) if a1 == a2 and a1)
        total = min(len(answers1), len(answers2))
        return matches / total if total > 0 else 0.0

    def _count_common_wrong_answers(self, answers1: List[str], answers2: List[str]) -> int:
        """Count common wrong answers (same non-empty wrong answers)"""
        common = 0
        for a1, a2 in zip(answers1, answers2):
            if a1 and a2 and a1 == a2:
                common += 1
        return common

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
