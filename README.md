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
| 🔢 **Puanlama Sistemi** | Esnek cevap anahtarı ve özelleştirilebilir puanlama |
| 🔍 **Kopya Tespiti** | Harpp-Hogan indeksi ile otomatik kopya analizi |

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

#### 4. Bağımlılıkları Yükleme

```powershell
# pip'i güncelle
python -m pip install --upgrade pip

# Tüm bağımlılıkları yükle (OpenCV, Flask, vb. dahil)
pip install -r requirements.txt
```

#### 5. Kurulumu Test Etme

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

# Tüm bağımlılıkları yükle (OpenCV, Flask, vb. dahil)
pip install -r requirements.txt
```

##### 5. SANE Tarayıcı Desteği (Opsiyonel)

```bash
# SANE tarayıcı desteği için
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

Web arayüzü, tarayıcı desteği, şablon editörü ve sonuç görüntüleme gibi gelişmiş özellikler sunar. Tamamen Türkçe arayüze sahiptir.

#### Web Sunucusunu Başlatma

```bash
# ana dizinde olduğunuzdan emin olun
cd OMRChecker

# Web klasörüne git
cd web

# Sunucuyu başlat
python app.py
```

Başarılı başlatma sonrası konsol çıktısı:
```
==================================================
OMRChecker Web Interface
==================================================
Serving on: http://localhost:5000
Upload folder: web/uploads
Results folder: web/results
==================================================
```

#### Web Arayüzü Sayfaları

| URL | Sayfa | Açıklama |
|-----|-------|----------|
| http://localhost:5000 | **Ana Sayfa** | Hızlı başlangıç ve özellik tanıtımı |
| http://localhost:5000/process.html | **OMR İşleme** | Dosya yükleme ve işleme |
| http://localhost:5000/scanner.html | **Tarayıcı** | Tarayıcıdan doğrudan tarama |
| http://localhost:5000/templates.html | **Şablonlar** | Şablon yönetimi |
| http://localhost:5000/template-editor.html | **Şablon Editörü** | Yeni şablon oluşturma |
| http://localhost:5000/analysis.html | **Sonuç Analizi** | Puanlama, cevap anahtarı ve kopya tespiti |

#### Ortam Değişkenleri

```bash
# Port değiştirme (varsayılan: 5000)
set OMR_WEB_PORT=8080       # Windows
export OMR_WEB_PORT=8080    # Linux/macOS

# Debug modu
set OMR_WEB_DEBUG=true      # Windows
export OMR_WEB_DEBUG=true   # Linux/macOS
```

---

### 🌐 Web Arayüzü Detaylı Kullanım Kılavuzu

#### 1. Ana Sayfa (index.html)

Ana sayfa şu bilgileri ve işlevleri sunar:

**İstatistikler:**
- Toplam işlenen form sayısı
- Bugün işlenen form sayısı
- Doğruluk oranı

**Hızlı İşlemler:**
- 📤 **Dosya Yükle** - OMR formlarını sürükle-bırak ile yükle
- 🖨️ **Tarayıcı Kullan** - Bağlı tarayıcıdan otomatik tara ve işle
- 📝 **Şablon Yönetimi** - Şablonları görüntüle ve düzenle

**Özellikler Listesi:**
- 🎯 Yüksek Doğruluk (%99+)
- ⚡ Hızlı İşleme (200+ form/dk)
- 🖨️ Tarayıcı Desteği (ADF)
- 📱 Mobil Uyumlu
- 🎨 Esnek Şablonlar
- 📊 Excel Çıktısı

---

#### 2. OMR İşleme Sayfası (process.html)

Bu sayfa dosya yükleme ve toplu işleme için kullanılır.

**Adım 1: Şablon Seçimi**
1. "Şablon Seçin" açılır menüsünden uygun şablonu seçin
2. Şablonlar `samples/` klasöründen otomatik yüklenir

**Adım 2: Dosya Yükleme**

Üç yöntemle dosya yükleyebilirsiniz:

