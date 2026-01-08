"""
OMRChecker Web Interface

Flask-based web application for OMR processing with scanner support.
Author: Gemini Assistant
"""

import os
import sys
import uuid
import shutil
import io
import json
from pathlib import Path
from datetime import datetime

# Add parent directory to path to import src modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from werkzeug.utils import secure_filename

from services.omr_service import OMRService
from services.scanner_service import ScannerService

# Configuration
UPLOAD_FOLDER = Path(__file__).parent / 'uploads'
RESULTS_FOLDER = Path(__file__).parent / 'results'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'tif'}

# Create folders if not exist
UPLOAD_FOLDER.mkdir(exist_ok=True)
RESULTS_FOLDER.mkdir(exist_ok=True)

# Initialize Flask app
app = Flask(__name__, static_folder='static', static_url_path='')
app.config['SECRET_KEY'] = 'omrchecker-secret-key-2024'
app.config['UPLOAD_FOLDER'] = str(UPLOAD_FOLDER)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max

CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Initialize services
omr_service = OMRService(UPLOAD_FOLDER, RESULTS_FOLDER)
scanner_service = ScannerService(UPLOAD_FOLDER, socketio, omr_service=omr_service)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# ==================== Static Routes ====================

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('static', filename)


# ==================== API Routes ====================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0'
    })


@app.route('/api/upload', methods=['POST'])
def upload_files():
    """Upload OMR images for processing"""
    files = request.files.getlist('files')
    if not files:
        single = request.files.get('file')
        files = [single] if single else []

    if not files:
        return jsonify({'error': 'No files provided'}), 400

    provided_session_id = request.form.get('session_id')
    if provided_session_id:
        try:
            session_id = str(uuid.UUID(provided_session_id))
        except ValueError:
            return jsonify({'error': 'Invalid session_id'}), 400
    else:
        session_id = str(uuid.uuid4())

    session_folder = UPLOAD_FOLDER / session_id
    session_folder.mkdir(exist_ok=True)
    
    uploaded_files = []

    def unique_filename(folder: Path, filename: str) -> str:
        base, ext = os.path.splitext(filename)
        candidate = filename
        counter = 1
        while (folder / candidate).exists():
            candidate = f"{base}_{counter}{ext}"
            counter += 1
        return candidate

    for file in files:
        if file and file.filename and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            if not filename:
                continue
            filename = unique_filename(session_folder, filename)
            filepath = session_folder / filename
            file.save(str(filepath))
            uploaded_files.append(filename)
    
    if not uploaded_files:
        return jsonify({'error': 'No valid image files uploaded'}), 400
    
    return jsonify({
        'success': True,
        'session_id': session_id,
        'files': uploaded_files,
        'count': len(uploaded_files)
    })


@app.route('/api/process', methods=['POST'])
def process_omr():
    """Process uploaded OMR images"""
    data = request.get_json()
    
    if not data or 'session_id' not in data:
        return jsonify({'error': 'session_id is required'}), 400
    
    session_id = data['session_id']
    template_id = data.get('template_id')
    
    try:
        result = omr_service.process_session(session_id, template_id)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/process/single', methods=['POST'])
