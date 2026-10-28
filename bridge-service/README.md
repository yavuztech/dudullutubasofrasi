# Tuba Sofrası - Bridge Service

Mutfak yazıcılarına otomatik sipariş yazdırma servisi.

## 🎯 Amaç

Bu servis, Firestore'daki yeni siparişleri dinler ve ürünleri **mutfak istasyonlarına** göre gruplandırarak tanımlı yazıcılara otomatik gönderir.

## 📋 Gereksinimler

- **Node.js 18+** (LTS önerilir)
- **macOS** (CUPS yazdırma sistemi etkin olmalı) veya **Windows 10/11**
- **Yazıcılar** işletim sistemine eklenmiş olmalı; macOS'ta `lpstat -p` ile görünür olmalı
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

## 🖨️ macOS Yazıcı Yapılandırması

### 1. Yazıcıları macOS'a Ekleyin

- **System Settings** → **Printers & Scanners** → **Add Printer**
- USB yazıcıları ekleyin ve üretici/model için uygun sürücüyü seçin.
- Terminal'de `lpstat -p` komutunu çalıştırarak kuyruk adlarını doğrulayın.
- Bridge çalışacak bilgisayardaki yerel kuyruk adını not edip `.env` dosyasındaki `PRINTER_NAME` alanına yazın.

### 2. Her Bilgisayarda Bir Bridge Çalıştırma

Her yazıcının bağlı olduğu bilgisayarda Bridge Service'i ayrı ayrı kurup çalıştırın. Her kurulum aynı Firebase projesindeki `serviceAccountKey.json` dosyasını kullanır. Bilgisayarlar aynı yerel ağa erişebilmelidir.

Her bilgisayardaki `bridge-service/.env` dosyasına **o bilgisayara ait tek istasyonu** ve o bilgisayardaki CUPS yazıcı kuyruğunu yazın:

```env
PORT=3001
BRIDGE_STATION=station1
PRINTER_NAME=Gainscha_GA_E200
```

`BRIDGE_STATION` değerleri: Fırın için `station1`, Izgara için `station2`, Kasa için `station3`, Burger için `station4`. `PRINTER_NAME`, yalnızca o bilgisayarda `lpstat -p` ile görünen yerel kuyruk adıdır. Her bilgisayarda aynı port kullanılabilir.

Örnek olarak Fırın bilgisayarında `BRIDGE_STATION=station1`, Izgara bilgisayarında `BRIDGE_STATION=station2`, Kasa bilgisayarında `BRIDGE_STATION=station3`, Burger bilgisayarında `BRIDGE_STATION=station4` kullanılır. Her birine bağlı yazıcının yerel kuyruk adını ayrıca girin. İstasyon başına birden fazla yazıcı gerekiyorsa aynı istasyon değeriyle birden fazla cihaz yapılandırması ayrıca desteklenmiyor; bu kurulumda tek bilgisayar/bridge/yerel kuyruk istasyon başınadır.

### 3. Admin Panelden Bridge Adreslerini Girme

1. Her bilgisayarın yerel IP adresini bulun ve o bilgisayardaki bridge URL'sini belirleyin (ör. `http://192.168.1.50:3001`).
2. Web uygulamasında **Admin → Ayarlar** bölümünde Fırın, Izgara, Kasa ve Burger için ilgili bilgisayarın URL'sini girin.
3. Her URL'nin yanındaki **Test** düğmesini kullanın. Test, bridge'in doğru `BRIDGE_STATION` ile çalıştığını ve yerel yazıcı kuyruğunu görüp görmediğini doğrular.
4. **Otomatik Yazdırma**'yı açıp **Ayarları Kaydet**'e basın.
5. Ürün kategorilerini Ürünler sayfasında Fırın, Izgara veya Burger istasyonuna atayın.

Bridge bilgisayarlarında işletim sistemi güvenlik duvarı varsa uygulamanın TCP `3001` portuna yerel ağdan erişmesine izin verin. HTTPS üzerinden yayınlanan web uygulamalarında tarayıcı güvenlik kuralları HTTP bridge adreslerine erişimi engelleyebilir; bu durumda bridge için güvenli HTTPS erişimi veya uygulamayla uyumlu bir yerel ağ kurulumu gerekir.

### 4. Kategorilere İstasyon Ata

**Admin → Ürünler** sayfasında:

1. Kategori düzenle butonuna tıklayın
2. **Mutfak İstasyonu** dropdown'ından seçin
3. Kaydet

Örnek:
- Fırın ürünleri → Fırın
- Izgara ürünleri → Izgara
- Burger ürünleri → Burger
- Mutfak fişi gerektirmeyen ürünler (ör. içecekler) → Yok

Kasa fişi, ürün kategorisinden bağımsız olarak kasiyer ekranından manuel yazdırılır.

## 📄 Nasıl Çalışır?

1. **Garson** yeni sipariş girer → Firestore'a kaydedilir
2. Her Bridge yeni sipariş olayını alır
3. Ürünler kategorilerine göre Fırın/Izgara/Burger olarak gruplandırılır
4. Bridge, yalnızca `.env` içindeki `BRIDGE_STATION` ile eşleşen ürünleri işler; diğer istasyonları atlar
5. Her ürün satırı için ayrı fiş oluşturup yalnızca o bilgisayarın `PRINTER_NAME` kuyruğuna gönderir