| Yöntem | Açıklama |
|--------|----------|
| **Sürükle-Bırak** | Dosyaları doğrudan yükleme alanına sürükleyin |
| **Dosya Seç** | Birden fazla dosya seçmek için butonu tıklayın |
| **Klasör Seç** | Tüm klasörü seçip içindeki tüm görselleri yükleyin |

**Desteklenen Formatlar:** JPG, JPEG, PNG, BMP, TIFF

**Adım 3: İşleme**
1. Yüklenen dosyalar listede görünür
2. "İşlemeyi Başlat" butonuna tıklayın
3. İlerleme çubuğu işlem durumunu gösterir

**Adım 4: Sonuçları Görüntüleme**
- **Sonuç Tablosu:** Tüm formların verileri tabloda görünür
- **İşlenmiş Görüntüler:** Her formun işaretlenmiş hali görüntülenebilir
- **CSV İndir:** Sonuçları Excel'e aktarmak için CSV indirin

**Sonuç Tablosu Örneği:**

| Dosya | Öğrenci No | Soru 1 | Soru 2 | ... | Puan |
|-------|------------|--------|--------|-----|------|
| form1.jpg | 1234567 | A | B | ... | 85 |
| form2.jpg | 1234568 | B | C | ... | 72 |

---

#### 3. Tarayıcı Sayfası (scanner.html)

Bu sayfa doğrudan tarayıcıdan OMR formlarını taramak ve işlemek için kullanılır.

**Tarayıcı Gereksinimleri:**

| İşletim Sistemi | Protokol | Kurulum |
|-----------------|----------|---------|
| **Windows** | TWAIN | Tarayıcı sürücüsü yeterli, `pytwain` paketi gerekli |
| **Linux** | SANE | `sane`, `sane-utils`, `python-sane` paketleri gerekli |

**Kullanım Adımları:**

**Adım 1: Tarayıcı Seçimi**
1. Sayfa açıldığında tarayıcılar otomatik listelenir
2. "🔄 Yenile" butonu ile listeyi güncelleyebilirsiniz
3. Açılır menüden tarayıcınızı seçin

**Tarayıcı Bilgileri (Görüntülenen):**
- **Platform:** Windows / Linux
- **Protokol:** TWAIN / SANE
- **ADF Desteği:** Var / Yok

**Adım 2: Tarama Ayarları**

| Seçenek | Açıklama |
|---------|----------|
| ☑️ **Otomatik Belge Besleyici (ADF) Kullan** | Birden fazla sayfa için etkinleştirin. Bu seçenek sayesinde tüm formlar sırayla taranır |
| ☑️ **Tarama Sonrası Otomatik İşle** | Tarama tamamlandığında formları otomatik olarak OMR sistemine gönderir |
| ☑️ **Tarayıcı arayüzünü göster** | Epson Scan gibi tarayıcı yazılımının arayüzünü gösterir. Kapatırsanız sessiz tarama yapılır (bazı sürücüler desteklemeyebilir) |
| **İşleme Şablonu** | Tarama sonrası kullanılacak OMR şablonu |

**Adım 3: Taramayı Başlatma**
1. "🖨️ Taramayı Başlat" butonuna tıklayın
2. ADF kullanılıyorsa tüm sayfalar sırayla taranır
3. İlerleme halka ile görsel olarak gösterilir
4. Taranan her sayfa küçük resim olarak görünür

**Adım 4: Sonuçları Alma**
- Tarama tamamlandığında otomatik işleme başlar
- Sonuçları görüntüle ve CSV olarak indirebilirsiniz

**İptal Etme:**
- Tarama sırasında "⏹️ İptal Et" butonu görünür
- Bu butona tıklayarak işlemi durdurabilirsiniz

---

#### 4. Şablonlar Sayfası (templates.html)

Bu sayfa mevcut şablonları listelemek ve yönetmek için kullanılır.

**Şablon Listesi:**
- Tüm şablonlar kart görünümünde listelenir
- Her kart şablon adını ve önizleme görselini gösterir

**Şablon Detayları (Modal pencere):**
Bir şablona tıkladığınızda detay penceresi açılır:

