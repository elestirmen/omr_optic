"""
Scanner Service - Cross-platform scanner integration

Supports:
- Windows: TWAIN protocol
- Linux: SANE protocol
- Network: eSCL/AirScan via Zeroconf discovery

Provides ADF (Automatic Document Feeder) support for bulk scanning.
"""

import os
import sys
import uuid
import platform
import ctypes
import time
import random
import socket
import logging
from ctypes import wintypes
from contextlib import contextmanager
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Union, Callable, TypeVar
from threading import Thread, Lock
from functools import wraps

# Detect platform
PLATFORM = platform.system()

# Setup logging
logger = logging.getLogger(__name__)

# Type variable for generic retry decorator
T = TypeVar('T')


class ScannerError(Exception):
    """Base exception for scanner errors with user-friendly messages"""
    
    def __init__(self, message: str, user_hint: str = None, recoverable: bool = True):
        super().__init__(message)
        self.user_hint = user_hint or message
        self.recoverable = recoverable


class ScannerTimeoutError(ScannerError):
    """Timeout while communicating with scanner"""
    pass


class ScannerConnectionError(ScannerError):
    """Failed to connect to scanner"""
    pass


class DeviceCache:
    """Thread-safe cache for discovered devices with TTL"""
    
    def __init__(self, ttl_seconds: int = 60):
        self._cache: Dict[str, Any] = {}
        self._timestamps: Dict[str, datetime] = {}
        self._lock = Lock()
        self._ttl = timedelta(seconds=ttl_seconds)
    
    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            if key not in self._cache:
                return None
            if datetime.now() - self._timestamps[key] > self._ttl:
                del self._cache[key]
                del self._timestamps[key]
                return None
            return self._cache[key]
    
    def set(self, key: str, value: Any) -> None:
        with self._lock:
            self._cache[key] = value
            self._timestamps[key] = datetime.now()
    
    def invalidate(self, key: str = None) -> None:
        with self._lock:
            if key:
                self._cache.pop(key, None)
                self._timestamps.pop(key, None)
            else:
                self._cache.clear()
                self._timestamps.clear()


