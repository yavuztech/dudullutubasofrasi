function groupItemsByStation(items, categories = []) {
  const grouped = {};

  (Array.isArray(items) ? items : []).forEach((item, itemIndex) => {
    const category = categories.find((candidate) => candidate.id === item.categoryId)
      || categories.find((candidate) => candidate.name === item.category);
    const station = item.kitchenStation || category?.kitchenStation;

    if (!['station1', 'station2', 'station4', 'station5'].includes(station)) return;
    if (!grouped[station]) grouped[station] = [];
    grouped[station].push({ item, itemIndex });
  });

  return grouped;
}

function getUnacknowledgedStations(order, stations) {
  const requestId = order?.kitchenPrintRequestId;
  if (typeof requestId !== 'string' || requestId.length === 0) return [];

  return stations.filter((station) => order.kitchenPrintHandled?.[station] !== requestId);
}

module.exports = { groupItemsByStation, getUnacknowledgedStations };