| Bölüm | Açıklama |
|-------|----------|
| **Sayfa Boyutları** | Genişlik x Yükseklik (piksel) |
| **Kabarcık Boyutları** | Kabarcık genişlik x yükseklik |
| **Alan Blokları** | Tüm tanımlı alanların listesi |
| **Ön İşlemciler** | CropPage, CropOnMarkers vb. |
| **JSON Yapısı** | Ham template.json içeriği |

**İşlemler:**
- **Kapat:** Modal pencereyi kapatır
- **Düzenle:** Şablon editöründe açar
- **Bu Şablonu Kullan:** OMR işleme sayfasına yönlendirir

**Yeni Şablon Oluşturma:**
- "➕ Yeni Şablon" butonu şablon editörünü açar

---

#### 5. Şablon Editörü (template-editor.html)

Bu sayfa görsel olarak yeni OMR şablonları oluşturmak için kullanılır. Gelişmiş bir editör arayüzüne sahiptir.

**Araç Çubuğu:**

| Araç | Açıklama |
|------|----------|
| 📷 **Görüntü Yükle** | Boş OMR formu görseli yükler |
| 🎯 **Alan Seç** | Açıkken sürükle-bırak ile alan seçilir |
| **Koordinat Göstergesi** | Fare konumu (X, Y) |
| ➖/➕ **Zoom** | Görüntüyü yakınlaştır/uzaklaştır |

**Sağ Panel Bölümleri:**

##### 📄 Sayfa Ayarları
- **Genişlik (px):** Sayfa genişliği
- **Yükseklik (px):** Sayfa yüksekliği
- **Kabarcık Boyutu (px):** Varsayılan kabarcık boyutu

##### 💡 İpuçları
1. 📷 Görüntü yükle
2. 🎯 Alan Seç açıkken sürükle-bırak ile alanı seç
3. 🎯 Kapalıyken bloklara tıkla-sürükle; ok tuşlarıyla ince ayar (Shift=5px)
4. 🔁 Test bloklarını "Hızlı Çoğaltma" ile kopyala
5. 🔗 Öğrenci no/TC gibi alanları "Birleştirilmiş Alanlar" ile tek sütun yap

##### Hızlı Alanlar (Preset'ler)
Tek tıkla hazır alan türleri:

| Preset | Açıklama |
|--------|----------|
| **Öğrenci No (7)** | 7 haneli öğrenci numarası |
| **TC Kimlik (11)** | 11 haneli TC kimlik numarası |
| **Ad/Soyad (12)** | 12 harflik isim alanı |
| **Test (1-30)** | 30 soruluk test bloğu |
| **Kitapçık** | A/B kitapçık türü |

##### Alan Bloğu Formu

**Temel Bilgiler:**
- **Blok Adı:** Benzersiz ad (örn: Sorular_1_30)
- **Alan Tipi:** MCQ5, MCQ4, Sayısal, Türk Alfabesi, Özel
- **Alan Etiketleri:** q1..30 veya ad1..12 formatında

**Alan Türleri:**

| Tür | Kod | Değerler |
|-----|-----|----------|
| MCQ 5 Seçenek | QTYPE_MCQ5 | A, B, C, D, E |
| MCQ 4 Seçenek | QTYPE_MCQ4 | A, B, C, D |
| Sayısal (0-9) | QTYPE_INT | 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 |
| Sayısal (1-0) | QTYPE_INT_FROM_1 | 1, 2, 3, 4, 5, 6, 7, 8, 9, 0 |
| Türk Alfabesi | QTYPE_TR_ALPHABET | A-Z ve Türkçe karakterler |
| Özel | CUSTOM | Virgülle ayrılmış değerler |

**Koordinat ve Boyut:**
- **Başlangıç X/Y:** Sol üst köşe koordinatları
- **Seçim Genişliği/Yüksekliği:** Alan boyutları

**Grid Ayarları:**
- **Kabarcık Sayısı:** Yatayda kaç seçenek (örn: 5 = A,B,C,D,E)
- **Satır Sayısı:** Dikeyde kaç soru/alan
- **Kabarcık Aralığı:** Yatay boşluk (piksel)
- **Satır Aralığı:** Dikey boşluk (piksel)
- **Otomatik Aralık Hesabı:** Açıkken boyutlara göre otomatik hesaplar

