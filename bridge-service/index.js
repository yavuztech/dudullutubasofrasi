require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { spawn } = require('node:child_process');
const printer = process.platform === 'win32' ? require('printer') : null;
const {
  formatCashierReceipt,
  formatKitchenReceipt,
  isValidCashierReceipt,
} = require('./receiptFormatter');
const { groupItemsByStation } = require('./kitchenRouting');
const { reserveReceiptNumbers } = require('./receiptNumber');
const { readBridgeConfig, handlesStation, getPrinterName } = require('./bridgeConfig');
const bridgeConfig = readBridgeConfig();

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
  res.json({
    status: 'Bridge service çalışıyor',
    version: '1.0.0',
    station: bridgeConfig.station,
    printer: bridgeConfig.printerName,
  });
});

// Get available printers
app.get('/printers', (req, res) => {
  listPrinters()
    .then((printers) => {
      res.json({ printers, station: bridgeConfig.station });
    })
    .catch((err) => {
      console.error('Yazıcı listesi alınamadı:', err);
      res.status(500).json({ error: 'Yazıcı listesi alınamadı' });
    });
});

app.post('/print/cashier', async (req, res) => {
  const receipts = req.body?.receipts;
  if (
    !Array.isArray(receipts)
    || receipts.length === 0
    || receipts.length > 20
    || receipts.some((receipt) => !isValidCashierReceipt(receipt))
  ) {
    return res.status(400).json({ error: 'Geçersiz fiş içeriği.' });
  }

  if (!handlesStation(bridgeConfig, 'station3')) {
    return res.status(409).json({ error: 'Bu bridge Kasa istasyonu için yapılandırılmamış.' });
  }

  const printerName = getPrinterName(bridgeConfig, printerSettings, 'station3');
  if (!printerName) {
    return res.status(400).json({ error: 'Kasa yazıcısı bridge ayarlarında yapılandırılmamış.' });
  }

  try {
    const receiptNumbers = await reserveReceiptNumbers(db, receipts.length);
    const printData = Buffer.concat(receipts.map((receipt, index) =>
      formatCashierReceipt({ ...receipt, receiptNumber: receiptNumbers[index] })));
    await printReceipt(printerName, printData);
    res.json({ printed: receipts.length, printer: printerName, receiptNumbers });
  } catch (err) {
    console.error('Kasa fişi yazdırılamadı:', err);
    res.status(500).json({ error: 'Kasa yazıcısına fiş gönderilemedi.' });
  }
});

app.listen(PORT, () => {
  console.log(`✓ Bridge service başlatıldı: http://localhost:${PORT}`);
  console.log('✓ Firestore dinleniyor...');
  startFirestoreListener().catch((err) => {
    console.error('Firestore dinleyicileri başlatılamadı:', err);
  });
});

// ─── Firestore Listener ──────────────────────────────────────────────────────
let printerSettings = null;
let categories = [];
let isInitialOrdersSnapshot = true;
const printerQueues = new Map();

async function startFirestoreListener() {
  const [settingsSnapshot, categoriesSnapshot] = await Promise.all([
    db.doc('settings/printer-config').get(),
    db.collection('categories').get(),
  ]);
  printerSettings = settingsSnapshot.exists ? settingsSnapshot.data() : null;
  categories = categoriesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  // Listen to printer settings
  db.doc('settings/printer-config').onSnapshot((snap) => {
    printerSettings = snap.exists ? snap.data() : null;
    console.log('✓ Yazıcı ayarları güncellendi:', printerSettings);
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
      if (isInitialOrdersSnapshot) {
        isInitialOrdersSnapshot = false;
        console.log('✓ Mevcut bekleyen siparişler yazdırılmadan atlandı');
        return;
      }

      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const order = { id: change.doc.id, ...change.doc.data() };
          handleNewOrder(order).catch((err) => {
            console.error(`Sipariş yazdırılamadı (${order.id}):`, err);
          });
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
  const grouped = groupItemsByStation(order.items, categories);
  if (Object.keys(grouped).length === 0) {
    const items = Array.isArray(order.items) ? order.items : [];
    console.log(`⚠ Sipariş ${order.id} içinde yazdırılabilir ürün bulunamadı. Ürün kategorilerini ve Fırın/Izgara/Burger istasyon eşleştirmelerini kontrol edin. Ürün sayısı: ${items.length}, kategori sayısı: ${categories.length}`);
    return;
  }
  
  // Kitchen orders are printed one ticket per product line at oven/grill stations.
  for (const [station, items] of Object.entries(grouped)) {
    if (!handlesStation(bridgeConfig, station)) {
      console.log(`↪ ${station} bu bridge istasyonunda yapılandırılmadığı için atlandı`);
      continue;
    }

    const printerName = getPrinterName(bridgeConfig, printerSettings, station);
    
    if (!printerName) {
      console.error(`⚠ ${station} için yerel yazıcı tanımlanmamış, atlanıyor`);
      continue;
    }

    const receiptNumbers = await reserveReceiptNumbers(db, items.length);
    const printData = items.map(({ item }, index) => {
      const receiptNumber = receiptNumbers[index];
      return formatKitchenReceipt({ order, item, station, receiptNumber });
    });
    await printReceipt(printerName, Buffer.concat(printData));
  }
}

// ─── Print to Printer ────────────────────────────────────────────────────────
async function printReceipt(printerName, receipt) {
  const previous = printerQueues.get(printerName) || Promise.resolve();
  const current = previous.catch(() => {}).then(() => printReceiptNow(printerName, receipt));
  printerQueues.set(printerName, current);
  try {
    return await current;
  } finally {
    if (printerQueues.get(printerName) === current) printerQueues.delete(printerName);
  }
}

async function printReceiptNow(printerName, receipt) {
  console.log(`🖨️  Yazdırılıyor: ${printerName}`);
  if (printer) {
    return new Promise((resolve, reject) => {
      printer.printDirect({
        data: receipt,
        printer: printerName,
        type: 'RAW',
        success: (jobId) => {
          console.log(`✓ Yazdırıldı (Job ID: ${jobId})`);
          resolve(jobId);
        },
        error: reject,
      });
    });
  }

  const output = await runCommand('lp', ['-d', printerName, '-o', 'raw'], receipt);
  console.log(`✓ Yazdırma kuyruğuna gönderildi: ${output.trim()}`);
  return output.trim();
}

function listPrinters() {
  if (printer) {
    return Promise.resolve(printer.getPrinters().map((availablePrinter) => availablePrinter.name));
  }

  return runCommand('lpstat', ['-p']).then((output) =>
    output
      .split('\n')
      .map((line) => line.match(/^printer\s+(.+?)\s+is\s+/)?.[1])
      .filter(Boolean)
  ).catch((err) => {
    if (/No destinations added/i.test(err.message)) return [];
    throw err;
  });
}

function runCommand(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let output = '';
    let errorOutput = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { errorOutput += chunk; });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(errorOutput.trim() || `${command} başarısız oldu (kod: ${code})`));
      }
    });

    child.stdin.once('error', reject);
    if (input === undefined) {
      child.stdin.end();
    } else {
      child.stdin.end(input, 'utf8');
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
