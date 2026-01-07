"""
OMR Service - Wrapper for OMRChecker core functionality

This service provides an interface between the web API and the core OMRChecker modules.
"""

import os
import sys
import json
import shutil
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.entry import entry_point, process_dir


class OMRService:
    """Service class for OMR processing operations"""
    
    def __init__(self, upload_folder: Path, results_folder: Path):
        self.upload_folder = Path(upload_folder)
        self.results_folder = Path(results_folder)
        self.samples_folder = Path(__file__).parent.parent.parent / 'samples'
        self.default_template_id = os.environ.get("OMR_WEB_DEFAULT_TEMPLATE", "kapadokya")
        
    def process_session(self, session_id: str, template_id: Optional[str] = None) -> Dict[str, Any]:
        """Process all images in a session folder"""
        session_folder = self.upload_folder / session_id
        output_folder = self.results_folder / session_id
        
        if not session_folder.exists():
            raise FileNotFoundError(f"Session {session_id} not found")
        
        output_folder.mkdir(parents=True, exist_ok=True)
        
        # Apply template (explicit or default)
        effective_template_id = template_id or self._get_default_template_id()
        if effective_template_id:
            template_path = self._get_template_path(effective_template_id)
            if not template_path:
                raise FileNotFoundError(f"Template '{effective_template_id}' not found")
            self._apply_template_to_session(template_path, session_folder)

        # Ensure we have a config tuned to the template's pageDimensions.
        self._ensure_session_config(session_folder)
        
        # Run OMRChecker
        args = {
            'debug': False,
            'output_dir': str(output_folder),
            'autoAlign': False,
            'setLayout': False,
        }
        
        try:
            entry_point(session_folder, args)
            
            # Collect results
            results = self._collect_results(session_id, output_folder)
            results['status'] = 'completed'
            results['session_id'] = session_id
            
            # Save results as JSON
            with open(output_folder / 'results.json', 'w', encoding='utf-8') as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
            
            return results
            
        except Exception as e:
            return {
                'status': 'error',
                'session_id': session_id,
                'error': str(e)
            }
    
    def process_single_file(self, file, template_path: Optional[str] = None) -> Dict[str, Any]:
        """Process a single uploaded file"""
        import uuid
        from werkzeug.utils import secure_filename
        
        session_id = str(uuid.uuid4())
        session_folder = self.upload_folder / session_id
        session_folder.mkdir(parents=True, exist_ok=True)
        
        # Save uploaded file
        filename = secure_filename(file.filename)
        filepath = session_folder / filename
        file.save(str(filepath))
        
        # Process
        result = self.process_session(session_id, template_path)
        result['filename'] = filename
        
        return result
    
    def get_results(self, session_id: str) -> Dict[str, Any]:
        """Get results for a session"""
        results_path = self.results_folder / session_id / 'results.json'
        
        if not results_path.exists():
            raise FileNotFoundError(f"Results for session {session_id} not found")
        
        with open(results_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def get_csv_path(self, session_id: str) -> Path:
        """Get path to the primary CSV results file (prefers Results/*.csv)."""
        result_folder = self.results_folder / session_id
        csv_map = self._find_csv_files(result_folder)

        # Prefer Results if it has any data rows, else fallback to errors/multimarked.
        primary_kind = self._choose_primary_csv_kind(csv_map)
        if primary_kind is None:
            raise FileNotFoundError(f"No CSV results found for session {session_id}")
        return csv_map[primary_kind]

    def get_csv_path_by_kind(self, session_id: str, kind: str) -> Path:
        """Get path to a specific CSV kind: results | errors | multimarked."""
        kind = (kind or "").strip().lower()
        result_folder = self.results_folder / session_id
        csv_map = self._find_csv_files(result_folder)
        if kind not in csv_map:
            raise FileNotFoundError(f"No CSV kind '{kind}' found for session {session_id}")
        return csv_map[kind]
    
    def list_templates(self) -> List[Dict[str, Any]]:
        """List available templates"""
        templates = []
        
        if not self.samples_folder.exists():
            return templates
        
        for item in self.samples_folder.iterdir():
            if item.is_dir():
                template_file = item / 'template.json'
                if template_file.exists():
                    try:
                        with open(template_file, 'r', encoding='utf-8') as f:
                            template_data = json.load(f)
                        
                        templates.append({
                            'id': item.name,
                            'name': item.name,
                            'path': str(template_file),
                            'pageDimensions': template_data.get('pageDimensions', []),
                            'fieldBlocks': list(template_data.get('fieldBlocks', {}).keys()),
                            'hasMarker': (item / 'omr_marker.jpg').exists()
                        })
                    except Exception:
                        pass
        
        return templates
    
    def get_template(self, template_id: str) -> Dict[str, Any]:
        """Get template details"""
        template_path = self._get_template_path(template_id)
        
        if not template_path or not template_path.exists():
            raise FileNotFoundError(f"Template {template_id} not found")
        
        with open(template_path, 'r', encoding='utf-8') as f:
            template_data = json.load(f)
        
        template_data['id'] = template_id
        template_data['path'] = str(template_path)
        
        return template_data
    
    def create_template(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new template"""
        name = data.get('name', f'template_{datetime.now().strftime("%Y%m%d_%H%M%S")}')
        template_folder = self.samples_folder / name
        template_folder.mkdir(parents=True, exist_ok=True)
        
        template_path = template_folder / 'template.json'
        
        # Remove non-template fields
        template_data = {k: v for k, v in data.items() if k != 'name'}
        template_data = self._normalize_template_payload(template_data)
        
        with open(template_path, 'w', encoding='utf-8') as f:
            json.dump(template_data, f, ensure_ascii=False, indent=2)

        # Create/refresh a matching config.json so web-created templates work out of the box.
        try:
            config_path = template_folder / "config.json"
            config = self._generate_config_for_template(template_data)
            with open(config_path, "w", encoding="utf-8") as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
        except Exception:
            # Non-fatal: template can still be used with defaults.
            pass
        
        return {
            'success': True,
            'id': name,
            'path': str(template_path)
        }

    def update_template(self, template_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing template in samples/<template_id>/template.json."""
        template_folder = self.samples_folder / template_id
        template_path = template_folder / "template.json"
        if not template_path.exists():
            raise FileNotFoundError(f"Template {template_id} not found")

        # Remove UI/meta fields and normalize to a valid template payload.
        template_data = {
            k: v for k, v in (data or {}).items() if k not in {"name", "id", "path"}
        }
        template_data = self._normalize_template_payload(template_data)

        with open(template_path, "w", encoding="utf-8") as f:
            json.dump(template_data, f, ensure_ascii=False, indent=2)

        # Keep config.json in sync (best effort).
        try:
            config_path = template_folder / "config.json"
            config = self._generate_config_for_template(template_data)
            with open(config_path, "w", encoding="utf-8") as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

        return {"success": True, "id": template_id, "path": str(template_path)}
    
    def _get_template_path(self, template_id: str) -> Optional[Path]:
        """Get template file path from ID"""
        # Check samples folder
        template_path = self.samples_folder / template_id / 'template.json'
        if template_path.exists():
            return template_path
        
        # Check if it's a direct path
        if Path(template_id).exists():
            return Path(template_id)
        
        return None

    def _get_default_template_id(self) -> Optional[str]:
        """Return a default template id if present in samples (or None)."""
        default_id = (self.default_template_id or "").strip()
        if not default_id:
            return None
        if (self.samples_folder / default_id / "template.json").exists():
            return default_id
        return None

    @staticmethod
    def _normalize_template_payload(template_data: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure required keys exist so templates created/edited via web remain valid."""
        template_data = dict(template_data or {})
        template_data.setdefault("preProcessors", [])
        template_data.setdefault("customLabels", {})
        template_data.setdefault("outputColumns", [])
        if "fieldBlocks" not in template_data:
            template_data["fieldBlocks"] = {}
        return template_data

    def _apply_template_to_session(self, template_path: Path, session_folder: Path) -> None:
        """Copy template + required companion files into the session folder."""
        template_path = Path(template_path)
        template_dir = template_path.parent

        # Always copy template.json
        shutil.copy(template_path, session_folder / "template.json")

        # Copy config/evaluation if present next to template.
        for companion in ("config.json", "evaluation.json"):
            src = template_dir / companion
            if src.exists():
                shutil.copy(src, session_folder / companion)

        # Copy any files referenced by preprocessors/evaluation.
        try:
            with open(template_path, "r", encoding="utf-8") as f:
                template_data = json.load(f)
        except Exception:
            template_data = {}

        self._copy_preprocessor_assets(template_dir, session_folder, template_data)
        self._copy_evaluation_assets(template_dir, session_folder)

    def _copy_preprocessor_assets(
        self, template_dir: Path, session_folder: Path, template_data: Dict[str, Any]
    ) -> None:
        preprocessors = template_data.get("preProcessors") or []
        for proc in preprocessors:
            name = (proc or {}).get("name")
            options = (proc or {}).get("options") or {}
            if name == "CropOnMarkers":
                rel = options.get("relativePath", "omr_marker.jpg")
                self._copy_relative_file(template_dir, session_folder, rel)
            elif name == "FeatureBasedAlignment":
                rel = options.get("reference")
                if rel:
                    self._copy_relative_file(template_dir, session_folder, rel)

    def _copy_evaluation_assets(self, template_dir: Path, session_folder: Path) -> None:
        eval_path = template_dir / "evaluation.json"
        if not eval_path.exists():
            return
        try:
            with open(eval_path, "r", encoding="utf-8") as f:
                eval_data = json.load(f)
        except Exception:
            return

        options = eval_data.get("options") or {}
        for rel_key in ("answer_key_csv_path", "answer_key_image_path"):
            rel = options.get(rel_key)
            if rel:
                self._copy_relative_file(template_dir, session_folder, rel)

    @staticmethod
    def _copy_relative_file(template_dir: Path, session_folder: Path, rel_path: str) -> None:
        try:
            rel_path = str(rel_path)
        except Exception:
            return
        src = template_dir / rel_path
        if not src.exists() or not src.is_file():
            return
        dst = session_folder / rel_path
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(src, dst)

    def _ensure_session_config(self, session_folder: Path) -> None:
        """Ensure session has config.json (generate from template pageDimensions if needed)."""
        session_folder = Path(session_folder)
        config_path = session_folder / "config.json"
        if config_path.exists():
            return

        template_path = session_folder / "template.json"
        template_data = {}
        if template_path.exists():
            try:
                with open(template_path, "r", encoding="utf-8") as f:
                    template_data = json.load(f)
            except Exception:
                template_data = {}

        config = self._generate_config_for_template(template_data)
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config, f, ensure_ascii=False, indent=2)

    @staticmethod
    def _generate_config_for_template(template_data: Dict[str, Any]) -> Dict[str, Any]:
        page_w, page_h = 666, 820
        dims = template_data.get("pageDimensions") or []
        if isinstance(dims, (list, tuple)) and len(dims) == 2:
            try:
                page_w, page_h = int(dims[0]), int(dims[1])
            except Exception:
                pass

        # Minimal config (merged with defaults by open_config_with_defaults)
        return {
            "dimensions": {
                "processing_width": page_w,
                "processing_height": page_h,
            },
            "outputs": {
                "show_image_level": 0,
                # Keep at least one marked image for the web UI preview grid.
                "save_image_level": 1,
            },
        }
    
    def _collect_results(self, session_id: str, output_folder: Path) -> Dict[str, Any]:
        """Collect processing results from output folder"""
        results = {
            'files': [],
            'summary': {},
            'csv_available': False
        }
        
        csv_map = self._find_csv_files(output_folder)
        primary_kind = self._choose_primary_csv_kind(csv_map)

        # Parse CSVs (strings only; avoid NaN/NA conversion for UI)
        dfs: Dict[str, Any] = {}
        try:
            import pandas as pd

            def read_df(p: Path):
                return pd.read_csv(p, dtype=str, na_filter=False)

            for kind, path in csv_map.items():
                dfs[kind] = read_df(path)
        except Exception:
            dfs = {}

        results_count = len(dfs.get("results", [])) if "results" in dfs else 0
        errors_count = len(dfs.get("errors", [])) if "errors" in dfs else 0
        multimarked_count = len(dfs.get("multimarked", [])) if "multimarked" in dfs else 0

        results["summary"]["total_sheets"] = results_count
        results["summary"]["total_errors"] = errors_count
        results["summary"]["total_multimarked"] = multimarked_count

        if primary_kind and primary_kind in csv_map:
            results["csv_available"] = True
            results["summary"]["active_kind"] = primary_kind
            results["csv_path"] = f"/api/results/{session_id}/csv?kind={primary_kind}"
            results["csv_paths"] = {
                kind: f"/api/results/{session_id}/csv?kind={kind}"
                for kind in csv_map.keys()
            }

            if primary_kind in dfs:
                df = dfs[primary_kind]
                results["summary"]["columns"] = list(df.columns)
                results["data"] = df.to_dict("records")
            else:
                results["summary"]["columns"] = []
                results["data"] = []
        else:
            results["summary"]["active_kind"] = None
            results["summary"]["columns"] = []

        # Find processed images (return relative paths so nested dirs work)
        image_exts = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}
        for img_path in output_folder.rglob("*"):
            if not img_path.is_file():
                continue
            if img_path.suffix.lower() not in image_exts:
                continue
            if "stack" in {p.lower() for p in img_path.parts}:
                continue
            rel = img_path.relative_to(output_folder).as_posix()
            results["files"].append(
                {
                    "name": rel,
                    "url": f"/api/results/{session_id}/image/{rel}",
                }
            )
        
        return results

    @staticmethod
    def _find_csv_files(result_folder: Path) -> Dict[str, Path]:
        """Return known CSV outputs by kind."""
        result_folder = Path(result_folder)
        csv_map: Dict[str, Path] = {}

        # Results (can be multiple, pick newest)
        results_dir = result_folder / "Results"
        if results_dir.exists():
            candidates = list(results_dir.glob("Results_*.csv"))
            if candidates:
                csv_map["results"] = max(candidates, key=lambda p: p.stat().st_mtime)

        # Manual
        manual_dir = result_folder / "Manual"
        errors_csv = manual_dir / "ErrorFiles.csv"
        if errors_csv.exists():
            csv_map["errors"] = errors_csv
        mm_csv = manual_dir / "MultiMarkedFiles.csv"
        if mm_csv.exists():
            csv_map["multimarked"] = mm_csv

        # Fallback: any CSV
        if not csv_map:
            any_csv = list(result_folder.rglob("*.csv"))
            if any_csv:
                csv_map["results"] = max(any_csv, key=lambda p: p.stat().st_mtime)

        return csv_map

    @staticmethod
    def _choose_primary_csv_kind(csv_map: Dict[str, Path]) -> Optional[str]:
        """Prefer the first non-empty CSV in the order: results, errors, multimarked."""
        if not csv_map:
            return None

        try:
            import pandas as pd

            def has_rows(p: Path) -> bool:
                df = pd.read_csv(p, dtype=str, na_filter=False)
                return len(df) > 0

            if "results" in csv_map and has_rows(csv_map["results"]):
                return "results"
            if "errors" in csv_map and has_rows(csv_map["errors"]):
                return "errors"
            if "multimarked" in csv_map and has_rows(csv_map["multimarked"]):
                return "multimarked"
        except Exception:
            pass

        # Fallback priority even if empty
        for kind in ("results", "errors", "multimarked"):
            if kind in csv_map:
                return kind
        return next(iter(csv_map.keys()), None)
