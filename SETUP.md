# Dudullu Tuba Sofrası — Restoran Sipariş Sistemi

React + Firebase tabanlı, tam mobil-responsive, PWA destekli restoran sipariş yönetim sistemi.

---

## Mimari

```
┌─────────────────┐   QR   ┌──────────────────────────────────┐
│   Müşteri        │ ──────► │ /menu/:qrToken  (Masa Siparişi)  │
│ (Tarayıcı)       │        │ /order           (Gel Al)         │
└─────────────────┘        └──────────────────────────────────┘
                                          │ Firestore
        ┌─────────────────────────────────┼──────────────────────┐
        ▼                                 ▼                      ▼
 /kitchen/orders                    /waiter                 /admin
 /kitchen/products              /waiter/tables           /admin/staff
 /kitchen/tables                                        /admin/tables
  (Rol: kitchen)                  (Rol: waiter)          (Rol: admin)
```

---

## Kurulum

### 1. Firebase Projesi Oluştur

1. [Firebase Console](https://console.firebase.google.com) → Yeni Proje
2. **Authentication** → Sign-in methods:
   - Email/Password → Etkinleştir (personel girişi)
   - Phone → Etkinleştir (Gel Al müşteri doğrulaması)
3. **Firestore** → Veritabanı oluştur (production mode)
4. **Storage** → Başlat (ürün görselleri için)
5. **Cloud Messaging** → Web Push sertifikası oluştur → VAPID Key kopyala

### 2. Ortam Değişkenleri

```bash
cp .env.example .env.local
```

`.env.local` dosyasını Firebase proje ayarlarından doldur:
- Firebase Console → Proje Ayarları → Genel → Uygulamalarınız → Config

### 3. Firestore Kuralları Deploy

```bash
npm install -g firebase-tools
firebase login
firebase use --add   # proje seç
firebase deploy --only firestore:rules
```

### 4. Frontend Geliştirme

```bash
npm install
npm run dev
```

### 5. Firebase Functions Deploy (push bildirimler için)

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

### 6. İlk Admin Kullanıcısı

Firebase Authentication → Kullanıcı Ekle ile bir kullanıcı oluştur, ardından
Firestore → `staff` koleksiyonuna şu belgeyi ekle (belgeid = UID):

```json
{
  "email": "admin@tubasofrasi.com",
  "displayName": "Yönetici",
  "role": "admin",
  "createdAt": "<serverTimestamp>"
}
```

Sonra `/admin/staff` üzerinden garson ve mutfak kullanıcıları oluşturabilirsin.

### 7. firebase-messaging-sw.js Güncelle

`public/firebase-messaging-sw.js` içindeki `__VITE_FIREBASE_*__` değerlerini
gerçek Firebase config değerleriyle değiştir (push bildirimlerin arka planda
çalışması için).

---

## Rol Sistemi

| Rol              | Yetkiler                                                                                 |
|------------------|------------------------------------------------------------------------------------------|
| `admin`          | Tüm paneller + personel yönetimi + masa/QR yönetimi                                      |
| `kitchen`        | Sipariş kuyruğu, ürün ve kategori yönetimi                                                |
| `waiter`         | Masalar (Normal & Aile), bildirimler, sipariş alma, masa aktarma/birleştirme/bölme        |
| `waiter_ladies`  | Hanım Kafeteryası masaları, hanım siparişleri alma, hanım bildirimleri                   |
| `cashier`        | Tüm masalar (Normal, Aile, Hanım) ve Gel Al kasası, hesap kapama, fiş yazdır, açık hesap |
| `cashier_ladies` | Sadece Hanım Kafeteryası masalarını görme ve hesap kapatma                               |
| `clothing`       | Giyim bölümü kasası ve satış yönetimi                                                    |
| Müşteri          | Kayıt gerekmez — QR okutarak menü/sipariş + Gel Al                                       |

---

## Kullanım Akışı

### Masa Siparişi
1. Müşteri masadaki QR'ı okutur → `/menu/:qrToken`
2. Menüden seçim yapar → Sipariş Onayla
3. (İlk defa) Bildirim izni istenir
4. Mutfak siparişi görür → "Hazırlamaya Başla" → "Hazır!"
5. Garson'a bildirim + titreşim (Masa X hazır!)
6. Garson masaya teslim eder
7. Kasa "Hesabı Kapat" dediğinde onay uyarısında "Fiş Yazdır ve Kapat" veya "Kapat" seçeneği sunulur. Masa 'available' duruma geçer.

### Gel Al Siparişi
1. Müşteri `/order` adresine gider
2. Telefon numarasını girer → SMS OTP doğrular
3. Menüden seçim yapar → Sipariş Onayla
4. Mutfak "Hazır!" → Müşteri cihazına **bildirim + titreşim** gönderilir
5. Müşteri gelip alır

Hesap kapandığında masa doğrudan boş duruma geçer. Bir masa doluyken veya boşken garson/personel **Masayı Böl** ile kapasiteyi alt masalara (ör. Masa 1_1, Masa 1_2 veya H-1_1, H-1_2) ayırıp her gruba ayrı hesap açabilir. Alt masalar boşaldığında **Bölünmeyi Kaldır** ile masa birleştirilebilir.

---

## Production Deploy (Firebase Hosting)

```bash
npm run build
firebase deploy --only hosting
```

URL yapısı: `https://<project>.web.app`

---

## Geliştirme Notları

- **Bildirim izni** cihaz başına bir kez istenir (localStorage'da takip edilir)
- **Titreşim** Web Vibration API — mobil tarayıcılarda çalışır
- **Arka plan push** Firebase Functions + FCM (Blaze planı gerekir)
- **Ürün görselleri** Firebase Storage'a yüklenir (max 3 MB)
- **QR kodlar** dinamik olarak üretilir; Admin panelinden PNG olarak indirilir
