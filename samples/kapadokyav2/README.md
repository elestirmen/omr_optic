# Kapadokya Üniversitesi OMR Şablonu v2

## İyileştirmeler

Bu şablon, orijinal Kapadokya şablonunun iyileştirilmiş versiyonudur.

### Değişiklikler:

1. **Çift Hizalama Sistemi**
   - CropOnMarkers: Form kenarlarındaki marker'ları kullanarak kırpma
   - FeatureBasedAlignment: Özellik tabanlı hassas hizalama (2D mod aktif)

2. **Daha Hassas Koordinatlar**
   - Bubble boyutu: 38x38 piksel (görsel analizi sonrası)
   - Gap değerleri: 49 piksel (daha hassas ölçüm)
   - Her alan için optimize edilmiş origin koordinatları

3. **Gelişmiş Özellik Eşleştirme**
   - maxFeatures: 10000 (daha fazla özellik noktası)
   - goodMatchPercent: 0.20 (daha seçici eşleştirme)
   - 2D hizalama aktif

4. **Öğrenci No: 9 Hane**
   - Form üzerindeki gerçek yapıya uygun

## Form Alanları

| Alan | Tip | Hane |
|------|-----|------|
| Ad Soyad | TR Alfabe | 20 karakter |
| TC Kimlik No | Sayısal | 11 hane |
| Öğrenci No | Sayısal | 9 hane |
| Test Soruları | MCQ5 (A-E) | 120 soru |
| Kitapçık Türü | MCQ4 (A-D) | 1 |
| Alan Kodu | Sayısal | 3 hane |
| Telefon No | Sayısal | 7 hane |

## Kullanım

```bash
python main.py --inputDir samples/kapadokyav2
```

## Notlar

- Template image olarak boş form kullanılmalıdır
- 300 DPI tarama önerilir
- Sayfa boyutu: 2481x3506 piksel (A4 @ 300 DPI)
