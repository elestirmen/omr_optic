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
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, List
from threading import Thread

# Detect platform
PLATFORM = platform.system()


class ScannerService:
    """Cross-platform scanner service with ADF support"""
    
    def __init__(self, upload_folder: Path, socketio=None):
        self.upload_folder = Path(upload_folder)
        self.socketio = socketio
        self.current_scan = None
        self.status = {
            'scanning': False,
            'device': None,
            'progress': 0,
            'pages_scanned': 0
        }
        
        # Initialize platform-specific scanner
        self.scanner = None
        self.twain_source_manager = None
        self._init_scanner()
    
    def _init_scanner(self):
        """Initialize platform-specific scanner support"""
        if PLATFORM == 'Windows':
            try:
                import twain
                self.twain_source_manager = twain.SourceManager(0)
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
        
        if self.scanner == 'twain' and self.twain_source_manager:
            try:
                sources = self.twain_source_manager.GetSourceList()
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
    
    def scan(self, session_id: str, device_id: Optional[str] = None,
             use_adf: bool = False, auto_process: bool = True,
             template_id: Optional[str] = None) -> Dict[str, Any]:
        """Start scanning operation"""
        
        if self.status['scanning']:
            return {'error': 'Scan already in progress'}
        
        session_folder = self.upload_folder / session_id
        session_folder.mkdir(parents=True, exist_ok=True)
        
        self.status.update({
            'scanning': True,
            'device': device_id,
            'progress': 0,
            'pages_scanned': 0,
            'session_id': session_id
        })
        
        # Start scanning in background thread
        scan_thread = Thread(target=self._do_scan, args=(
            session_id, session_folder, device_id, use_adf, auto_process, template_id
        ))
        scan_thread.start()
        
        return {
            'success': True,
            'session_id': session_id,
            'message': 'Scanning started'
        }
    
    def _do_scan(self, session_id: str, session_folder: Path, 
                 device_id: Optional[str], use_adf: bool,
                 auto_process: bool, template_id: Optional[str]):
        """Perform the actual scanning operation"""
        try:
            if device_id == 'simulator' or self.scanner is None:
                # Simulated scanning for testing
                self._simulate_scan(session_folder)
            elif self.scanner == 'twain':
                self._scan_twain(session_folder, device_id, use_adf)
            elif self.scanner == 'sane':
                self._scan_sane(session_folder, device_id, use_adf)
            
            self._emit_status('scan_complete', {
                'session_id': session_id,
                'pages_scanned': self.status['pages_scanned']
            })
            
            # Auto-process if requested
            if auto_process and self.status['pages_scanned'] > 0:
                self._emit_status('processing_started', {'session_id': session_id})
                # Processing will be handled by the OMR service
                
        except Exception as e:
            self._emit_status('scan_error', {'error': str(e)})
        finally:
            self.status['scanning'] = False
    
    def _scan_twain(self, session_folder: Path, device_id: Optional[str], use_adf: bool):
        """Scan using TWAIN (Windows)"""
        import twain
        
        try:
            # Open source
            if device_id is not None and isinstance(device_id, int):
                sources = self.twain_source_manager.GetSourceList()
                source = self.twain_source_manager.OpenSource(sources[device_id])
            else:
                source = self.twain_source_manager.OpenSource()
            
            if not source:
                raise Exception("Could not open scanner")
            
            # Configure for ADF if available
            if use_adf:
                try:
                    source.SetCapability(twain.CAP_FEEDERENABLED, twain.TWTY_BOOL, True)
                    source.SetCapability(twain.CAP_AUTOFEED, twain.TWTY_BOOL, True)
                except:
                    pass  # ADF not supported
            
            # Set resolution
            try:
                source.SetCapability(twain.ICAP_XRESOLUTION, twain.TWTY_FIX32, 300.0)
                source.SetCapability(twain.ICAP_YRESOLUTION, twain.TWTY_FIX32, 300.0)
            except:
                pass
            
            # Scan pages
            page_num = 0
            
            source.RequestAcquire(0, 0)  # Show UI: No, Modal: No
            
            while True:
                try:
                    source.RequestAcquire(0, 0)
                    (handle, more_pending) = source.XferImageNatively()
                    
                    if handle:
                        page_num += 1
                        filename = f"scan_{page_num:04d}.bmp"
                        filepath = session_folder / filename
                        
                        twain.DIBToBMFile(handle, str(filepath))
                        twain.GlobalHandleFree(handle)
                        
                        self.status['pages_scanned'] = page_num
                        self.status['progress'] = min(page_num * 10, 100)
                        self._emit_status('page_scanned', {
                            'page': page_num,
                            'filename': filename
                        })
                    
                    if not more_pending:
                        break
                        
                except twain.excSADS:
                    break  # Scanner cancelled or no more pages
            
            source.destroy()
            
        except Exception as e:
            raise Exception(f"TWAIN scan error: {e}")
    
    def _scan_sane(self, session_folder: Path, device_id: Optional[str], use_adf: bool):
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
    
    def get_status(self) -> Dict[str, Any]:
        """Get current scanner status"""
        return {
            **self.status,
            'platform': PLATFORM,
            'scanner_type': self.scanner or 'none'
        }
    
    def cancel_scan(self):
        """Cancel current scan operation"""
        self.status['scanning'] = False
        return {'success': True, 'message': 'Scan cancelled'}
