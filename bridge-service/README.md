# Tuba Sofrası - Bridge Service

Mutfak yazıcılarına otomatik sipariş yazdırma servisi.

## 🎯 Amaç

Bu servis, Firestore'daki yeni siparişleri dinler ve ürünleri **mutfak istasyonlarına** göre gruplandırarak tanımlı yazıcılara otomatik gönderir.

## 📋 Gereksinimler

- **Node.js 18+** (LTS önerilir)
- **Windows 10/11** (yazıcı driver desteği için)
- **Yazıcılar** Windows'a kurulmuş ve "Devices & Printers"da görünür olmalı
- **Firebase Service Account Key** (JSON dosyası)

## 🚀 Kurulum

### 1. Node.js Kurulumu

[nodejs.org](https://nodejs.org) adresinden LTS sürümünü indirin ve kurun.

### 2. Bağımlılıkları Yükle

```bash
cd bridge-service
npm install
```

### 3. Firebase Service Account Key

1. [Firebase Console](https://console.firebase.google.com) → Projeniz → **Project Settings** → **Service Accounts**
2. **Generate New Private Key** butonuna tıklayın
3. İndirilen JSON dosyasını `bridge-service/serviceAccountKey.json` olarak kaydedin

**⚠️ ÖNEMLİ:** Bu dosyayı asla paylaşmayın veya git'e eklemeyin!

### 4. Çevre Değişkenleri

```bash
cp .env.example .env
```

Varsayılan port 3001. Değiştirmek isterseniz `.env` dosyasını düzenleyin.

## ▶️ Çalıştırma

### Manuel Başlatma

```bash
npm start
```

Konsol çıktısı:

```
✓ Bridge service başlatıldı: http://localhost:3001
✓ Firestore dinleniyor...
✓ Yazıcı ayarları güncellendi: { enabled: true, ... }
✓ 15 kategori yüklendi
```

### Geliştirme Modu (Auto-Reload)

```bash
npm run dev
```

## 🖨️ Yazıcı Yapılandırması

### 1. Yazıcıları Windows'a Ekleyin

- **Settings** → **Devices** → **Printers & Scanners**
- Her yazıcıyı ekleyin (USB, Network, Bluetooth)
- Yazıcı adını not edin (örn: `EPSON TM-T88V`, `Star TSP100`)

### 2. Admin Panelden Eşleştirme

1. Web uygulamasında **Admin → Ayarlar** sayfasına gidin
2. **Bridge Service URL**: `http://localhost:3001` (varsayılan)
3. **Test** butonuna basarak yazıcı listesini çekin
4. Her istasyona bir yazıcı atayın:
   - İstasyon 1 → EPSON TM-T88V
   - İstasyon 2 → Star TSP100
5. **Otomatik Yazdırma** aktif edin
6. **Kaydet**

### 3. Kategorilere İstasyon Ata

**Admin → Ürünler** sayfasında:

1. Kategori düzenle butonuna tıklayın
2. **Mutfak İstasyonu** dropdown'ından seçin
3. Kaydet

Örnek:
- Izgara → İstasyon 1
- Fırın → İstasyon 2
- İçecekler → Yok (yazdırılmaz)

## 📄 Nasıl Çalışır?

1. **Garson** yeni sipariş girer → Firestore'a kaydedilir
2. **Bridge Service** siparişi yakalar
3. Ürünler **kategorilerine** göre gruplandırılır
4. Her kategori için **kitchenStation** kontrolü yapılır
5. İstasyonlara göre **ayrı fişler** oluşturulur
6. Her fiş, eşleştirilmiş **yazıcıya** gönderilir

**Örnek Sipariş:**
```
Masa 5:
- 2x Döner (Izgara → İstasyon 1)
- 1x Pide (Fırın → İstasyon 2)
- 1x Tavuk Şiş (Izgara → İstasyon 1)
```

**Yazdırılan Fişler:**

**Yazıcı 1 (İstasyon 1):**
```
=================================
       TUBA SOFRASI
=================================
MASA 5
İstasyon: İSTASYON 1
Sipariş: A3F92C
=================================

2x Döner

1x Tavuk Şiş

=================================
14:35 - 07.05.2026
```

**Yazıcı 2 (İstasyon 2):**
```
=================================
       TUBA SOFRASI
=================================
MASA 5
İstasyon: İSTASYON 2
Sipariş: A3F92C
=================================

1x Pide

=================================
14:35 - 07.05.2026
```

## 🔧 Windows Servisi Olarak Kurulum (Opsiyonel)

Bilgisayar her açıldığında otomatik başlaması için:

### 1. NSSM (Non-Sucking Service Manager) Kur

[nssm.cc](https://nssm.cc/download) adresinden indirin.

### 2. Servisi Oluştur

```cmd
nssm install TubaSofrasiBridge
```

**GUI'de:**
- Path: `C:\Program Files\nodejs\node.exe`
- Startup directory: `C:\...\bridge-service`
- Arguments: `index.js`

**Service name:** TubaSofrasiBridge

### 3. Servisi Başlat

```cmd
nssm start TubaSofrasiBridge
```

### Servisi Durdur/Sil

```cmd
nssm stop TubaSofrasiBridge
nssm remove TubaSofrasiBridge confirm
```

## 🐛 Hata Giderme

### "Yazıcı listesi boş"

- Windows Devices & Printers'da yazıcıları kontrol edin
- Printer driver'ları kurulu mu?
- Bridge service yeniden başlatın

### "Bridge servise ulaşılamıyor"

- `http://localhost:3001` açıldığında `{"status":"Bridge service çalışıyor"}` görmeli
- Firewall/antivirus port 3001'i engelliyor olabilir
- `npm start` ile servisi çalıştırın

### "Firebase permission denied"

- `serviceAccountKey.json` dosyası doğru mu?
- Firestore rules admin yazabilir mi?
- Firebase project ID doğru mu?

### Fiş yazdırılmıyor

1. **Konsol log'larını kontrol edin:**
   - "Otomatik yazdırma kapalı" → Admin ayarlardan aktif edin
   - "İstasyon tanımlanmamış" → Kategorilere istasyon atayın
   - "Yazıcı tanımlanmamış" → Admin ayarlardan yazıcı eşleştirin

2. **Test yazdırma:**
   - Windows'tan yazıcıya test sayfası bastırın
   - Yazıcı çevrimiçi ve kağıdı var mı?

## 📦 API Endpoints

### `GET /`
Health check.

**Response:**
```json
{
  "status": "Bridge service çalışıyor",
  "version": "1.0.0"
}
```

### `GET /printers`
Windows'ta tanımlı yazıcı listesi.

**Response:**
```json
{
  "printers": [
    "EPSON TM-T88V",
    "Star TSP100",
    "Microsoft Print to PDF"
  ]
}
```

## 📝 Notlar

- **ESC/POS uyumlu** termal yazıcılar önerilir (Epson, Star, Bixolon vb.)
- **Network yazıcılar** Windows'ta printer olarak eklenmelidir
- Siparişler **pending** durumundayken yazdırılır
- Her sipariş **bir kez** yazdırılır (duplicate kontrol yok - Firestore snapshot'ları yönetir)

## 🔐 Güvenlik

- `serviceAccountKey.json` dosyasını `.gitignore`'a ekleyin
- Bridge service sadece **lokal ağdan** erişilebilir
- Production'da VPN veya güvenli ağ kullanın

## 📞 Destek

Sorun yaşarsanız:
1. Konsol log'larını kontrol edin
2. `npm start` çıktısına bakın
3. Yazıcı durumunu kontrol edin

---

**Tuba Sofrası Restaurant Management System**  
Version 1.0.0