**Yön:**
- ↔️ **Yatay:** Seçenekler yan yana (A B C D E)
- ↕️ **Dikey:** Seçenekler alta doğru

##### 🔁 Hızlı Çoğaltma
Aynı bloğu kopyalayarak çoklu blok oluşturma:

| Parametre | Açıklama |
|-----------|----------|
| **Ek Kopya** | Kaç adet kopya (0-20) |
| **Etiket Kaydır** | Her kopyada etiket numarası artışı |
| **ΔX** | Her kopyada X ekseninde kayma |
| **ΔY** | Her kopyada Y ekseninde kayma |

**Örnek:** Test_1_30 bloğunu sağa doğru çoğaltma:
- Ek Kopya: 3
- Etiket Kaydır: 30 (q31..60, q61..90, q91..120 olur)
- ΔX: 190
- ΔY: 0

##### 📋 Eklenen Alanlar
Oluşturulan tüm blokların listesi:
- **Kırmızı kenarlık:** Normal blok
- **Yeşil kenarlık:** Aktif/seçili blok
- Her bloğun adı, türü ve koordinatları gösterilir
- Tıklayarak seçip düzenleyebilirsiniz
- 🗑️ butonu ile silebilirsiniz

##### 🔗 Birleştirilmiş Alanlar (Custom Labels)
Birden fazla sütunu tek bir değere birleştirme:

**Örnek Kullanım:**
- **Alan Adı:** Ogrenci_No
- **Etiketler:** ogrenci1..7

Bu, CSV çıktısında 7 ayrı sütun yerine tek "Ogrenci_No" sütunu oluşturur.

##### 📝 JSON Önizleme
Oluşturulan template.json dosyasının canlı önizlemesi.

**Şablonu Kaydetme:**
1. Üst barda şablon adını girin
2. "💾 Kaydet" butonuna tıklayın
3. Şablon samples/ klasörüne kaydedilir

---

#### 6. Sonuç Analizi Sayfası (analysis.html)

Bu sayfa OMR sonuçlarını analiz etmek, puanlamak ve kopya tespiti yapmak için kullanılır.

**Veri Kaynağı Seçimi:**

| Kaynak | Açıklama |
|--------|----------|
| **📂 Oturum** | Daha önce işlenmiş bir OMR oturumunu seçin |
| **📄 CSV** | Harici bir CSV dosyası yükleyin |

**Analiz Modları:**

##### 📝 Puanlama Modu

| Özellik | Açıklama |
|---------|----------|
| **Soru Sayısı** | Cevap anahtarındaki soru sayısı (1-200) |
| **Hızlı Doldurma** | "ABCDEABCDE..." şeklinde cevap dizisi girin |
| **Cevap Grid'i** | Her soru için A/B/C/D/E seçimi yapın |
| **Puanlama** | Doğru/Yanlış/Boş puanlarını ayarlayın |
| **Kayıtlı Anahtarlar** | Cevap anahtarlarını kaydedin ve yükleyin |

**Puanlama Sonuçları:**
- 📊 İstatistik kartları (Toplam öğrenci, ortalama, en yüksek, en düşük)
- 📋 Sıralı sonuç listesi (sıra, öğrenci no, puan, doğru/yanlış/boş)
- 📥 Excel indirme (otomatik kopya tespiti dahil)

##### 🔍 Kopya Tespit Modu

Harpp-Hogan İndeksi kullanarak potansiyel kopya çiftlerini tespit eder.

| Parametre | Varsayılan | Açıklama |
|-----------|------------|----------|
| **Harpp-Hogan Eşiği** | 1.0 | Bu değerin üzerindeki çiftler şüpheli |
| **Min. Ortak Yanlış** | 3 | Minimum aynı yanlış cevap sayısı |

**Kopya Tespit Sonuçları:**
- 👥 Şüpheli öğrenci çiftleri
- 📊 Harpp-Hogan İndeksi değeri
- 🔢 Ortak doğru/yanlış/boş sayıları
- 📥 Excel raporu indirme

