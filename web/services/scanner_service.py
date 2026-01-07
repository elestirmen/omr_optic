"""
Scanner Service - Cross-platform scanner integration

Supports:
- Windows: TWAIN protocol
- Linux: SANE protocol

Provides ADF (Automatic Document Feeder) support for bulk scanning.
"""

import os
import sys
import uuid
import platform
import ctypes
from ctypes import wintypes
from contextlib import contextmanager
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, List, Union
from threading import Thread

# Detect platform
PLATFORM = platform.system()


class ScannerService:
    """Cross-platform scanner service with ADF support"""
    
    def __init__(self, upload_folder: Path, socketio=None, omr_service=None):
        self.upload_folder = Path(upload_folder)
        self.socketio = socketio
        self.omr_service = omr_service
        self.current_scan = None
        self.status = {
            'scanning': False,
            'device': None,
            'progress': 0,
            'pages_scanned': 0,
            'error': None,
            'session_id': None,
            'cancelled': False,
        }
        
        # Initialize platform-specific scanner
        self.scanner = None
        self._init_scanner()

    @staticmethod
    def _normalize_device_id(device_id: Optional[Union[str, int]]) -> Optional[Union[str, int]]:
        if device_id is None:
            return None
        if isinstance(device_id, int):
            return device_id
        if isinstance(device_id, str):
            value = device_id.strip()
            if value.isdigit():
                return int(value)
            return value
        return device_id

    @contextmanager
    def _twain_source_manager(self):
        import twain

        hwnd = 0
        if PLATFORM == "Windows":
            hwnd = self._create_hidden_window()

        sm = twain.SourceManager(hwnd)
        try:
            yield sm
        finally:
            try:
                sm.destroy()
            except Exception:
                pass
            if hwnd and PLATFORM == "Windows":
                self._destroy_hidden_window(hwnd)

    @staticmethod
    def _create_hidden_window() -> int:
        """Create a hidden Win32 window to receive TWAIN messages on this thread."""
        try:
            user32 = ctypes.windll.user32
            kernel32 = ctypes.windll.kernel32

            kernel32.GetModuleHandleW.argtypes = [wintypes.LPCWSTR]
            kernel32.GetModuleHandleW.restype = wintypes.HINSTANCE

            user32.CreateWindowExW.argtypes = [
                wintypes.DWORD,
                wintypes.LPCWSTR,
                wintypes.LPCWSTR,
                wintypes.DWORD,
                ctypes.c_int,
                ctypes.c_int,
                ctypes.c_int,
                ctypes.c_int,
                wintypes.HWND,
                wintypes.HMENU,
                wintypes.HINSTANCE,
                wintypes.LPVOID,
            ]
            user32.CreateWindowExW.restype = wintypes.HWND

            h_instance = kernel32.GetModuleHandleW(None)
            hwnd = user32.CreateWindowExW(
                0,
                "STATIC",
                "OMRChecker_TWAIN",
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                h_instance,
                None,
            )
            return int(hwnd) if hwnd else 0
        except Exception:
            return 0

    @staticmethod
    def _destroy_hidden_window(hwnd: int) -> None:
        try:
            user32 = ctypes.windll.user32
            user32.DestroyWindow.argtypes = [wintypes.HWND]
            user32.DestroyWindow.restype = wintypes.BOOL
            user32.DestroyWindow(wintypes.HWND(hwnd))
        except Exception:
            pass

    def _init_scanner(self):
        """Initialize platform-specific scanner support"""
        if PLATFORM == 'Windows':
            try:
                import twain
                # Validate DSM availability (TWAIN often has thread/window-handle constraints).
                sm = twain.SourceManager(0)
                sm.destroy()
                self.scanner = 'twain'
            except ImportError:
                print("Warning: pytwain not installed. Scanner support disabled.")
                print("Install with: pip install pytwain")
            except Exception as e:
                print(f"Warning: Could not initialize TWAIN: {e}")
        
        elif PLATFORM == 'Linux':
            try:
                import sane
                sane.init()
                self.scanner = 'sane'
            except ImportError:
                print("Warning: python-sane not installed. Scanner support disabled.")
                print("Install with: pip install python-sane")
            except Exception as e:
                print(f"Warning: Could not initialize SANE: {e}")
    
    def list_devices(self) -> List[Dict[str, Any]]:
        """List available scanner devices"""
        devices = []
        
        if self.scanner == 'twain':
            try:
                with self._twain_source_manager() as sm:
                    sources = sm.GetSourceList()
                for i, name in enumerate(sources):
                    devices.append({
                        'id': i,
                        'name': name,
                        'type': 'TWAIN',
                        'adf_capable': True  # Assume ADF support, will check when selected
                    })
            except Exception as e:
                print(f"Error listing TWAIN devices: {e}")
        
        elif self.scanner == 'sane':
            try:
                import sane
                sane_devices = sane.get_devices()
                for i, dev in enumerate(sane_devices):
                    devices.append({
                        'id': dev[0],
                        'name': f"{dev[1]} {dev[2]}",
                        'type': 'SANE',
                        'adf_capable': 'adf' in dev[0].lower() or 'feeder' in str(dev).lower()
                    })
            except Exception as e:
                print(f"Error listing SANE devices: {e}")
        
        # Add a simulated device for testing if no real devices
        if not devices:
            devices.append({
                'id': 'simulator',
                'name': 'Simulated Scanner (Test)',
                'type': 'Simulator',
                'adf_capable': True
            })
        
        return devices
    
    def scan(
        self,
        session_id: str,
        device_id: Optional[Union[str, int]] = None,
        use_adf: bool = False,
        auto_process: bool = True,
        template_id: Optional[str] = None,
        show_ui: bool = True,
    ) -> Dict[str, Any]:
        """Start scanning operation"""
        
        if self.status['scanning']:
            return {'error': 'Scan already in progress'}

        device_id = self._normalize_device_id(device_id)
        session_folder = self.upload_folder / session_id
        session_folder.mkdir(parents=True, exist_ok=True)
        
        self.status.update({
            'scanning': True,
            'device': device_id,
            'progress': 0,
            'pages_scanned': 0,
            'error': None,
            'cancelled': False,
            'session_id': session_id
        })
        
        # Start scanning in background thread
        scan_thread = Thread(target=self._do_scan, args=(
            session_id, session_folder, device_id, use_adf, auto_process, template_id, show_ui
        ))
        scan_thread.start()
        
        return {
            'success': True,
            'session_id': session_id,
            'message': 'Scanning started'
        }
    
    def _do_scan(self, session_id: str, session_folder: Path, 
                 device_id: Optional[Union[str, int]], use_adf: bool,
                 auto_process: bool, template_id: Optional[str], show_ui: bool):
        """Perform the actual scanning operation"""
        try:
            if device_id == 'simulator' or self.scanner is None:
                # Simulated scanning for testing
                self._simulate_scan(session_folder)
            elif self.scanner == 'twain':
                self._scan_twain(session_folder, device_id, use_adf, show_ui=show_ui)
            elif self.scanner == 'sane':
                self._scan_sane(session_folder, device_id, use_adf)

            # If a driver saved images but callbacks didn't update pages_scanned,
            # reconcile by counting files on disk.
            disk_pages = self._count_session_images(session_folder)
            if disk_pages > self.status.get("pages_scanned", 0):
                self.status["pages_scanned"] = disk_pages

            if self.status.get("pages_scanned", 0) <= 0 and self.status.get("scanning", False):
                if show_ui:
                    raise Exception(
                        "Hiç sayfa taranmadı. Tarayıcı arayüzü açıldıysa Epson Scan içinden 'Tara'ya basıp bitmesini bekleyin."
                    )
                raise Exception(
                    "Hiç sayfa taranmadı. Bu cihaz/sürücü 'sessiz tarama' desteklemiyor olabilir; 'Tarayıcı arayüzünü göster' seçeneğini açıp tekrar deneyin."
                )

            if not self.status.get('scanning'):
                self._emit_status('scan_cancelled', {
                    'session_id': session_id,
                    'pages_scanned': self.status.get('pages_scanned', 0),
                })
                return

            self._emit_status('scan_complete', {
                'session_id': session_id,
                'pages_scanned': self.status['pages_scanned']
            })
            
            # Auto-process if requested
            if auto_process and self.status['pages_scanned'] > 0:
                if not self.omr_service:
                    self._emit_status('processing_error', {
                        'session_id': session_id,
                        'error': 'OMR service not configured'
                    })
                else:
                    self._emit_status('processing_started', {'session_id': session_id})
                    try:
                        result = self.omr_service.process_session(session_id, template_id)
                        self._emit_status('processing_complete', {
                            'session_id': session_id,
                            'status': result.get('status', 'completed')
                        })
                    except Exception as e:
                        self._emit_status('processing_error', {
                            'session_id': session_id,
                            'error': str(e)
                        })
                
        except Exception as e:
            self.status['error'] = str(e)
            self._emit_status('scan_error', {'session_id': session_id, 'error': str(e)})
        finally:
            self.status['scanning'] = False

    def _scan_twain(
        self,
        session_folder: Path,
        device_id: Optional[Union[str, int]],
        use_adf: bool,
        *,
        show_ui: bool,
    ):
        """Scan using TWAIN (Windows)"""
        import twain
        
        with self._twain_source_manager() as sm:
            # Resolve source selection once (used for retries).
            sources = sm.GetSourceList()
            source_name = None
            source_idx = device_id if isinstance(device_id, int) else None
            if source_idx is None and isinstance(device_id, str) and device_id.isdigit():
                source_idx = int(device_id)
            if source_idx is not None:
                if source_idx < 0 or source_idx >= len(sources):
                    raise Exception(f"Invalid scanner device index: {source_idx}")
                source_name = sources[source_idx]
            elif isinstance(device_id, str) and device_id and device_id != "simulator":
                # Allow passing exact TWAIN source name.
                source_name = device_id

            def open_source():
                if source_name:
                    return sm.OpenSource(source_name)
                return sm.OpenSource()

            def configure_source(source):
                # Configure for ADF if available
                if use_adf:
                    try:
                        source.SetCapability(twain.CAP_FEEDERENABLED, twain.TWTY_BOOL, True)
                        source.SetCapability(twain.CAP_AUTOFEED, twain.TWTY_BOOL, True)
                    except Exception:
                        pass  # ADF not supported

                # For ADF, request all pages if supported (many drivers default to 1).
                try:
                    source.SetCapability(
                        twain.CAP_XFERCOUNT,
                        twain.TWTY_INT16,
                        -1 if use_adf else 1,
                    )
                except Exception:
                    pass

                # Set resolution
                try:
                    source.SetCapability(twain.ICAP_XRESOLUTION, twain.TWTY_FIX32, 300.0)
                    source.SetCapability(twain.ICAP_YRESOLUTION, twain.TWTY_FIX32, 300.0)
                except Exception:
                    pass

            modal = bool(show_ui)

            def try_acquire_file() -> int:
                """Prefer file transfer when supported (more compatible with many drivers)."""
                page_num = 0
                current_filename = None

                def before(_img_info):
                    nonlocal current_filename, page_num
                    if not self.status.get("scanning", False):
                        raise twain.exceptions.CancelAll
                    current_filename = f"scan_{page_num + 1:04d}.png"
                    return str(session_folder / current_filename)

                def after(more):
                    nonlocal page_num, current_filename
                    page_num += 1
                    self.status["pages_scanned"] = page_num
                    self.status["progress"] = min(page_num * 10, 99)
                    if current_filename:
                        self._emit_status(
                            "page_scanned",
                            {"page": page_num, "filename": current_filename},
                        )

                    if not self.status.get("scanning", False) or not use_adf:
                        raise twain.exceptions.CancelAll

                source = open_source()
                try:
                    if not source:
                        raise Exception("Could not open scanner")
                    configure_source(source)
                    source.acquire_file(before=before, after=after, show_ui=show_ui, modal=modal)
                finally:
                    try:
                        source.destroy()
                    except Exception:
                        pass
                return page_num

            def try_acquire_native() -> int:
                """Fallback to native transfer."""
                page_num = 0

                def after(image, more):
                    nonlocal page_num
                    if not self.status.get("scanning", False):
                        raise twain.exceptions.CancelAll

                    page_num += 1
                    filename = f"scan_{page_num:04d}.bmp"
                    filepath = session_folder / filename
                    image.save(str(filepath))
                    image.close()

                    self.status["pages_scanned"] = page_num
                    self.status["progress"] = min(page_num * 10, 99)
                    self._emit_status(
                        "page_scanned",
                        {"page": page_num, "filename": filename},
                    )

                    if not use_adf:
                        raise twain.exceptions.CancelAll

                source = open_source()
                try:
                    if not source:
                        raise Exception("Could not open scanner")
                    configure_source(source)
                    source.acquire_natively(after=after, show_ui=show_ui, modal=modal)
                finally:
                    try:
                        source.destroy()
                    except Exception:
                        pass
                return page_num

            errors = []
            for attempt in (try_acquire_file, try_acquire_native):
                if not self.status.get("scanning", False):
                    break
                try:
                    pages = attempt()
                    if pages > 0:
                        self.status["progress"] = 100
                        return
                except twain.exceptions.DSTransferCancelled:
                    # Cancelled by user or no pages available.
                    errors.append("Scan cancelled or no pages available")
                except Exception as e:
                    errors.append(str(e))

            if errors:
                raise Exception(" / ".join(errors))
    
    def _scan_sane(self, session_folder: Path, device_id: Optional[Union[str, int]], use_adf: bool):
        """Scan using SANE (Linux)"""
        import sane
        
        try:
            # Open device
            device = sane.open(device_id) if device_id else sane.open(sane.get_devices()[0][0])
            
            # Configure
            try:
                device.resolution = 300
                if use_adf:
                    device.source = 'ADF'
            except:
                pass
            
            # Scan pages
            page_num = 0
            
            while True:
                if not self.status.get('scanning', False):
                    break
                try:
                    page_num += 1
                    device.start()
                    image = device.snap()
                    
                    filename = f"scan_{page_num:04d}.png"
                    filepath = session_folder / filename
                    image.save(str(filepath))
                    
                    self.status['pages_scanned'] = page_num
                    self._emit_status('page_scanned', {
                        'page': page_num,
                        'filename': filename
                    })
                    
                    if not use_adf:
                        break
                        
                except Exception:
                    break  # No more pages
            
            device.close()
            
        except Exception as e:
            raise Exception(f"SANE scan error: {e}")
    
    def _simulate_scan(self, session_folder: Path):
        """Simulate scanning for testing without real scanner"""
        import time
        from PIL import Image
        
        # Simulate 3 pages
        for page_num in range(1, 4):
            if not self.status.get('scanning', False):
                break
            time.sleep(0.5)  # Simulate scan time
            
            # Create a simple test image
            img = Image.new('RGB', (1700, 2200), color='white')
            
            filename = f"scan_{page_num:04d}.png"
            filepath = session_folder / filename
            img.save(str(filepath))
            
            self.status['pages_scanned'] = page_num
            self.status['progress'] = page_num * 33
            self._emit_status('page_scanned', {
                'page': page_num,
                'filename': filename
            })
    
    def _emit_status(self, event: str, data: Dict[str, Any]):
        """Emit status via WebSocket"""
        if self.socketio:
            self.socketio.emit(event, data)

    @staticmethod
    def _count_session_images(session_folder: Path) -> int:
        exts = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff"}
        try:
            return sum(
                1
                for p in Path(session_folder).iterdir()
                if p.is_file() and p.suffix.lower() in exts
            )
        except Exception:
            return 0
    
    def get_status(self) -> Dict[str, Any]:
        """Get current scanner status"""
        return {
            **self.status,
            'platform': PLATFORM,
            'scanner_type': self.scanner or 'none'
        }
    
    def cancel_scan(self):
        """Cancel current scan operation"""
        self.status['cancelled'] = True
        self.status['scanning'] = False
        return {'success': True, 'message': 'Scan cancelled'}
