"""
OMR Service - Wrapper for OMRChecker core functionality

This service provides an interface between the web API and the core OMRChecker modules.
"""

import os
import sys
import json
import shutil
import tempfile
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, List

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.entry import entry_point, process_dir
from src.template import Template
from src.defaults.config import CONFIG_DEFAULTS
from src.utils.parsing import open_config_with_defaults


class OMRService:
    """Service class for OMR processing operations"""
    
    def __init__(self, upload_folder: Path, results_folder: Path):
        self.upload_folder = Path(upload_folder)
        self.results_folder = Path(results_folder)
        self.samples_folder = Path(__file__).parent.parent.parent / 'samples'
        
    def process_session(self, session_id: str, template_id: Optional[str] = None) -> Dict[str, Any]:
        """Process all images in a session folder"""
        session_folder = self.upload_folder / session_id
        output_folder = self.results_folder / session_id
        
        if not session_folder.exists():
            raise FileNotFoundError(f"Session {session_id} not found")
        
        output_folder.mkdir(parents=True, exist_ok=True)
        
        # Copy template if specified
        template_path = None
        if template_id:
            template_path = self._get_template_path(template_id)
            if template_path:
                shutil.copy(template_path, session_folder / 'template.json')
                # Copy marker if exists
                marker_path = template_path.parent / 'omr_marker.jpg'
                if marker_path.exists():
                    shutil.copy(marker_path, session_folder / 'omr_marker.jpg')
        
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
        """Get path to CSV results file"""
        result_folder = self.results_folder / session_id
        
        # Find CSV file
        csv_files = list(result_folder.glob('*.csv'))
        if not csv_files:
            # Look in subdirectories
            csv_files = list(result_folder.glob('**/*.csv'))
        
        if not csv_files:
            raise FileNotFoundError(f"No CSV results found for session {session_id}")
        
        return csv_files[0]
    
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
        
        with open(template_path, 'w', encoding='utf-8') as f:
            json.dump(template_data, f, indent=2)
        
        return {
            'success': True,
            'id': name,
            'path': str(template_path)
        }
    
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
    
    def _collect_results(self, session_id: str, output_folder: Path) -> Dict[str, Any]:
        """Collect processing results from output folder"""
        results = {
            'files': [],
            'summary': {},
            'csv_available': False
        }
        
        # Find CSV files
        csv_files = list(output_folder.glob('**/*.csv'))
        if csv_files:
            results['csv_available'] = True
            results['csv_path'] = f'/api/results/{session_id}/csv'
            
            # Parse CSV for summary
            try:
                import pandas as pd
                df = pd.read_csv(csv_files[0])
                results['summary']['total_sheets'] = len(df)
                results['summary']['columns'] = list(df.columns)
                
                # Convert to list of dicts
                results['data'] = df.to_dict('records')
            except Exception:
                pass
        
        # Find processed images
        for img_path in output_folder.glob('**/*.jpg'):
            results['files'].append({
                'name': img_path.name,
                'url': f'/api/results/{session_id}/image/{img_path.name}'
            })
        
        for img_path in output_folder.glob('**/*.png'):
            results['files'].append({
                'name': img_path.name,
                'url': f'/api/results/{session_id}/image/{img_path.name}'
            })
        
        return results
