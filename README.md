# Dudullu Tuba Sofrası - Restaurant Ordering System

Restoranlar ve kafeler için modern, gerçek zamanlı sipariş yönetim sistemi.

## 🎯 Özellikler

### 👥 Müşteri Arayüzü
- Ürün menüsü görüntüleme
- Sepete ürün ekleme/çıkarma
- Canlı sipariş takibi
- Telefon doğrulama
- KVKK Onayı
- Paket sipariş seçeneği

### 👨‍🍳 Mutfak Yönetimi
- Bekleyen siparişleri görmek
- Sipariş durumunu güncellemek
- Ürün yönetimi
- Fırın, ızgara ve kasa istasyonlarına otomatik termal fiş yönlendirme ([Bridge Service](bridge-service/README.md))

### 👔 Garson Paneli
- Masa yönetimi
- Masa bildirimlerini görüntüleme
- Gerçek zamanlı sip. takibi

### 💳 Kasa Paneli
- Hesapları müşteri adına açık/veresiye olarak kapatma
- Kısmi veya tam tahsilat kaydı ve kalan borç takibi
- Masa hesabını kapatıp masayı temizlemeye alma; müşteri adıyla borç kaydı tutma

Kasa > **Masalar** bölümünde hesabı açıp **Açık Hesap** seçin ve müşteri adını girin. Borç kaydedilince masa kapanır ve temizlemeye alınır. Daha sonraki ödemeler Kasa > **Açık Hesaplar** bölümünden müşteri adına bulunup kısmi veya tam tahsilat olarak kaydedilebilir. Vade tarihi alınmaz.

### 🔐 Admin Paneli
- Siparişler (tüm siparişleri yönet)
- Ürün yönetimi
- Staff yönetimi
- Masa yönetimi
- Paket sipariş yönetimi

## 🛠 Teknoloji Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + PostCSS
- **State Management**: Zustand
- **Backend**: Firebase/Firestore
- **Notifications**: Firebase Cloud Messaging
- **PWA**: Service Worker desteği
- **Build**: Vite

## 📁 Proje Yapısı

```
src/
├── components/
│   ├── customer/         # Müşteri bileşenleri
│   ├── kitchen/          # Mutfak bileşenleri
│   └── shared/           # Paylaşılan bileşenler
├── pages/
│   ├── CustomerMenu.tsx  # Müşteri menüsü
│   ├── LoginPage.tsx     # Giriş sayfası
│   ├── admin/            # Admin sayfaları
│   ├── kitchen/          # Mutfak sayfaları
│   └── waiter/           # Garson sayfaları
├── stores/               # Zustand state stores
├── types/                # TypeScript type tanımları
├── lib/                  # Firebase ve yardımcı fonksiyonlar
└── utils/                # Utility fonksiyonları
```

## 🚀 Başlangıç

### Gereksinimler
- Node.js 16+
- npm veya yarn

### Kurulum

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme sunucusunu başlat
npm run dev

# Üretim için derle
npm run build

# Firebase functions'ı dağıt
npm run deploy:functions
```

## 📖 Firebase Konfigürasyonu

Firebase projesi konfigürasyonu [SETUP.md](SETUP.md) dosyasında belirtilmiştir.

### Firestore Veritabanı Kuralları
- `firestore.rules`: Güvenlik kuralları
- `firestore.indexes.json`: Özel indeksler

## 🔔 Push Notifications

Firebase Cloud Messaging (FCM) entegrasyonu mobil ve masaüstü notifications desteği sağlar:
- Service Worker: `public/firebase-messaging-sw.js`
- Notification Store: `src/stores/notificationStore.ts`

## 🌐 PWA Desteği

Uygulama Progressive Web App özellikleri ile çalışır:
- Offline desteği
- Install özellikleri
- Service Worker caching

## 📝 Lisans

Özel proje