---

#### API Endpoint'leri

Web arayüzü aşağıdaki REST API endpoint'lerini kullanır:

| Endpoint | Metod | Açıklama |
|----------|-------|----------|
| `/api/health` | GET | Sunucu durumu kontrolü |
| `/api/upload` | POST | Dosya yükleme |
| `/api/process` | POST | OMR işleme başlatma |
| `/api/process/single` | POST | Tek dosya yükle ve işle |
| `/api/results/<session_id>` | GET | Sonuçları getir |
| `/api/results/<session_id>/csv` | GET | CSV indir |
| `/api/results/<session_id>/excel` | GET | Excel indir |
| `/api/results/<session_id>/image/<filename>` | GET | İşlenmiş görüntü |
| `/api/sessions` | GET | Oturum listesi |
| `/api/templates` | GET | Şablon listesi |
| `/api/templates/<id>` | GET | Şablon detayları |
| `/api/templates` | POST | Yeni şablon oluştur |
| `/api/templates/<id>` | PUT | Şablon güncelle |
| `/api/analysis/answer-keys` | GET | Kayıtlı cevap anahtarları |
| `/api/analysis/answer-keys` | POST | Yeni cevap anahtarı kaydet |
| `/api/analysis/answer-keys/<name>` | GET/DELETE | Cevap anahtarı getir/sil |
| `/api/analysis/scores/<session_id>` | POST | Puanları hesapla |
| `/api/analysis/scores/<session_id>/excel` | POST | Puanları Excel olarak indir |
| `/api/analysis/cheating/<session_id>` | POST | Kopya tespiti yap |
| `/api/analysis/cheating/<session_id>/excel` | POST | Kopya raporu Excel indir |
| `/api/scanner/devices` | GET | Tarayıcı listesi |
| `/api/scanner/refresh` | POST | Tarayıcı listesini yenile |
| `/api/scanner/diagnostics` | GET | Tarayıcı tanılama bilgisi |
| `/api/scanner/capabilities` | GET | Tarayıcı özellikleri |
| `/api/scanner/scan` | POST | Tarama başlat |
| `/api/scanner/status` | GET | Tarama durumu |
| `/api/scanner/cancel` | POST | Taramayı iptal et |

---

#### WebSocket Olayları

Gerçek zamanlı güncellemeler için Socket.IO kullanılır:

| Olay | Açıklama |
|------|----------|
| `scan_started` | Tarama başladı |
| `page_scanned` | Sayfa tarandı (sayfa numarası ile) |
| `scan_complete` | Tarama tamamlandı |
| `scan_error` | Tarama hatası |
| `processing_started` | OMR işleme başladı |
| `processing_progress` | İşleme ilerlemesi |
| `processing_complete` | İşleme tamamlandı |

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
│   ├── static/             # Statik dosyalar
│   │   ├── css/            # Stiller
│   │   │   └── styles.css  # Ana stil dosyası
│   │   ├── js/             # JavaScript dosyaları
│   │   │   ├── main.js     # Ana sayfa scripti
│   │   │   ├── process.js  # İşleme sayfası
│   │   │   ├── scanner.js  # Tarayıcı kontrolü
│   │   │   ├── templates.js # Şablon yönetimi
│   │   │   ├── template-editor.js # Şablon editörü
│   │   │   └── analysis.js # Sonuç analizi scripti
│   │   ├── index.html      # Ana sayfa
│   │   ├── scanner.html    # Tarayıcı sayfası
│   │   ├── process.html    # İşleme sayfası
│   │   ├── templates.html  # Şablon listesi
│   │   ├── template-editor.html # Şablon editörü
│   │   └── analysis.html   # Sonuç analizi sayfası
│   ├── services/           # Servis modülleri
│   │   ├── omr_service.py  # OMR işleme servisi
│   │   ├── scanner_service.py # Tarayıcı servisi
│   │   └── analysis_service.py # Analiz/puanlama servisi
│   ├── uploads/            # Yüklenen dosyalar
│   └── results/            # İşlem sonuçları
│
├── samples/                # Örnek şablonlar
│   ├── sample1/            # Temel OMR örneği
│   │   ├── template.json   # Şablon dosyası
│   │   ├── config.json     # Yapılandırma
│   │   ├── omr_marker.jpg  # Köşe marker
│   │   └── MobileCamera/   # Örnek görüntüler
│   ├── sample2-6/          # Diğer örnekler
│   ├── answer-key/         # Cevap anahtarı örnekleri
│   │   ├── using-csv/      # CSV tabanlı değerlendirme
│   │   └── weighted-answers/ # Ağırlıklı puanlama
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
| `bubbleDimensions` | [genişlik, yükseklik] | Kabarcık boyutları |
| `fieldBlocks` | object | Alan blokları tanımları |
| `preProcessors` | array | Ön işleme adımları |
| `customLabels` | object | Özel etiket tanımları |

