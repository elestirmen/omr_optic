# OMRChecker - Optik İşaretleme Okuma Sistemi

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.8+-blue.svg" alt="Python 3.8+">
  <img src="https://img.shields.io/badge/OpenCV-4.0+-green.svg" alt="OpenCV 4.0+">
  <img src="https://img.shields.io/badge/Flask-2.3+-red.svg" alt="Flask 2.3+">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT License">
</p>

OMR (Optik İşaretleme Tanıma) formlarını tarayıcı 🖨️ veya telefon kameranız 📱 ile hızlı ve doğru şekilde okuyun. Bu proje, sınav kağıtlarını, anketleri ve diğer OMR formlarını otomatik olarak değerlendirmenizi sağlar.

---

## 📋 İçindekiler

- [OMRChecker - Optik İşaretleme Okuma Sistemi](#omrchecker---optik-işaretleme-okuma-sistemi)
  - [📋 İçindekiler](#-i̇çindekiler)
  - [🎯 Özellikler](#-özellikler)
  - [🖼️ Ekran Görüntüleri](#️-ekran-görüntüleri)
  - [💻 Sistem Gereksinimleri](#-sistem-gereksinimleri)
  - [🔧 Kurulum](#-kurulum)
    - [Windows Kurulumu](#windows-kurulumu)
    - [Linux Kurulumu](#linux-kurulumu)
    - [macOS Kurulumu](#macos-kurulumu)
  - [🚀 Kullanım](#-kullanım)
    - [Komut Satırı Kullanımı (CLI)](#komut-satırı-kullanımı-cli)
    - [Web Arayüzü Kullanımı](#web-arayüzü-kullanımı)
  - [📁 Proje Yapısı](#-proje-yapısı)
  - [⚙️ Yapılandırma Dosyaları](#️-yapılandırma-dosyaları)
    - [template.json](#templatejson)
    - [config.json](#configjson)
    - [evaluation.json](#evaluationjson)
  - [🎨 Şablon Oluşturma (Template Editor)](#-şablon-oluşturma-template-editor)
  - [📊 Sonuçlar ve Çıktılar](#-sonuçlar-ve-çıktılar)
  - [❓ Sık Sorulan Sorular (SSS)](#-sık-sorulan-sorular-sss)
  - [🐛 Sorun Giderme](#-sorun-giderme)
  - [🤝 Katkıda Bulunma](#-katkıda-bulunma)
  - [📜 Lisans](#-lisans)
  - [🙏 Teşekkürler](#-teşekkürler)

---

## 🎯 Özellikler

| Özellik | Açıklama |
|---------|----------|
| 💯 **Yüksek Doğruluk** | Kaliteli tarama görsellerinde %100'e yakın doğruluk, mobil fotoğraflarda %90+ doğruluk |
| 💪 **Sağlam Yapı** | Düşük çözünürlük, eğik açı, fotokopi gibi zorlu koşullarda bile çalışır |
| ⚡ **Hızlı İşleme** | Dakikada 200+ OMR formu işleyebilir |
| 🎨 **Özelleştirilebilir** | Her türlü OMR şablonu için kolayca yapılandırılabilir |
| 🖥️ **Web Arayüzü** | Kullanıcı dostu web tabanlı arayüz |
| 📷 **Tarayıcı Desteği** | TWAIN (Windows) ve SANE (Linux) tarayıcı desteği |
| 📝 **Şablon Editörü** | Görsel şablon oluşturma aracı |
| 📊 **Detaylı Raporlama** | CSV, Excel ve görsel çıktılar |

---

## 🖼️ Ekran Görüntüleri

### İşleme Adımları
<p align="center">
  <img alt="Processing Steps" width="650" src="https://raw.githubusercontent.com/wiki/Udayraj123/OMRChecker/extras/Progress/2019-04-26/images/rotation.PNG">
  <br><em>Görüntü işleme adımları (döndürme, kırpma, analiz)</em>
</p>

### CSV Çıktısı
<p align="center">
  <img alt="CSV Output" width="550" src="https://raw.githubusercontent.com/wiki/Udayraj123/OMRChecker/extras/Progress/2019-04-26/images/csv_output.PNG">
  <br><em>Excel/CSV formatında sonuç çıktısı</em>
</p>

### Renkli Değerlendirme Çıktısı
<p align="center">
  <img alt="Colored Output" width="550" src="./docs/assets/colored_output.jpg">
  <br><em>Doğru/yanlış işaretlenmiş görsel çıktı</em>
</p>

---

## 💻 Sistem Gereksinimleri

| Gereksinim | Minimum | Önerilen |
|------------|---------|----------|
| **İşletim Sistemi** | Windows 10, Ubuntu 18.04, macOS 10.14 | Windows 11, Ubuntu 22.04, macOS 12+ |
| **Python** | 3.8 | 3.10+ |
| **RAM** | 4 GB | 8 GB+ |
| **Depolama** | 500 MB | 1 GB+ |
| **OpenCV** | 4.0 | 4.5+ |

---

## 🔧 Kurulum

### Windows Kurulumu

#### 1. Python Kurulumu

1. [Python resmi sitesinden](https://www.python.org/downloads/windows/) Python 3.10+ indirin
2. Kurulum sırasında **"Add Python to PATH"** seçeneğini işaretleyin
3. Kurulumu tamamlayın

PowerShell veya CMD'de kontrol edin:
```powershell
python --version
pip --version
```

#### 2. Projeyi İndirme

```powershell
# Git ile indirme (önerilen)
git clone https://github.com/Udayraj123/OMRChecker.git
cd OMRChecker

# VEYA ZIP olarak indirip çıkartın
```

#### 3. Sanal Ortam Oluşturma (Önerilen)

```powershell
# Sanal ortam oluştur
python -m venv venv

# Sanal ortamı aktifleştir
.\venv\Scripts\activate

# Aktifleştirildiğinde prompt'ta (venv) görünür
```

#### 4. Temel Bağımlılıkları Yükleme

```powershell
# pip'i güncelle
python -m pip install --upgrade pip

# OpenCV yükle
pip install opencv-python opencv-contrib-python

# Proje bağımlılıklarını yükle
pip install -r requirements.txt
```

#### 5. Web Arayüzü Bağımlılıklarını Yükleme (Opsiyonel)

```powershell
pip install -r web/requirements.txt
```

#### 6. Kurulumu Test Etme

```powershell
# Örnek veri ile test
python main.py -i samples/sample1
```

---

### Linux Kurulumu

#### Ubuntu/Debian

##### 1. Sistem Bağımlılıklarını Yükleme

```bash
# Sistem güncellemesi
sudo apt update && sudo apt upgrade -y

# Python ve pip yükle
sudo apt install -y python3 python3-pip python3-venv

# OpenCV için gerekli sistem kütüphaneleri
sudo apt install -y build-essential cmake unzip pkg-config
sudo apt install -y libjpeg-dev libpng-dev libtiff-dev
sudo apt install -y libavcodec-dev libavformat-dev libswscale-dev libv4l-dev
sudo apt install -y libatlas-base-dev gfortran

# Git yükle (eğer yoksa)
sudo apt install -y git
```

##### 2. Projeyi İndirme

```bash
git clone https://github.com/Udayraj123/OMRChecker.git
cd OMRChecker
```

##### 3. Sanal Ortam Oluşturma

```bash
# Sanal ortam oluştur
python3 -m venv venv

# Aktifleştir
source venv/bin/activate
```

##### 4. Bağımlılıkları Yükleme

```bash
# pip'i güncelle
pip install --upgrade pip

# OpenCV yükle
pip install opencv-python opencv-contrib-python

# Proje bağımlılıklarını yükle
pip install -r requirements.txt
```

##### 5. Web Arayüzü Bağımlılıklarını Yükleme (Opsiyonel)

```bash
pip install -r web/requirements.txt

# SANE tarayıcı desteği için (opsiyonel)
sudo apt install -y sane sane-utils libsane-dev
pip install python-sane
```

##### 6. Kurulumu Test Etme

```bash
python3 main.py -i samples/sample1
```

#### Fedora/CentOS/RHEL

```bash
# Sistem bağımlılıkları
sudo dnf install -y python3 python3-pip python3-devel
sudo dnf install -y gcc cmake make
sudo dnf install -y libjpeg-turbo-devel libpng-devel libtiff-devel
sudo dnf install -y ffmpeg-devel
sudo dnf install -y atlas-devel

# Projeyi indirip kurulum
git clone https://github.com/Udayraj123/OMRChecker.git
cd OMRChecker
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

#### Arch Linux

```bash
# Sistem bağımlılıkları
sudo pacman -S python python-pip opencv hdf5

# Projeyi indirip kurulum
git clone https://github.com/Udayraj123/OMRChecker.git
cd OMRChecker
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

### macOS Kurulumu

#### 1. Homebrew ve Python Kurulumu

```bash
# Homebrew yükle (eğer yoksa)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Python yükle
brew install python@3.10
```

#### 2. Projeyi İndirme ve Kurulum

```bash
git clone https://github.com/Udayraj123/OMRChecker.git
cd OMRChecker

# Sanal ortam
python3 -m venv venv
source venv/bin/activate

# Bağımlılıklar
pip install --upgrade pip
pip install opencv-python opencv-contrib-python
pip install -r requirements.txt
```

---

## 🚀 Kullanım

### Komut Satırı Kullanımı (CLI)

#### Temel Kullanım

```bash
# Varsayılan inputs/ klasöründeki görüntüleri işle
python main.py

# Belirli bir klasörü işle
python main.py -i <klasör_yolu>

# Çoklu klasör işle
python main.py -i klasör1 klasör2 klasör3

# Çıktı klasörünü belirle
python main.py -i inputs -o sonuçlar
```

#### Tüm Komut Satırı Seçenekleri

| Parametre | Kısa | Açıklama |
|-----------|------|----------|
| `--inputDir` | `-i` | Girdi klasörü yolu (varsayılan: `inputs/`) |
| `--outputDir` | `-o` | Çıktı klasörü yolu (varsayılan: `outputs/`) |
| `--setLayout` | `-l` | Şablon düzenleme modu (template.json ayarları için) |
| `--autoAlign` | `-a` | Otomatik hizalama (deneysel) |
| `--debug` | `-d` | Hata ayıklama modu |

#### Örnek Kullanım Senaryoları

**1. Örnek verilerle test:**
```bash
# Sample1 - Temel OMR formu
python main.py -i samples/sample1

# Sample3 - Özel şablon
python main.py -i samples/sample3

# Sample5 - Çoklu sayfa
python main.py -i samples/sample5
```

**2. Kendi formlarınızı işleme:**
```bash
# Klasör hazırla
mkdir -p inputs/sinavim

# Görüntüleri kopyala (JPG, PNG, JPEG desteklenir)
cp /path/to/taramalar/*.jpg inputs/sinavim/

# template.json dosyasını oluştur veya kopyala
cp samples/sample1/template.json inputs/sinavim/

# İşle
python main.py -i inputs/sinavim
```

**3. Şablon ayarlama modu:**
```bash
# Şablonu adım adım ayarla
python main.py -i inputs/sinavim --setLayout
```

**4. Detaylı hata ayıklama:**
```bash
python main.py -i inputs/sinavim --debug
```

---

### Web Arayüzü Kullanımı

Web arayüzü, tarayıcı desteği, şablon editörü ve sonuç görüntüleme gibi gelişmiş özellikler sunar.

#### Web Sunucusunu Başlatma

```bash
# Web klasörüne git
cd web

# Sunucuyu başlat
python app.py
```

Sunucu başladıktan sonra tarayıcınızda açın:
- **Ana Sayfa:** http://localhost:5000
- **Tarayıcı:** http://localhost:5000/scanner.html
- **Şablon Editörü:** http://localhost:5000/template-editor.html
- **İşleme:** http://localhost:5000/process.html

#### Ortam Değişkenleri

```bash
# Port değiştirme (varsayılan: 5000)
set OMR_WEB_PORT=8080       # Windows
export OMR_WEB_PORT=8080    # Linux/macOS

# Debug modu
set OMR_WEB_DEBUG=true      # Windows
export OMR_WEB_DEBUG=true   # Linux/macOS
```

#### Web Arayüzü Özellikleri

| Sayfa | Özellik |
|-------|---------|
| **Ana Sayfa** | Hızlı başlangıç ve navigasyon |
| **Tarayıcı (Scanner)** | TWAIN/SANE tarayıcı ile doğrudan tarama |
| **İşleme (Process)** | Dosya yükleme ve toplu işleme |
| **Şablon Editörü** | Görsel şablon oluşturma ve düzenleme |
| **Şablonlar** | Kayıtlı şablonları yönetme |

#### Tarayıcı Kullanımı

**Windows (TWAIN):**
1. Tarayıcınızı bilgisayara bağlayın
2. Web arayüzünde "Tarayıcı" sayfasına gidin
3. "Tarayıcı Listele" ile cihazları görün
4. Tarayıcı seçip "Tara" butonuna tıklayın
5. ADF (Otomatik Belge Besleyici) varsa seçebilirsiniz

**Linux (SANE):**
1. SANE kurulumunu yapın: `sudo apt install sane sane-utils`
2. Tarayıcı izinlerini ayarlayın: `sudo adduser $USER scanner`
3. Web arayüzünden tarama yapın

---

## 📁 Proje Yapısı

```
OMRChecker/
├── main.py                 # Ana giriş noktası (CLI)
├── requirements.txt        # Python bağımlılıkları
├── pyproject.toml          # Proje yapılandırması
│
├── src/                    # Kaynak kod
│   ├── core.py             # Ana işleme mantığı
│   ├── entry.py            # Giriş noktası fonksiyonları
│   ├── evaluation.py       # Değerlendirme/puanlama
│   ├── template.py         # Şablon işleme
│   ├── logger.py           # Loglama
│   ├── constants/          # Sabitler
│   ├── defaults/           # Varsayılan değerler
│   ├── processors/         # Görüntü işleyicileri
│   │   ├── CropPage.py     # Sayfa kırpma
│   │   └── CropOnMarkers.py# Marker ile kırpma
│   ├── schemas/            # JSON şema doğrulama
│   └── utils/              # Yardımcı fonksiyonlar
│
├── web/                    # Web arayüzü
│   ├── app.py              # Flask sunucusu
│   ├── requirements.txt    # Web bağımlılıkları
│   ├── static/             # Statik dosyalar
│   │   ├── css/            # Stiller
│   │   ├── js/             # JavaScript
│   │   ├── index.html      # Ana sayfa
│   │   ├── scanner.html    # Tarayıcı sayfası
│   │   ├── process.html    # İşleme sayfası
│   │   └── template-editor.html  # Şablon editörü
│   └── services/           # Servis modülleri
│       ├── omr_service.py  # OMR işleme servisi
│       └── scanner_service.py  # Tarayıcı servisi
│
├── samples/                # Örnek şablonlar
│   ├── sample1/            # Temel OMR örneği
│   ├── sample2/            # İleri düzey örnek
│   ├── sample3/            # Özel alan örneği
│   ├── sample4-6/          # Diğer örnekler
│   ├── answer-key/         # Cevap anahtarı örnekleri
│   └── community/          # Topluluk şablonları
│
├── inputs/                 # Girdi klasörü (formlarınızı buraya koyun)
├── outputs/                # Çıktı klasörü (sonuçlar burada)
└── docs/                   # Dokümantasyon
```

---

## ⚙️ Yapılandırma Dosyaları

Her OMR projesi için üç ana yapılandırma dosyası kullanılır:

### template.json

Şablon dosyası, OMR formunun fiziksel düzenini tanımlar.

```json
{
  "pageDimensions": [1846, 1500],
  "bubbleDimensions": [40, 40],
  "fieldBlocks": {
    "Roll": {
      "fieldType": "QTYPE_INT",
      "fieldLabels": ["roll1..9"],
      "bubblesGap": 46,
      "labelsGap": 58,
      "origin": [225, 282]
    },
    "MCQ_Block_Q1": {
      "fieldType": "QTYPE_MCQ4",
      "fieldLabels": ["q1..4"],
      "bubblesGap": 59,
      "labelsGap": 50,
      "origin": [121, 860]
    }
  },
  "preProcessors": [
    {
      "name": "CropPage",
      "options": {
        "morphKernel": [10, 10]
      }
    },
    {
      "name": "CropOnMarkers",
      "options": {
        "relativePath": "omr_marker.jpg",
        "sheetToMarkerWidthRatio": 17
      }
    }
  ]
}
```

#### Şablon Parametreleri

| Parametre | Tür | Açıklama |
|-----------|-----|----------|
| `pageDimensions` | [genişlik, yükseklik] | Sayfa boyutları (piksel) |
| `bubbleDimensions` | [genişlik, yükseklik] | Baloncuk boyutları |
| `fieldBlocks` | object | Alan blokları tanımları |
| `preProcessors` | array | Ön işleme adımları |
| `customLabels` | object | Özel etiket tanımları |

#### Alan Türleri (fieldType)

| Tür | Açıklama | Değerler |
|-----|----------|----------|
| `QTYPE_MCQ4` | 4 seçenekli çoktan seçmeli | A, B, C, D |
| `QTYPE_MCQ5` | 5 seçenekli çoktan seçmeli | A, B, C, D, E |
| `QTYPE_INT` | Sayısal değer | 0-9 |
| `QTYPE_ALPHA` | Alfabetik | A-Z |

#### Alan Bloğu Parametreleri

| Parametre | Açıklama |
|-----------|----------|
| `origin` | [x, y] - Bloğun başlangıç koordinatı |
| `fieldLabels` | Alan etiketleri (örn: "q1..10" = q1, q2, ... q10) |
| `bubblesGap` | Baloncuklar arası yatay boşluk |
| `labelsGap` | Satırlar arası dikey boşluk |
| `direction` | "horizontal" veya "vertical" |
| `bubbleValues` | Özel baloncuk değerleri |

---

### config.json

Görüntü işleme parametrelerini yapılandırır.

```json
{
  "dimensions": {
    "display_height": 2480,
    "display_width": 1640,
    "processing_height": 820,
    "processing_width": 666
  },
  "outputs": {
    "show_image_level": 5
  }
}
```

| Parametre | Açıklama |
|-----------|----------|
| `display_height/width` | Görüntüleme boyutları |
| `processing_height/width` | İşleme boyutları |
| `show_image_level` | Görsel çıktı detay seviyesi (0-6) |

---

### evaluation.json

Değerlendirme ve puanlama ayarlarını tanımlar.

```json
{
  "source_type": "csv",
  "options": {
    "answer_key_csv_path": "answer_key.csv",
    "should_explain_scoring": true
  },
  "marking_schemes": {
    "DEFAULT": {
      "correct": "1",
      "incorrect": "0",
      "unmarked": "0"
    }
  }
}
```

#### Puanlama Seçenekleri

| Parametre | Açıklama |
|-----------|----------|
| `source_type` | "csv" veya "local" |
| `answer_key_csv_path` | Cevap anahtarı CSV dosyası |
| `marking_schemes` | Puanlama şemaları |
| `correct` | Doğru cevap puanı |
| `incorrect` | Yanlış cevap puanı (negatif olabilir) |
| `unmarked` | Boş bırakılan puanı |

**Cevap Anahtarı CSV Formatı:**
```csv
q1,q2,q3,q4,q5
A,B,C,D,A
```

---

## 🎨 Şablon Oluşturma (Template Editor)

Web arayüzündeki Şablon Editörü, görsel olarak OMR şablonları oluşturmanızı sağlar.

### Şablon Editörü Kullanımı

1. **Web sunucusunu başlatın:**
   ```bash
   cd web
   python app.py
   ```

2. **Şablon editörünü açın:**
   http://localhost:5000/template-editor.html

3. **Boş bir OMR formu yükleyin:**
   - "Görsel Seç" butonu ile formunuzu yükleyin
   - Görüntü canvas üzerinde görünecektir

4. **Alan blokları ekleyin:**
   - Canvas üzerinde fare ile sürükleyerek alan seçin
   - Sağ panelde alan özelliklerini ayarlayın:
     - **Alan Adı:** Benzersiz alan ismi
     - **Alan Türü:** MCQ4, MCQ5, INT, ALPHA
     - **Satır Sayısı:** Soru sayısı
     - **Sütun Sayısı:** Seçenek sayısı
     - **Baloncuk Boyutu:** Genişlik x Yükseklik

5. **İnce ayar yapın:**
   - Koordinatları elle düzenleyin
   - Boşlukları ayarlayın
   - Önizleme ile kontrol edin

6. **Şablonu kaydedin:**
   - "Kaydet" butonu ile template.json oluşturun
   - samples/ klasörüne yeni şablon kaydedin

### Şablon Oluşturma İpuçları

- ✅ Yüksek çözünürlüklü tarama kullanın (300 DPI önerilen)
- ✅ Düz ve gölgesiz tarama yapın
- ✅ Marker'ları (köşe işaretleri) net tutun
- ✅ Önce küçük bir örnekle test edin
- ❌ Eğri veya buruşuk formlar kullanmayın
- ❌ Çok düşük çözünürlük kullanmayın

---

## 📊 Sonuçlar ve Çıktılar

İşleme sonrasında `outputs/` klasöründe şu dosyalar oluşur:

| Dosya | Açıklama |
|-------|----------|
| `Results_*.csv` | Tüm sonuçları içeren CSV dosyası |
| `MultiMarked/` | Birden fazla işaretlenen formlar |
| `Errors/` | Hatalı işlenen formlar |
| `CheckedOMRs/` | İşaretlenmiş görsel çıktılar |

### CSV Çıktı Formatı

```csv
file_id,Roll,q1,q2,q3,q4,q5,...,score
form1.jpg,123456789,A,B,C,D,A,...,85
form2.jpg,123456790,B,B,C,A,D,...,75
```

### Görsel Çıktılar

- **Yeşil:** Doğru işaretleme
- **Kırmızı:** Yanlış işaretleme
- **Mavi:** Algılanan işaretleme
- **Sarı:** Çoklu işaretleme

---

## ❓ Sık Sorulan Sorular (SSS)

<details>
<summary><b>1. Hangi görüntü formatları destekleniyor?</b></summary>

JPG, JPEG, PNG, BMP, TIFF formatları desteklenir. Önerilen format JPG'dir.
</details>

<details>
<summary><b>2. Minimum görüntü çözünürlüğü nedir?</b></summary>

Minimum 640x480 piksel. Önerilen 1500x2000 piksel veya üzeri (300 DPI tarama).
</details>

<details>
<summary><b>3. Mobil kamera ile çekilen fotoğraflar kullanılabilir mi?</b></summary>

Evet! Ancak şu noktalara dikkat edin:
- Formu düz tutun ve paralaks hatası oluşturmayın
- İyi aydınlatma kullanın
- Yeterli çözünürlükte çekin
</details>

<details>
<summary><b>4. Eğik taranmış formlar düzeltilebilir mi?</b></summary>

Evet, `CropOnMarkers` preprocessor otomatik olarak eğriyi düzeltir. Bunun için formunuzda marker'lar (köşe işaretleri) olmalıdır.
</details>

<details>
<summary><b>5. Kendi OMR formumu nasıl tasarlarım?</b></summary>

1. Tutarlı baloncuk boyutları kullanın
2. Köşelere marker (kare veya daire) ekleyin
3. Baloncuklar arası mesafeyi eşit tutun
4. Yüksek kontrast renkler kullanın (siyah-beyaz ideal)
</details>

<details>
<summary><b>6. Yazılım ücretsiz mi?</b></summary>

Evet! MIT lisansı ile tamamen ücretsiz ve açık kaynaklıdır.
</details>

---

## 🐛 Sorun Giderme

### Windows Sorunları

<details>
<summary><b>ERROR: Could not open requirements file</b></summary>

**Çözüm:**
```powershell
# Dosya yolunu tam belirtin
pip install -r C:\path\to\OMRChecker\requirements.txt

# VEYA klasörde olduğunuzdan emin olun
cd C:\path\to\OMRChecker
pip install -r requirements.txt
```
</details>

<details>
<summary><b>python3 komutu bulunamıyor</b></summary>

**Çözüm:** Windows'ta `python3` yerine `python` kullanın:
```powershell
python main.py -i samples/sample1
```
</details>

<details>
<summary><b>TWAIN tarayıcı görünmüyor</b></summary>

**Çözüm:**
1. Tarayıcı sürücüsünün yüklü olduğundan emin olun
2. 32-bit Python kullanıyorsanız 32-bit sürücü, 64-bit için 64-bit sürücü gerekir
3. pytwain paketini yeniden yükleyin: `pip install --upgrade pytwain`
</details>

### Linux Sorunları

<details>
<summary><b>No module named pip</b></summary>

**Çözüm:**
```bash
sudo apt install python3-pip
# veya
curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
python3 get-pip.py
```
</details>

<details>
<summary><b>OpenCV import hatası</b></summary>

**Çözüm:**
```bash
# Eksik kütüphaneleri yükleyin
sudo apt install libgl1-mesa-glx libglib2.0-0

# OpenCV'yi yeniden yükleyin
pip uninstall opencv-python opencv-contrib-python
pip install opencv-python opencv-contrib-python
```
</details>

<details>
<summary><b>SANE tarayıcı izin hatası</b></summary>

**Çözüm:**
```bash
# Kullanıcıyı scanner grubuna ekle
sudo usermod -aG scanner $USER

# Oturumu kapatıp açın veya
newgrp scanner
```
</details>

### Genel Sorunlar

<details>
<summary><b>Boş sonuç çıktısı</b></summary>

**Olası nedenler:**
1. Şablon koordinatları yanlış
2. Görüntü boyutu uyumsuz
3. Baloncuklar algılanmıyor

**Çözüm:**
1. `--setLayout` ile şablonu kontrol edin
2. `show_image_level: 6` ile detaylı görsel çıktı alın
3. Görüntü boyutlarını template.json ile eşleştirin
</details>

<details>
<summary><b>Düşük doğruluk oranı</b></summary>

**İyileştirme önerileri:**
1. Daha yüksek çözünürlük kullanın
2. Tarama kalitesini artırın
3. Şablon koordinatlarını ince ayar yapın
4. Eşik değerlerini ayarlayın
</details>

---

## 🤝 Katkıda Bulunma

Projeye katkıda bulunmak için:

1. Projeyi fork edin
2. Feature branch oluşturun: `git checkout -b feature/yeni-ozellik`
3. Değişikliklerinizi commit edin: `git commit -am 'Yeni özellik eklendi'`
4. Branch'i push edin: `git push origin feature/yeni-ozellik`
5. Pull Request oluşturun

Detaylı bilgi için [CONTRIBUTING.md](CONTRIBUTING.md) dosyasını inceleyin.

### Geliştirici Kurulumu

```bash
# Geliştirme bağımlılıklarını yükle
pip install -r requirements.dev.txt

# Pre-commit hookları ayarla
pre-commit install

# Testleri çalıştır
pytest

# Kod stilini kontrol et
pylint src/
black --check .
```

---

## 📜 Lisans

Bu proje [MIT Lisansı](LICENSE) altında yayınlanmıştır.

```
MIT License

Copyright (c) 2019 Udayraj Deshmukh

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

---

## 🙏 Teşekkürler

Bu projenin geliştirilmesinde emeği geçen herkese teşekkürler:

- **Adrian Rosebrock** - [PyImageSearch](https://pyimagesearch.com)
- **Harrison Kinsley (Sentdex)** - Video eğitimleri
- **Satya Mallic** - [LearnOpenCV](https://www.learnopencv.com)
- Tüm katkıda bulunanlar ve topluluk üyeleri

<a href="https://github.com/Udayraj123/OMRChecker/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Udayraj123/OMRChecker" />
</a>

---

<p align="center">
  <b>⭐ Bu projeyi beğendiyseniz yıldız vermeyi unutmayın! ⭐</b>
</p>

<p align="center">
  <a href="https://github.com/Udayraj123/OMRChecker/issues">Hata Bildir</a> •
  <a href="https://github.com/Udayraj123/OMRChecker/discussions">Tartışma</a> •
  <a href="https://discord.gg/qFv2Vqf">Discord</a>
</p>