def process_single():
    """Upload and process a single OMR image immediately"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    template_path = request.form.get('template_path')
    
    if not file or not file.filename or not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file'}), 400
    
    try:
        result = omr_service.process_single_file(file, template_path)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/results/<session_id>', methods=['GET'])
def get_results(session_id):
    """Get processing results for a session"""
    try:
        result = omr_service.get_results(session_id)
        return jsonify(result)
    except FileNotFoundError:
        return jsonify({'error': 'Session not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/results/<session_id>/csv', methods=['GET'])
def download_csv(session_id):
    """Download results as CSV"""
    try:
        kind = request.args.get("kind")
        df = omr_service.read_results_dataframe(session_id, kind)
        csv_text = df.to_csv(index=False)
        buf = io.BytesIO(csv_text.encode("utf-8-sig"))
        return send_file(
            buf,
            mimetype="text/csv; charset=utf-8",
            as_attachment=True,
            download_name=f"results_{session_id}.csv",
        )
    except FileNotFoundError:
        return jsonify({'error': 'Results not found'}), 404


@app.route('/api/results/<session_id>/excel', methods=['GET'])
def download_excel(session_id):
    """Download results as Excel (XLSX)."""
    try:
        kind = request.args.get("kind")
        df = omr_service.read_results_dataframe(session_id, kind)

        try:
            import openpyxl  # noqa: F401
        except Exception:
            return jsonify({'error': 'Excel export requires openpyxl. Install web/requirements.txt.'}), 500

        buf = io.BytesIO()
        df.to_excel(buf, index=False, engine="openpyxl")
        buf.seek(0)
        return send_file(
            buf,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name=f"results_{session_id}.xlsx",
        )
    except FileNotFoundError:
        return jsonify({'error': 'Results not found'}), 404


@app.route('/api/results/<session_id>/image/<path:filename>', methods=['GET'])
def get_result_image(session_id, filename):
    """Get processed image with markings"""
    result_folder = RESULTS_FOLDER / session_id
    return send_from_directory(str(result_folder), filename)


@app.route('/api/uploads/<session_id>/file/<path:filename>', methods=['GET'])
def get_upload_file(session_id, filename):
    """Get a raw uploaded/scanned file (for previews)."""
    session_folder = UPLOAD_FOLDER / session_id
    return send_from_directory(str(session_folder), filename)


# ==================== Template Routes ====================

@app.route('/api/templates', methods=['GET'])
def list_templates():
    """List available templates from samples folder"""
    try:
        templates = omr_service.list_templates()
        return jsonify({'templates': templates})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/templates/<template_id>', methods=['GET'])
def get_template(template_id):
    """Get template details"""
    try:
        template = omr_service.get_template(template_id)
        return jsonify(template)
    except FileNotFoundError:
        return jsonify({'error': 'Template not found'}), 404


@app.route('/api/templates/<template_id>/asset/<path:filename>', methods=['GET'])
def get_template_asset(template_id, filename):
    """Serve a file from samples/<template_id>/ (for previews like sample.jpg)."""
    template_dir = omr_service.samples_folder / template_id
    return send_from_directory(str(template_dir), filename)


@app.route('/api/templates', methods=['POST'])
def create_template():
    """Create a new template"""
    data = None
    image_file = None

    if request.is_json:
        data = request.get_json(silent=True)
    else:
        raw = request.form.get('template') or request.form.get('data')
        if raw:
            try:
                data = json.loads(raw)
            except Exception:
                return jsonify({'error': 'Invalid template JSON in form field'}), 400
        image_file = request.files.get('image')

    if not data:
        return jsonify({'error': 'Template data required'}), 400

    try:
        result = omr_service.create_template(data, image_file=image_file)
        return jsonify(result)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/templates/<template_id>', methods=['PUT'])
def update_template(template_id):
    """Update an existing template"""
    data = None
    image_file = None

    if request.is_json:
        data = request.get_json(silent=True)
    else:
        raw = request.form.get('template') or request.form.get('data')
        if raw:
            try:
                data = json.loads(raw)
            except Exception:
                return jsonify({'error': 'Invalid template JSON in form field'}), 400
        image_file = request.files.get('image')

    if not data:
        return jsonify({'error': 'Template data required'}), 400

    try:
        result = omr_service.update_template(template_id, data, image_file=image_file)
        return jsonify(result)
    except FileNotFoundError:
        return jsonify({'error': 'Template not found'}), 404
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== Scanner Routes ====================

@app.route('/api/scanner/devices', methods=['GET'])
def list_scanner_devices():
    """List available scanner devices"""
    try:
        devices = scanner_service.list_devices()
        return jsonify({'devices': devices})
    except Exception as e:
        return jsonify({'error': str(e), 'devices': []})


@app.route('/api/scanner/capabilities', methods=['POST'])
def scanner_capabilities():
    """Best-effort device capability detection (e.g., ADF)."""
    data = request.get_json() or {}
    device_id = data.get('device_id')

    try:
        return jsonify(scanner_service.get_capabilities(device_id))
    except Exception as e:
        return jsonify({'error': str(e), 'device_id': device_id}), 500


@app.route('/api/scanner/scan', methods=['POST'])
def start_scan():
    """Start scanning with optional ADF support"""
    data = request.get_json() or {}
    device_id = data.get('device_id')
    use_adf = data.get('use_adf', False)
    auto_process = data.get('auto_process', True)
    template_id = data.get('template_id')
    show_ui = data.get('show_ui', True)
    provided_session_id = data.get('session_id')
    append = bool(data.get('append', False))
    
    try:
        if provided_session_id:
            session_id = str(uuid.UUID(str(provided_session_id)))
        else:
            session_id = str(uuid.uuid4())
        result = scanner_service.scan(
            session_id=session_id,
            device_id=device_id,
            use_adf=use_adf,
            auto_process=auto_process,
            template_id=template_id,
            show_ui=show_ui,
            append=append,
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/scanner/status', methods=['GET'])
def scanner_status():
    """Get current scanner status"""
    return jsonify(scanner_service.get_status())


@app.route('/api/scanner/cancel', methods=['POST'])
def cancel_scan():
    """Cancel current scan operation (best-effort)."""
    try:
        return jsonify(scanner_service.cancel_scan())
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== WebSocket Events ====================

@socketio.on('connect')
def handle_connect():
    emit('connected', {'status': 'Connected to OMRChecker'})


@socketio.on('subscribe_session')
def handle_subscribe(data):
    session_id = data.get('session_id')
    if session_id:
        emit('subscribed', {'session_id': session_id})


# ==================== Error Handlers ====================

@app.errorhandler(413)
def too_large(e):
    return jsonify({'error': 'File too large. Maximum size is 50MB.'}), 413


@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Resource not found'}), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Internal server error'}), 500


# ==================== Main ====================

if __name__ == '__main__':
    print("=" * 50)
    print("OMRChecker Web Interface")
    print("=" * 50)
    port = int(os.environ.get("OMR_WEB_PORT", "5000"))
    debug = os.environ.get("OMR_WEB_DEBUG", "0").lower() in {"1", "true", "yes", "on"}
    print(f"Server starting at http://localhost:{port}")
    print(f"Upload folder: {UPLOAD_FOLDER}")
    print(f"Results folder: {RESULTS_FOLDER}")
    print("=" * 50)
    
    # Disable auto-reloader by default (it can cause WinError 10048 with eventlet on Windows).
    socketio.run(app, host="0.0.0.0", port=port, debug=debug, use_reloader=False)
