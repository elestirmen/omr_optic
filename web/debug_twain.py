import twain
import platform
import ctypes
from ctypes import wintypes
import sys

def create_hidden_window():
    try:
        user32 = ctypes.windll.user32
        kernel32 = ctypes.windll.kernel32

        kernel32.GetModuleHandleW.argtypes = [wintypes.LPCWSTR]
        kernel32.GetModuleHandleW.restype = wintypes.HINSTANCE

        user32.CreateWindowExW.argtypes = [
            wintypes.DWORD, wintypes.LPCWSTR, wintypes.LPCWSTR, wintypes.DWORD,
            ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
            wintypes.HWND, wintypes.HMENU, wintypes.HINSTANCE, wintypes.LPVOID,
        ]
        user32.CreateWindowExW.restype = wintypes.HWND

        h_instance = kernel32.GetModuleHandleW(None)
        hwnd = user32.CreateWindowExW(
            0, "STATIC", "OMRChecker_Debug", 
            0, 0, 0, 0, 0, 
            0, 0, h_instance, None
        )
        return int(hwnd) if hwnd else 0
    except Exception as e:
        print(f"Window creation failed: {e}")
        return 0

hwnd = create_hidden_window()
print(f"Created window handle: {hwnd}")

try:
    print(f"\nInitializing SourceManager(hwnd={hwnd})...")
    sm = twain.SourceManager(hwnd)
    sources = sm.GetSourceList()
    print(f"Sources found: {len(sources)}")
    for i, source in enumerate(sources):
        print(f"[{i}] {source}")
    
    sm.destroy()
except Exception as e:
    print(f"Error: {e}")

if hwnd:
    try:
        ctypes.windll.user32.DestroyWindow(wintypes.HWND(hwnd))
    except:
        pass
