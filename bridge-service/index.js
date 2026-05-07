require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const printer = require('printer');

// ─── Firebase Admin Setup ────────────────────────────────────────────────────
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ─── Express Server ──────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Bridge service çalışıyor', version: '1.0.0' });
});

// Get available printers
app.get('/printers', (req, res) => {
  try {
    const printers = printer.getPrinters();
    const printerNames = printers.map((p) => p.name);
    res.json({ printers: printerNames });
  } catch (err) {
    console.error('Yazıcı listesi alınamadı:', err);
    res.status(500).json({ error: 'Yazıcı listesi alınamadı' });
  }
});

app.listen(PORT, () => {
  console.log(`✓ Bridge service başlatıldı: http://localhost:${PORT}`);
  console.log('✓ Firestore dinleniyor...');
  startFirestoreListener();
});

// ─── Firestore Listener ──────────────────────────────────────────────────────
let printerSettings = null;
let categories = [];

async function startFirestoreListener() {
  // Listen to printer settings
  db.doc('settings/printer-config').onSnapshot((snap) => {
    if (snap.exists) {
      printerSettings = snap.data();
      console.log('✓ Yazıcı ayarları güncellendi:', printerSettings);
    }
  });

  // Listen to categories
  db.collection('categories').onSnapshot((snap) => {
    categories = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    console.log(`✓ ${categories.length} kategori yüklendi`);
  });

  // Listen to new orders
  db.collection('orders')
    .where('status', '==', 'pending')
    .onSnapshot((snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const order = { id: change.doc.id, ...change.doc.data() };
          handleNewOrder(order);
        }
      });
    });
}

// ─── Order Handler ───────────────────────────────────────────────────────────
async function handleNewOrder(order) {
  if (!printerSettings || !printerSettings.enabled) {
    console.log('⚠ Otomatik yazdırma kapalı, sipariş yazdırılmadı:', order.id);
    return;
  }

  console.log(`\n📄 Yeni sipariş: ${order.id}`);
  
  // Group items by kitchen station
  const grouped = groupItemsByStation(order.items);
  
  // Print each group to its assigned printer
  for (const [station, items] of Object.entries(grouped)) {
    const printerName = printerSettings.stationMapping?.[station];
    
    if (!printerName) {
      console.log(`⚠ ${station} için yazıcı tanımlanmamış, atlanıyor`);
      continue;
    }

    const receipt = generateReceipt(order, items, station);
    await printReceipt(printerName, receipt);
  }
}

// ─── Group Items by Kitchen Station ──────────────────────────────────────────
function groupItemsByStation(items) {
  const grouped = {};

  items.forEach((item) => {
    // Find category for this product
    const category = categories.find((c) => c.name === item.category);
    const station = category?.kitchenStation;

    if (!station) {
      console.log(`⚠ "${item.productName}" için istasyon yok`);
      return;
    }

    if (!grouped[station]) {
      grouped[station] = [];
    }

    grouped[station].push(item);
  });

  return grouped;
}

// ─── Generate Receipt (ESC/POS) ──────────────────────────────────────────────
function generateReceipt(order, items, station) {
  const ESC = '\x1B';
  const GS = '\x1D';
  
  let receipt = '';
  
  // Initialize printer
  receipt += ESC + '@'; // Reset
  receipt += ESC + 'a' + '\x01'; // Center align
  
  // Header
  receipt += ESC + '!' + '\x30'; // Double height + width
  receipt += 'TUBA SOFRASI\n';
  receipt += ESC + '!' + '\x00'; // Normal size
  receipt += '================================\n';
  
  // Order info
  receipt += ESC + 'a' + '\x00'; // Left align
  receipt += ESC + '!' + '\x10'; // Emphasized
  
  if (order.tableNumber) {
    receipt += `MASA ${order.tableNumber}\n`;
  } else {
    receipt += 'GEL-AL\n';
  }
  
  receipt += ESC + '!' + '\x00'; // Normal
  receipt += `İstasyon: ${getStationLabel(station)}\n`;
  receipt += `Sipariş: ${order.orderNumber || order.id.slice(-6).toUpperCase()}\n`;
  receipt += '================================\n\n';
  
  // Items
  items.forEach((item) => {
    receipt += ESC + '!' + '\x10'; // Emphasized
    receipt += `${item.quantity}x ${item.productName}\n`;
    receipt += ESC + '!' + '\x00'; // Normal
    
    if (item.notes) {
      receipt += `   Not: ${item.notes}\n`;
    }
    receipt += '\n';
  });
  
  receipt += '================================\n';
  
  // Footer
  const now = new Date();
  const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('tr-TR');
  receipt += `${timeStr} - ${dateStr}\n`;
  
  // Cut paper
  receipt += '\n\n\n';
  receipt += GS + 'V' + '\x00'; // Full cut
  
  return receipt;
}

function getStationLabel(stationId) {
  const labels = {
    station1: 'İSTASYON 1',
    station2: 'İSTASYON 2',
    station3: 'İSTASYON 3',
  };
  return labels[stationId] || stationId.toUpperCase();
}

// ─── Print to Printer ────────────────────────────────────────────────────────
async function printReceipt(printerName, receipt) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`🖨️  Yazdırılıyor: ${printerName}`);
      
      printer.printDirect({
        data: receipt,
        printer: printerName,
        type: 'RAW',
        success: (jobID) => {
          console.log(`✓ Yazdırıldı (Job ID: ${jobID})`);
          resolve(jobID);
        },
        error: (err) => {
          console.error(`✗ Yazıcı hatası (${printerName}):`, err);
          reject(err);
        },
      });
    } catch (err) {
      console.error(`✗ Yazdırma başarısız (${printerName}):`, err);
      reject(err);
    }
  });
}

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
process.on('SIGINT', () => {
  console.log('\n⚠ Bridge service kapatılıyor...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠ Bridge service sonlandırılıyor...');
  process.exit(0);
});
