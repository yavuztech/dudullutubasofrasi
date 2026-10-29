const STATIONS = ['station1', 'station2', 'station3', 'station4', 'station5'];

function readBridgeConfig(env = process.env) {
  const station = env.BRIDGE_STATION || null;
  const printerName = env.PRINTER_NAME?.trim() || null;

  if (station && !STATIONS.includes(station)) {
    throw new Error(`BRIDGE_STATION geçersiz: ${station}. İzin verilenler: ${STATIONS.join(', ')}`);
  }
  if (station && !printerName) {
    throw new Error('BRIDGE_STATION ayarlıysa yerel yazıcı kuyruğu için PRINTER_NAME de ayarlanmalıdır.');
  }

  return { station, printerName };
}

function handlesStation(bridgeConfig, station) {
  return STATIONS.includes(station)
    && (!bridgeConfig.station || bridgeConfig.station === station);
}

function getPrinterName(bridgeConfig, settings, station) {
  if (!handlesStation(bridgeConfig, station)) return null;
  return bridgeConfig.station
    ? bridgeConfig.printerName
    : settings?.stationMapping?.[station] || null;
}

module.exports = { STATIONS, readBridgeConfig, handlesStation, getPrinterName };