def retry_with_backoff(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    exponential_base: float = 2.0,
    jitter: bool = True,
    retryable_exceptions: tuple = (Exception,),
    on_retry: Callable[[Exception, int], None] = None,
):
    """
    Decorator for retrying functions with exponential backoff.
    
    Args:
        max_retries: Maximum number of retry attempts
        base_delay: Initial delay between retries in seconds
        max_delay: Maximum delay between retries
        exponential_base: Base for exponential backoff calculation
        jitter: Add random jitter to prevent thundering herd
        retryable_exceptions: Tuple of exception types to retry on
        on_retry: Optional callback(exception, attempt) called before each retry
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args, **kwargs) -> T:
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except retryable_exceptions as e:
                    last_exception = e
                    
                    if attempt == max_retries:
                        logger.warning(
                            f"{func.__name__} failed after {max_retries + 1} attempts: {e}"
                        )
                        raise
                    
                    # Calculate delay with exponential backoff
                    delay = min(base_delay * (exponential_base ** attempt), max_delay)
                    
                    # Add jitter (±25% of delay)
                    if jitter:
                        delay = delay * (0.75 + random.random() * 0.5)
                    
                    if on_retry:
                        on_retry(e, attempt + 1)
                    
                    logger.info(
                        f"{func.__name__} attempt {attempt + 1} failed: {e}. "
                        f"Retrying in {delay:.2f}s..."
                    )
                    time.sleep(delay)
            
            raise last_exception
        return wrapper
    return decorator


class NetworkScannerDiscovery:
    """Discover network scanners via Zeroconf/mDNS (eSCL/AirScan protocol)"""
    
    # Service types for scanner discovery
    SERVICE_TYPES = [
        "_uscan._tcp.local.",      # USB scan over network (eSCL)
        "_ipp-usb._tcp.local.",    # IPP USB
        "_scanner._tcp.local.",    # Generic scanner service
        "_pdl-datastream._tcp.local.",  # Some network scanners
    ]
    
    def __init__(self, timeout: float = 5.0):
        self.timeout = timeout
        self._discovered_devices: List[Dict[str, Any]] = []
        self._lock = Lock()
        self._zeroconf = None
        self._browsers = []
    
    def _get_zeroconf(self):
        """Lazy initialization of zeroconf"""
        try:
            from zeroconf import Zeroconf
            if self._zeroconf is None:
                self._zeroconf = Zeroconf()
            return self._zeroconf
        except ImportError:
            logger.debug("zeroconf package not installed, network discovery disabled")
            return None
    
    def discover(self) -> List[Dict[str, Any]]:
        """
        Discover network scanners using mDNS/Zeroconf.
        Returns list of discovered devices.
        """
        try:
            from zeroconf import ServiceBrowser, ServiceListener
        except ImportError:
            logger.info(
                "zeroconf paketi yüklü değil. Ağ tarayıcı keşfi devre dışı. "
                "Yüklemek için: pip install zeroconf"
            )
            return []
        
        zc = self._get_zeroconf()
        if not zc:
            return []
        
        self._discovered_devices = []
        
        class ScannerListener(ServiceListener):
            def __init__(inner_self):
                inner_self.parent = self
            
            def add_service(inner_self, zeroconf, service_type, name):
                try:
                    info = zeroconf.get_service_info(service_type, name, timeout=3000)
                    if info:
                        device = inner_self.parent._parse_service_info(info, service_type, name)
                        if device:
                            with inner_self.parent._lock:
                                # Avoid duplicates by checking address
                                existing_addrs = {d.get('address') for d in inner_self.parent._discovered_devices}
                                if device.get('address') not in existing_addrs:
                                    inner_self.parent._discovered_devices.append(device)
                                    logger.info(f"Discovered network scanner: {device.get('name')}")
                except Exception as e:
                    logger.debug(f"Error getting service info for {name}: {e}")
            
            def update_service(inner_self, zeroconf, service_type, name):
                pass
            
            def remove_service(inner_self, zeroconf, service_type, name):
                pass
        
        listener = ScannerListener()
        
        # Start browsing for all service types
        self._browsers = []
        for service_type in self.SERVICE_TYPES:
            try:
                browser = ServiceBrowser(zc, service_type, listener)
                self._browsers.append(browser)
            except Exception as e:
                logger.debug(f"Failed to browse {service_type}: {e}")
        
        # Wait for discovery
        time.sleep(self.timeout)
        
        # Cleanup browsers
        for browser in self._browsers:
            try:
                browser.cancel()
            except Exception:
                pass
        self._browsers = []
        
        return self._discovered_devices.copy()
    
    def _parse_service_info(self, info, service_type: str, name: str) -> Optional[Dict[str, Any]]:
        """Parse Zeroconf service info into device dict"""
        try:
            addresses = info.parsed_addresses()
            if not addresses:
                return None
            
            address = addresses[0]
            port = info.port
            
            # Extract properties
            props = {}
            if info.properties:
                for k, v in info.properties.items():
                    try:
                        key = k.decode() if isinstance(k, bytes) else k
                        val = v.decode() if isinstance(v, bytes) else v
                        props[key] = val
                    except Exception:
                        pass
            
            # Determine scanner name
            scanner_name = props.get('ty') or props.get('product') or name.split('.')[0]
            
            # Check for ADF capability from properties
            adf_capable = None
            if 'adf' in props.get('pdl', '').lower():
                adf_capable = True
            elif props.get('duplex'):
                adf_capable = True
            
            return {
                'id': f"network://{address}:{port}",
                'name': f"{scanner_name} (Ağ: {address})",
                'type': 'eSCL/Network',
                'address': address,
                'port': port,
                'adf_capable': adf_capable,
                'properties': props,
                'service_type': service_type,
            }
        except Exception as e:
            logger.debug(f"Failed to parse service info: {e}")
            return None
    
    def close(self):
        """Cleanup zeroconf resources"""
        for browser in self._browsers:
            try:
                browser.cancel()
            except Exception:
                pass
        self._browsers = []
        
        if self._zeroconf:
            try:
                self._zeroconf.close()
            except Exception:
                pass
            self._zeroconf = None


class ScannerService:
    """Cross-platform scanner service with ADF support and robust error handling"""
    
    # Configuration defaults
    DEFAULT_CONFIG = {
        'twain_init_timeout': 10.0,       # Seconds to wait for TWAIN init
        'twain_scan_timeout': 120.0,      # Seconds to wait for scan completion
        'network_discovery_timeout': 5.0,  # Seconds to wait for network discovery
        'device_cache_ttl': 60,            # Seconds to cache device list
        'max_retries': 3,                  # Maximum retry attempts
        'retry_base_delay': 1.0,           # Base delay for exponential backoff
    }
    
    # User-friendly error messages (Turkish)
    ERROR_MESSAGES = {
        'twain_not_installed': (
            "TWAIN sürücüsü yüklü değil. "
            "Çözüm: pip install pytwain komutunu çalıştırın."
        ),
        'twain_init_failed': (
            "TWAIN başlatılamadı. "
            "Çözüm: Tarayıcı sürücülerinin yüklü olduğundan emin olun."
        ),
        'no_devices_found': (
            "Hiç tarayıcı bulunamadı. "
            "Çözüm: 1) Tarayıcının açık ve bağlı olduğunu kontrol edin. "
            "2) Tarayıcı sürücülerinin yüklü olduğundan emin olun. "
            "3) Ağ tarayıcısı için aynı ağda olduğunuzdan emin olun."
        ),
        'device_busy': (
            "Tarayıcı meşgul veya başka bir uygulama tarafından kullanılıyor. "
            "Çözüm: Diğer tarama uygulamalarını kapatın ve tekrar deneyin."
        ),
        'network_timeout': (
            "Ağ tarayıcısına bağlanılamadı (zaman aşımı). "
            "Çözüm: 1) Tarayıcının açık olduğunu kontrol edin. "
            "2) Ağ bağlantınızı kontrol edin. "
            "3) Tarayıcı uyku modundaysa uyandırın."
        ),
        'scan_cancelled': (
            "Tarama iptal edildi."
        ),
        'adf_empty': (
            "ADF'de kağıt bulunamadı. "
            "Çözüm: Kağıtları ADF'ye yerleştirin ve tekrar deneyin."
        ),
    }
    
    def __init__(self, upload_folder: Path, socketio=None, omr_service=None, config: Dict = None):
        self.upload_folder = Path(upload_folder)
        self.socketio = socketio
        self.omr_service = omr_service
        self.current_scan = None
        self.device_capabilities: Dict[Union[str, int], Dict[str, Any]] = {}
        
        # Merge config with defaults
        self.config = {**self.DEFAULT_CONFIG, **(config or {})}
        
        # Initialize device cache
        self._device_cache = DeviceCache(ttl_seconds=self.config['device_cache_ttl'])
        
        # Network scanner discovery
        self._network_discovery = NetworkScannerDiscovery(
            timeout=self.config['network_discovery_timeout']
        )
        
        self.status = {
            'scanning': False,
            'processing': False,
            'device': None,
            'progress': 0,
            'pages_scanned': 0,
            'error': None,
            'session_id': None,
            'cancelled': False,
            'warnings': [],
            'last_error_hint': None,  # User-friendly error hint
        }
        
        # Initialize platform-specific scanner
        self.scanner = None
        self._init_scanner_with_retry()

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

    def _init_scanner_with_retry(self):
        """Initialize platform-specific scanner support with retry logic"""
        
        def on_retry(exc, attempt):
            logger.info(f"Scanner init retry {attempt}: {exc}")
        
        if PLATFORM == 'Windows':
            self._init_twain_with_retry(on_retry)
        elif PLATFORM == 'Linux':
            self._init_sane_with_retry(on_retry)
        
        # Log initialization result
        if self.scanner:
            logger.info(f"Scanner backend initialized: {self.scanner}")
        else:
            logger.warning("No scanner backend available")
    
    def _init_twain_with_retry(self, on_retry: Callable = None):
        """Initialize TWAIN with retry logic"""
        max_retries = self.config['max_retries']
        base_delay = self.config['retry_base_delay']
        
        for attempt in range(max_retries + 1):
            try:
                import twain
                # Validate DSM availability (TWAIN often has thread/window-handle constraints).
                sm = twain.SourceManager(0)
                sm.destroy()
                self.scanner = 'twain'
                return  # Success
                
            except ImportError:
                logger.warning(self.ERROR_MESSAGES['twain_not_installed'])
                self.status['last_error_hint'] = self.ERROR_MESSAGES['twain_not_installed']
                return  # Don't retry import errors
                
            except Exception as e:
                if attempt == max_retries:
                    logger.warning(f"TWAIN init failed after {max_retries + 1} attempts: {e}")
                    self.status['last_error_hint'] = self.ERROR_MESSAGES['twain_init_failed']
                    return
                
                # Calculate delay with exponential backoff and jitter
                delay = base_delay * (2 ** attempt) * (0.75 + random.random() * 0.5)
                
                if on_retry:
                    on_retry(e, attempt + 1)
                
                logger.info(f"TWAIN init attempt {attempt + 1} failed: {e}. Retrying in {delay:.2f}s...")
                time.sleep(delay)
    
    def _init_sane_with_retry(self, on_retry: Callable = None):
        """Initialize SANE with retry logic"""
        max_retries = self.config['max_retries']
        base_delay = self.config['retry_base_delay']
        
        for attempt in range(max_retries + 1):
            try:
                import sane
                sane.init()
                self.scanner = 'sane'
                return  # Success
                
            except ImportError:
                logger.warning("python-sane not installed. Install with: pip install python-sane")
                return  # Don't retry import errors
                
            except Exception as e:
                if attempt == max_retries:
                    logger.warning(f"SANE init failed after {max_retries + 1} attempts: {e}")
                    return
                
                delay = base_delay * (2 ** attempt) * (0.75 + random.random() * 0.5)
                
                if on_retry:
                    on_retry(e, attempt + 1)
                
                logger.info(f"SANE init attempt {attempt + 1} failed: {e}. Retrying in {delay:.2f}s...")
                time.sleep(delay)
    
    def list_devices(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """
        List available scanner devices with caching and retry logic.
        
        Args:
            force_refresh: If True, bypass cache and rescan
        
        Returns:
            List of device dictionaries
        """
        # Check cache first
        if not force_refresh:
            cached = self._device_cache.get('device_list')
            if cached is not None:
                logger.debug("Returning cached device list")
                return cached
        
        devices = []
        errors = []
        
        # 1. Discover local devices (TWAIN/SANE)
        local_devices, local_error = self._list_local_devices_with_retry()
        devices.extend(local_devices)
        if local_error:
            errors.append(local_error)
        
        # 2. Discover network devices (Zeroconf/mDNS)
        network_devices = self._discover_network_devices()
        devices.extend(network_devices)
        
        # 3. Add simulator if no devices found
        if not devices:
            devices.append({
                'id': 'simulator',
                'name': 'Simulated Scanner (Test)',
                'type': 'Simulator',
                'adf_capable': True
            })
            
            # Set helpful error hint
            if errors:
                self.status['last_error_hint'] = "; ".join(errors)
            else:
                self.status['last_error_hint'] = self.ERROR_MESSAGES['no_devices_found']
        else:
            self.status['last_error_hint'] = None
        
        # Cache the result
        self._device_cache.set('device_list', devices)
        
        logger.info(f"Found {len(devices)} scanner(s): {[d.get('name') for d in devices]}")
        return devices
    
    def _list_local_devices_with_retry(self) -> tuple:
        """
        List local TWAIN/SANE devices with retry logic.
        Returns (devices_list, error_message)
        """
        max_retries = self.config['max_retries']
        base_delay = self.config['retry_base_delay']
        devices = []
        last_error = None
        
        for attempt in range(max_retries + 1):
            try:
                if self.scanner == 'twain':
                    devices = self._list_twain_devices()
                elif self.scanner == 'sane':
                    devices = self._list_sane_devices()
                
                return devices, None  # Success
                
            except Exception as e:
                last_error = str(e)
                
                if attempt == max_retries:
                    error_msg = f"Yerel tarayıcılar listelenemedi: {last_error}"
                    logger.warning(error_msg)
                    return [], error_msg
                
                # Calculate delay with exponential backoff and jitter
                delay = base_delay * (2 ** attempt) * (0.75 + random.random() * 0.5)
                logger.info(
                    f"Device list attempt {attempt + 1} failed: {e}. "
                    f"Retrying in {delay:.2f}s..."
                )
                time.sleep(delay)
        
        return [], last_error
    
    def _list_twain_devices(self) -> List[Dict[str, Any]]:
        """List TWAIN devices (internal, no retry)"""
        devices = []
        
        with self._twain_source_manager() as sm:
            sources = sm.GetSourceList() or []
        
        logger.debug(f"TWAIN sources found: {sources}")
        
        # Get Windows printer names for better identification
        windows_printers = self._get_windows_printer_mapping(sources)
        
        # Count occurrences of each source name to detect duplicates
        name_counts = {}
        for name in sources:
            name_counts[name] = name_counts.get(name, 0) + 1
        
        # Track how many times we've seen each name (for handling duplicates)
        name_seen = {}
        
        for i, twain_name in enumerate(sources):
            cached = self.device_capabilities.get(i, {})
            
            # Determine display name
            display_name = twain_name
            matching_printers = windows_printers.get(twain_name, [])
            
            # If there are duplicates with same TWAIN name
            if name_counts[twain_name] > 1:
                name_seen[twain_name] = name_seen.get(twain_name, 0) + 1
                occurrence = name_seen[twain_name]
                
                # Try to match with Windows printer names
                if occurrence <= len(matching_printers):
                    # Use Windows printer name
                    display_name = matching_printers[occurrence - 1]
                else:
                    # Fallback: add occurrence number
                    display_name = f"{twain_name} ({occurrence})"
            elif len(matching_printers) == 1:
                # Single device, single match - use Windows name
                display_name = matching_printers[0]
            
            devices.append({
                'id': i,
                'name': display_name,
                'twain_source': twain_name,  # Keep original TWAIN source name
                'type': 'TWAIN',
                'adf_capable': cached.get('adf_capable')
            })
        
        return devices
    
    def _get_windows_printer_mapping(self, twain_sources: List[str]) -> Dict[str, List[str]]:
        """
        Get mapping of TWAIN source names to Windows printer names.
        Uses model number matching (e.g., WF-M5899) to find corresponding Windows printers.
        
        Args:
            twain_sources: List of TWAIN source names to match
            
        Returns:
            Dict where key is TWAIN source name and value is list of Windows printer names
        """
        import re
        
        try:
            import win32print
            
            # EnumPrinters with level 2 gives detailed info
            printers = win32print.EnumPrinters(
                win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS,
                None,
                2  # Level 2 for detailed info
            )
            
            # Get all Windows printer names
            windows_printer_names = [p['pPrinterName'] for p in printers]
            logger.debug(f"Windows printers found: {windows_printer_names}")
            
            mapping = {}
            
            for twain_name in twain_sources:
                # Extract model number from TWAIN source name
                # e.g., "EPSON WF-M5899 Series" -> "WF-M5899"
                # Common patterns: WF-M5899, L3150, ET-2720, XP-4100, etc.
                model_match = re.search(r'([A-Z]{1,3}[-]?[A-Z]?\d{3,5}[A-Z]?)', twain_name, re.IGNORECASE)
                
                if model_match:
                    model_number = model_match.group(1)
                    logger.debug(f"Extracted model number '{model_number}' from '{twain_name}'")
                    
                    # Find all Windows printers containing this model number
                    matching = [p for p in windows_printer_names if model_number.lower() in p.lower()]
                    if matching:
                        mapping[twain_name] = matching
                        logger.debug(f"Matched '{twain_name}' to Windows printers: {matching}")
                else:
                    # Fallback: try direct substring matching
                    # Remove common suffixes like "Series", "Printer"
                    clean_name = re.sub(r'\s*(Series|Printer|Scanner)$', '', twain_name, flags=re.IGNORECASE).strip()
                    matching = [p for p in windows_printer_names if clean_name.lower() in p.lower()]
                    if matching:
                        mapping[twain_name] = matching
            
            logger.info(f"TWAIN to Windows printer mapping: {mapping}")
            return mapping
            
        except ImportError:
            logger.debug("win32print not available, cannot get Windows printer names")
            return {}
        except Exception as e:
            logger.warning(f"Failed to get Windows printer mapping: {e}")
            return {}
    
    def _list_sane_devices(self) -> List[Dict[str, Any]]:
        """List SANE devices (internal, no retry)"""
        import sane
        devices = []
        
        sane_devices = sane.get_devices()
        for i, dev in enumerate(sane_devices):
            cached = self.device_capabilities.get(dev[0], {})
            devices.append({
                'id': dev[0],
                'name': f"{dev[1]} {dev[2]}",
                'type': 'SANE',
                'adf_capable': cached.get(
                    'adf_capable',
                    'adf' in dev[0].lower() or 'feeder' in str(dev).lower(),
                )
            })
        
        return devices
    
    def _discover_network_devices(self) -> List[Dict[str, Any]]:
        """Discover network scanners via Zeroconf/mDNS"""
        try:
            network_devices = self._network_discovery.discover()
            logger.info(f"Discovered {len(network_devices)} network scanner(s)")
            return network_devices
        except Exception as e:
            logger.debug(f"Network scanner discovery failed: {e}")
            return []
    
    def refresh_devices(self) -> List[Dict[str, Any]]:
        """Force refresh device list, bypassing cache"""
        self._device_cache.invalidate('device_list')
        return self.list_devices(force_refresh=True)

    def get_capabilities(self, device_id: Optional[Union[str, int]] = None) -> Dict[str, Any]:
        """Best-effort capability detection for a device (e.g., ADF support)."""
        normalized_id = self._normalize_device_id(device_id)
        scanner_type = self.scanner or 'none'

        if normalized_id is None:
            return {
                'device_id': None,
                'scanner_type': scanner_type,
                'adf_capable': None,
                'error': 'device_id required',
            }

        if normalized_id == 'simulator':
            caps = {
                'device_id': normalized_id,
                'scanner_type': 'simulator',
                'adf_capable': True,
                'detected_at': datetime.now().isoformat(),
            }
            self.device_capabilities[normalized_id] = caps
            return caps

        if self.scanner is None:
            return {
                'device_id': normalized_id,
                'scanner_type': 'none',
                'adf_capable': None,
                'detected_at': datetime.now().isoformat(),
                'error': 'Scanner backend not available',
            }

        if self.scanner == 'twain':
            caps = self._get_twain_capabilities(normalized_id)
        elif self.scanner == 'sane':
            caps = self._get_sane_capabilities(normalized_id)
        else:
            caps = {
                'device_id': normalized_id,
                'scanner_type': scanner_type,
                'adf_capable': None,
                'detected_at': datetime.now().isoformat(),
            }

        # Cache for UI/device list.
        try:
            self.device_capabilities[normalized_id] = caps
        except Exception:
            pass
        return caps

    @staticmethod
    def _twain_bool_capability_allows_true(capability: Any) -> Optional[bool]:
        """
        Interpret pytwain capability data for a boolean capability.

        Examples (pytwain):
        - (6, (0, 0, [0])) -> supported but only False allowed => no ADF
        - (6, (0, 0, [0, 1])) -> True/False allowed => ADF-capable
        """
        try:
            _type, data = capability
        except Exception:
            return None

        values = None
        if isinstance(data, tuple) and len(data) == 3:
            values = data[2]
        else:
            values = data

        if isinstance(values, (list, tuple, set)):
            return any(bool(v) for v in values)
        if isinstance(values, bool):
            return values
        if isinstance(values, int):
            return bool(values)
        return None

    @staticmethod
    def _safe_close_twain(obj: Any) -> None:
        for method_name in ('close', 'destroy'):
            try:
                method = getattr(obj, method_name, None)
                if callable(method):
                    method()
            except Exception:
                pass

    def _get_twain_capabilities(self, device_id: Union[str, int]) -> Dict[str, Any]:
        import twain

        detected_at = datetime.now().isoformat()
        sm = None
        source = None
        source_name = None

        try:
            sm = twain.SourceManager(0)
            sources = sm.GetSourceList() or []
            if not sources:
                return {
                    'device_id': device_id,
                    'scanner_type': 'twain',
                    'adf_capable': None,
                    'detected_at': detected_at,
                    'error': 'No TWAIN sources found',
                }

            source_idx = device_id if isinstance(device_id, int) else None
            if source_idx is None and isinstance(device_id, str) and device_id.isdigit():
                source_idx = int(device_id)

            if source_idx is not None:
                if source_idx < 0 or source_idx >= len(sources):
                    return {
                        'device_id': device_id,
                        'scanner_type': 'twain',
                        'adf_capable': None,
                        'detected_at': detected_at,
                        'error': f'Invalid scanner device index: {source_idx}',
                    }
                source_name = sources[source_idx]
            elif isinstance(device_id, str) and device_id and device_id != 'simulator':
                source_name = device_id
            else:
                source_name = sources[0]

            source = sm.OpenSource(source_name)
            if not source:
                return {
                    'device_id': device_id,
                    'scanner_type': 'twain',
                    'adf_capable': None,
                    'detected_at': detected_at,
                    'source_name': source_name,
                    'error': 'Could not open TWAIN source',
                }

            adf_capable: Optional[bool] = None
            try:
                feeder_cap = source.GetCapability(twain.CAP_FEEDERENABLED)
                adf_capable = self._twain_bool_capability_allows_true(feeder_cap)
            except Exception:
                adf_capable = None

            return {
                'device_id': device_id,
                'scanner_type': 'twain',
                'adf_capable': adf_capable,
                'detected_at': detected_at,
                'source_name': source_name,
                'detected_by': 'twain.CAP_FEEDERENABLED',
            }
        except Exception as e:
            return {
                'device_id': device_id,
                'scanner_type': 'twain',
                'adf_capable': None,
                'detected_at': detected_at,
                'source_name': source_name,
                'error': str(e),
            }
        finally:
            if source is not None:
                self._safe_close_twain(source)
            if sm is not None:
                self._safe_close_twain(sm)

    def _get_sane_capabilities(self, device_id: Union[str, int]) -> Dict[str, Any]:
        detected_at = datetime.now().isoformat()

        try:
            devices = self.list_devices()
            match = next((d for d in devices if d.get('id') == device_id), None)
            return {
                'device_id': device_id,
                'scanner_type': 'sane',
                'adf_capable': match.get('adf_capable') if match else None,
                'detected_at': detected_at,
                'detected_by': 'sane.device_list',
            }
        except Exception as e:
            return {
                'device_id': device_id,
                'scanner_type': 'sane',
                'adf_capable': None,
                'detected_at': detected_at,
                'error': str(e),
            }
    
    def scan(
        self,
        session_id: str,
        device_id: Optional[Union[str, int]] = None,
        use_adf: bool = False,
        auto_process: bool = True,
        template_id: Optional[str] = None,
        show_ui: bool = True,
        append: bool = False,
    ) -> Dict[str, Any]:
        """Start scanning operation"""
        
        if self.status['scanning']:
            return {'error': 'Scan already in progress'}

        device_id = self._normalize_device_id(device_id)
        session_folder = self.upload_folder / session_id
        session_folder.mkdir(parents=True, exist_ok=True)
        existing_pages = self._count_scanned_pages(session_folder) if append else 0
        
        self.status.update({
            'scanning': True,
            'processing': False,
            'device': device_id,
            'progress': min(existing_pages * 10, 99) if existing_pages else 0,
            'pages_scanned': existing_pages,
            'error': None,
            'cancelled': False,
            'warnings': [],
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
            disk_pages = self._count_scanned_pages(session_folder)
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
                    self.status['processing'] = True
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
                    finally:
                        self.status['processing'] = False
                
        except Exception as e:
            self.status['error'] = str(e)
            self._emit_status('scan_error', {'session_id': session_id, 'error': str(e)})
        finally:
            self.status['scanning'] = False
            self.status['processing'] = False

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
                adf_effective = bool(use_adf)

                # Configure for ADF if available
                if use_adf:
                    try:
                        source.SetCapability(twain.CAP_FEEDERENABLED, twain.TWTY_BOOL, True)
                        source.SetCapability(twain.CAP_AUTOFEED, twain.TWTY_BOOL, True)
                    except Exception:
                        self._add_warning(
                            "ADF etkinleştirilemedi. Bu cihaz ADF desteklemiyor olabilir; gerekirse tarayıcı arayüzünden (UI) ADF seçin."
                        )
                        if not show_ui:
                            adf_effective = False

                # For ADF, request all pages if supported (many drivers default to 1).
                try:
                    source.SetCapability(
                        twain.CAP_XFERCOUNT,
                        twain.TWTY_INT16,
                        -1 if adf_effective else 1,
                    )
                except Exception:
                    pass

                # Set resolution
                try:
                    source.SetCapability(twain.ICAP_XRESOLUTION, twain.TWTY_FIX32, 300.0)
                    source.SetCapability(twain.ICAP_YRESOLUTION, twain.TWTY_FIX32, 300.0)
                except Exception:
                    pass

                return adf_effective

            modal = bool(show_ui)

            def try_acquire_file() -> int:
                """Prefer file transfer when supported (more compatible with many drivers)."""
                current_filename = None
                start_count = self._count_scanned_pages(session_folder)
                last_known_count = start_count

                def before(_img_info):
                    nonlocal current_filename
                    if not self.status.get("scanning", False):
                        raise twain.exceptions.CancelAll
                    current_filename = self._allocate_scan_filename(session_folder, "png")
                    return str(session_folder / current_filename)

                def after(more):
                    nonlocal current_filename, last_known_count
                    # Trust disk count to avoid off-by-one / overwrite issues.
                    last_known_count = self._count_scanned_pages(session_folder)
                    self.status["pages_scanned"] = last_known_count
                    self.status["progress"] = min(last_known_count * 10, 99)
                    if current_filename:
                        self._emit_status(
                            "page_scanned",
                            {"page": last_known_count, "filename": current_filename},
                        )

                    if not self.status.get("scanning", False) or not adf_effective:
                        raise twain.exceptions.CancelAll

                source = open_source()
                try:
                    if not source:
                        raise Exception("Could not open scanner")
                    adf_effective = configure_source(source)
                    source.acquire_file(before=before, after=after, show_ui=show_ui, modal=modal)
                finally:
                    try:
                        source.close()
                        source.destroy()
                    except Exception:
                        pass
                return max(0, last_known_count - start_count)

            def try_acquire_native() -> int:
                """Fallback to native transfer."""
                adf_effective = bool(use_adf)
                start_count = self._count_scanned_pages(session_folder)
                last_known_count = start_count

                def after(image, more):
                    nonlocal last_known_count
                    if not self.status.get("scanning", False):
                        raise twain.exceptions.CancelAll

                    filename = self._allocate_scan_filename(session_folder, "bmp")
                    filepath = session_folder / filename
                    image.save(str(filepath))
                    image.close()

                    last_known_count = self._count_scanned_pages(session_folder)
                    self.status["pages_scanned"] = last_known_count
                    self.status["progress"] = min(last_known_count * 10, 99)
                    self._emit_status(
                        "page_scanned",
                        {"page": last_known_count, "filename": filename},
                    )

                    if not adf_effective:
                        raise twain.exceptions.CancelAll

                source = open_source()
                try:
                    if not source:
                        raise Exception("Could not open scanner")
                    adf_effective = configure_source(source)
                    source.acquire_natively(after=after, show_ui=show_ui, modal=modal)
                finally:
                    try:
                        source.close()
                        source.destroy()
                    except Exception:
                        pass
                return max(0, last_known_count - start_count)

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
            adf_effective = bool(use_adf)
            try:
                device.resolution = 300
                if use_adf:
                    try:
                        device.source = 'ADF'
                    except Exception:
                        adf_effective = False
                        self._add_warning(
                            "ADF etkinleştirilemedi. Bu cihaz/sürücü ADF'yi desteklemiyor olabilir; düz yatak taraması yapılacak."
                        )
            except Exception:
                pass
            
            # Scan pages
            page_num = self._count_scanned_pages(session_folder)
            
            while True:
                if not self.status.get('scanning', False):
                    break
                try:
                    filename = self._allocate_scan_filename(session_folder, "png")
                    page_num += 1
                    device.start()
                    image = device.snap()
                    
                    filepath = session_folder / filename
                    image.save(str(filepath))
                    
                    self.status['pages_scanned'] = self._count_scanned_pages(session_folder)
                    self._emit_status('page_scanned', {
                        'page': self.status['pages_scanned'],
                        'filename': filename
                    })
                    
                    if not adf_effective:
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
        for _ in range(3):
            if not self.status.get('scanning', False):
                break
            time.sleep(0.5)  # Simulate scan time
            
            # Create a simple test image
            img = Image.new('RGB', (1700, 2200), color='white')
            
            filename = self._allocate_scan_filename(session_folder, "png")
            filepath = session_folder / filename
            img.save(str(filepath))
            
            self.status['pages_scanned'] = self._count_scanned_pages(session_folder)
            self.status['progress'] = min(self.status['pages_scanned'] * 33, 99)
            self._emit_status('page_scanned', {
                'page': self.status['pages_scanned'],
                'filename': filename
            })
    
    def _emit_status(self, event: str, data: Dict[str, Any]):
        """Emit status via WebSocket"""
        if self.socketio:
            self.socketio.emit(event, data)

    def _add_warning(self, message: str) -> None:
        try:
            warnings = self.status.get('warnings')
            if not isinstance(warnings, list):
                warnings = []
                self.status['warnings'] = warnings
            if message not in warnings:
                warnings.append(message)
        except Exception:
            pass

        self._emit_status(
            'scan_warning',
            {
                'session_id': self.status.get('session_id'),
                'warning': message,
            },
        )

    @staticmethod
    def _count_scanned_pages(session_folder: Path) -> int:
        """Count scanned page images created by this service (scan_####.*)."""
        import re

        exts = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff"}
        pattern = re.compile(r"^scan_\d{4}\.", re.IGNORECASE)

        try:
            return sum(
                1
                for p in Path(session_folder).iterdir()
                if p.is_file()
                and p.suffix.lower() in exts
                and pattern.match(p.name) is not None
            )
        except Exception:
            return 0

    @staticmethod
    def _next_scan_index(session_folder: Path) -> int:
        """
        Return the next 1-based scan index for filenames like scan_0001.png.
        Uses the highest existing index to avoid overwriting on append scans.
        """
        import re

        pattern = re.compile(r"^scan_(\d{4})\.", re.IGNORECASE)
        max_index = 0

        try:
            for p in Path(session_folder).iterdir():
                if not p.is_file():
                    continue
                match = pattern.match(p.name)
                if not match:
                    continue
                try:
                    max_index = max(max_index, int(match.group(1)))
                except Exception:
                    continue
        except Exception:
            return 1

        return max_index + 1

    @classmethod
    def _allocate_scan_filename(cls, session_folder: Path, ext: str) -> str:
        """
        Allocate a free scan filename like scan_0001.png, scan_0002.png, ...
        Never overwrites existing files.
        """
        session_folder = Path(session_folder)
        ext = (ext or "").lstrip(".") or "png"

        index = cls._next_scan_index(session_folder)
        for _ in range(10000):
            filename = f"scan_{index:04d}.{ext}"
            if not (session_folder / filename).exists():
                return filename
            index += 1

        # Extremely defensive fallback.
        import uuid

        return f"scan_{uuid.uuid4().hex}.{ext}"
    
    def get_status(self) -> Dict[str, Any]:
        """Get current scanner status with diagnostic information"""
        return {
            **self.status,
            'platform': PLATFORM,
            'scanner_type': self.scanner or 'none',
            'config': {
                'max_retries': self.config['max_retries'],
                'device_cache_ttl': self.config['device_cache_ttl'],
                'network_discovery_timeout': self.config['network_discovery_timeout'],
            },
            'diagnostics': {
                'twain_available': self.scanner == 'twain',
                'sane_available': self.scanner == 'sane',
                'zeroconf_available': self._is_zeroconf_available(),
            }
        }
    
    def _is_zeroconf_available(self) -> bool:
        """Check if zeroconf is available for network discovery"""
        try:
            import zeroconf
            return True
        except ImportError:
            return False
    
    def cancel_scan(self):
        """Cancel current scan operation"""
        self.status['cancelled'] = True
        self.status['scanning'] = False
        return {'success': True, 'message': 'Scan cancelled'}