#### Alan Türleri (fieldType)

| Tür | Açıklama | Değerler |
|-----|----------|----------|
| `QTYPE_MCQ4` | 4 seçenekli çoktan seçmeli | A, B, C, D |
| `QTYPE_MCQ5` | 5 seçenekli çoktan seçmeli | A, B, C, D, E |
| `QTYPE_INT` | Sayısal değer | 0-9 |
| `QTYPE_INT_FROM_1` | Sayısal değer (1'den başlar) | 1-0 |
| `QTYPE_TR_ALPHABET` | Türk alfabesi | A-Z, Ç, Ğ, İ, Ö, Ş, Ü |
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
   - "📷 Görüntü Yükle" butonu ile formunuzu yükleyin
   - Görüntü canvas üzerinde görünecektir

4. **Alan blokları ekleyin:**
   - "🎯 Alan Seç" toggle'ını aktif edin
   - Canvas üzerinde fare ile sürükleyerek alan seçin
   - Sağ panelde alan özelliklerini ayarlayın

5. **İnce ayar yapın:**
   - Ok tuşları ile hassas konumlandırma (Shift+ok = 5px)
   - Koordinatları elle düzenleyin
   - Önizleme ile kontrol edin

6. **Şablonu kaydedin:**
   - Şablon adını girin
   - "💾 Kaydet" butonu ile kaydedin

### Şablon Oluşturma İpuçları

- ✅ Yüksek çözünürlüklü tarama kullanın (300 DPI önerilen)
- ✅ Düz ve gölgesiz tarama yapın
- ✅ Marker'ları (köşe işaretleri) net tutun
- ✅ Önce küçük bir örnekle test edin
- ✅ Hızlı çoğaltma ile zaman kazanın
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

<details>
<summary><b>7. Web arayüzü hangi tarayıcılarda çalışır?</b></summary>

Modern tüm tarayıcılar desteklenir: Chrome, Firefox, Edge, Safari. Önerilen: Chrome veya Firefox.
</details>

<details>
<summary><b>8. ADF (Otomatik Belge Besleyici) nasıl kullanılır?</b></summary>

1. Tarayıcınızın ADF özelliği olmalı
2. Web arayüzünde tarayıcı sayfasını açın
3. "Otomatik Belge Besleyici (ADF) Kullan" seçeneğini işaretleyin
4. Formları besleyiciye yerleştirin
5. Taramayı başlatın
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

<details>
<summary><b>WinError 10048: Port kullanımda</b></summary>

**Çözüm:**
```powershell
# Farklı port kullanın
set OMR_WEB_PORT=8080
python app.py

# VEYA portu kullanan işlemi bulun
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```
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

### Web Arayüzü Sorunları

<details>
<summary><b>Sunucuya bağlanılamıyor</b></summary>

**Kontroller:**
1. Sunucunun çalıştığından emin olun
2. Port numarasını kontrol edin
3. Firewall ayarlarını kontrol edin
4. localhost yerine 127.0.0.1 deneyin
</details>

<details>
<summary><b>Şablonlar yüklenmiyor</b></summary>

**Çözüm:**
1. samples/ klasörünün var olduğundan emin olun
2. Her şablon klasöründe template.json olmalı
3. Konsol hatalarını kontrol edin (F12)
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
