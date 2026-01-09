"""Test script to check Windows printer names"""
import win32print

print("=" * 60)
print("Windows Printers:")
print("=" * 60)

printers = win32print.EnumPrinters(
    win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS,
    None,
    2
)

for p in printers:
    print(f"  Name: {p['pPrinterName']}")
    print(f"  Driver: {p.get('pDriverName', 'N/A')}")
    print("-" * 40)

print("\n" + "=" * 60)
print("Testing TWAIN sources:")
print("=" * 60)

try:
    import twain
    sm = twain.SourceManager(0)
    sources = sm.GetSourceList() or []
    print(f"TWAIN Sources: {sources}")
    sm.close()
except Exception as e:
    print(f"TWAIN error: {e}")