Bu istasyon filtresi sayesinde tüm Bridge bilgisayarları aynı Firestore siparişlerini dinlese de aynı sipariş kopya yazdırılmaz. Her bilgisayarda farklı `BRIDGE_STATION` kullanılması zorunludur.

**Örnek Sipariş:**
```
Masa 5:
- 2x Döner (Izgara → Izgara yazıcısı)
- 1x Pide (Fırın → Fırın yazıcısı)
- 1x Tavuk Şiş (Izgara → Izgara yazıcısı)
- 1x Cheeseburger (Burger → Burger yazıcısı)
```

**Yazdırılan Fişler:**

**Fırın yazıcısı:**
```
TUBA SOFRASI
FİŞ NO: 00001
MASA 5
FIRIN
------------------------------------------
2x Pide
```

**Izgara yazıcısı:**
```
TUBA SOFRASI
FİŞ NO: 00002
MASA 5
IZGARA
------------------------------------------
2x Döner
```

Izgara yazıcısındaki diğer ürün de ayrı fiş alır:
```
FİŞ NO: 00003
MASA 5
IZGARA
------------------------------------------
1x Tavuk Şiş
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

- macOS **Printers & Scanners** bölümünde yazıcıları kontrol edin
- `lpstat -p` çıktısında yazıcı kuyrukları görünüyor mu?
- Yazıcı sürücülerinin kurulu ve yazıcıların açık/bağlı olduğundan emin olun
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
   - "Bu bridge istasyonunda yapılandırılmadığı için atlandı" → Beklenen station değeri diğer bilgisayardaki bridge tarafından işlenir
   - `PRINTER_NAME` → `.env` dosyasındaki yerel yazıcı kuyruğu adını `lpstat -p` ile doğrulayın

2. **Test yazdırma:**
   - İşletim sisteminden yazıcıya test sayfası bastırın
   - Yazıcı çevrimiçi ve kağıdı var mı?

## 📦 API Endpoints

### `GET /`
Health check; station-specific bridge için yapılandırılmış istasyonu da döndürür.

**Response:**
```json
{
  "status": "Bridge service çalışıyor",
  "version": "1.0.0",
  "station": "station1"
}
```

### `GET /printers`
İşletim sisteminde tanımlı yazıcı listesi (macOS'ta CUPS üzerinden).

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

### Kasa fişi yazdırma
Kasa ekranındaki **Kasa Yazıcısında Yazdır** düğmesi, Admin → Ayarlar bölümündeki Kasa Bridge URL'sine `POST /print/cashier` isteği gönderir. İstek yalnızca `BRIDGE_STATION=station3` olarak yapılandırılmış Bridge tarafından kabul edilir ve `PRINTER_NAME` yerel kuyruğuna ESC/POS RAW olarak yollar. Ürün başına modunda fiyat yazdırılmaz; sipariş bazlı modda tutarlar yazdırılır.

Yeni `pending` siparişlerde Fırın (`station1`), Izgara (`station2`) ve Burger (`station4`) kategorileri yazdırılır. Sipariş kalemleri istasyonlarına yönlendirilir ve **her ürün satırı için ayrı, fiyatsız fiş** çıkar; miktar aynı fişte belirtilir. Kasa (`station3`) yazıcısı mutfak siparişi otomatik çıktısına dahil değildir; kasadan manuel yazdırılır. Tüm kasa ve mutfak fişleri Firestore'daki `counters/receipt-sequence` ortak, kalıcı sayacından numara alır (`00001`, `00002`, ...); bridge yeniden başlatıldığında sıra korunur.

## 📝 Notlar

- **ESC/POS uyumlu** termal yazıcılar önerilir (Epson, Star, Bixolon vb.)
- Yazıcı model ve sürücülerindeki ESC/POS karakter tabloları farklı olabildiğinden, bozuk karakterleri önlemek için Türkçe harfler ASCII karşılıklarıyla yazdırılır (`Ş` → `S`, `ı` → `i`); `₺` yerine `TL` kullanılır. Her fiş başlangıçta yazıcıyı ve satır aralığını sıfırlar; bitişte kağıdı kesip yazıcı durumunu yeniden sıfırlar.
- Yazıcılar macOS'a eklenmiş bir CUPS kuyruğu olarak görünmelidir
- Siparişler **pending** durumundayken yazdırılır
- Yeni sipariş otomatik olarak bir kez yazdırılır; tekrar çıktı yalnızca garsonun açıkça oluşturduğu istekle alınır
- Garson, mevcut sipariş detayından **Mutfağa Tekrar Gönder** ile aynı siparişin fişini yeniden yazdırma isteği oluşturabilir. Bu işlem yeni sipariş veya hesap oluşturmaz; her istasyon bridge'i kendi yazdırma sonucunu Firestore'a kaydeder. Bridge çevrimdışıysa istek Firestore'da bekler ve bridge bağlandığında işlenir. Yazıcının fiziksel olarak kağıt çıkardığı bridge tarafından garanti edilemez; gerekirse garson teyidiyle tekrar istek oluşturun.

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
