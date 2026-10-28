const test = require('node:test');
const assert = require('node:assert/strict');
const {
  readBridgeConfig,
  handlesStation,
  getPrinterName,
} = require('./bridgeConfig');

test('requires a valid station and local printer queue for station-specific bridges', () => {
  assert.throws(
    () => readBridgeConfig({ BRIDGE_STATION: 'station1' }),
    /PRINTER_NAME/,
  );
  assert.throws(
    () => readBridgeConfig({ BRIDGE_STATION: 'station5', PRINTER_NAME: 'Kitchen' }),
    /BRIDGE_STATION geçersiz/,
  );
  assert.deepEqual(
    readBridgeConfig({ BRIDGE_STATION: 'station2', PRINTER_NAME: 'Grill_Printer' }),
    { station: 'station2', printerName: 'Grill_Printer' },
  );
  assert.deepEqual(
    readBridgeConfig({ BRIDGE_STATION: 'station4', PRINTER_NAME: 'Burger_Printer' }),
    { station: 'station4', printerName: 'Burger_Printer' },
  );
});

test('station-specific bridges only handle their own station and local printer', () => {
  const grillBridge = { station: 'station2', printerName: 'Local_Grill' };
  const sharedSettings = {
    stationMapping: {
      station1: 'Shared_Oven',
      station2: 'Shared_Oven',
    },
  };

  assert.equal(handlesStation(grillBridge, 'station1'), false);
  assert.equal(handlesStation(grillBridge, 'station2'), true);
  assert.equal(getPrinterName(grillBridge, sharedSettings, 'station2'), 'Local_Grill');
  assert.equal(getPrinterName(grillBridge, sharedSettings, 'station1'), null);
  assert.equal(handlesStation(grillBridge, 'station4'), false);
});

test('legacy bridge uses shared printer mapping when no station is configured', () => {
  const legacyBridge = readBridgeConfig({});
  assert.equal(
    getPrinterName(legacyBridge, { stationMapping: { station1: 'Oven_Queue' } }, 'station1'),
    'Oven_Queue',
  );
  assert.equal(handlesStation(legacyBridge, 'station3'), true);
  assert.equal(handlesStation(legacyBridge, 'station4'), true);
});
