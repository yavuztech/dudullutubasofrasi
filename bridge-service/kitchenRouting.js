function groupItemsByStation(items, categories = []) {
  const grouped = {};

  (Array.isArray(items) ? items : []).forEach((item, itemIndex) => {
    const category = categories.find((candidate) => candidate.id === item.categoryId)
      || categories.find((candidate) => candidate.name === item.category);
    const station = category?.kitchenStation;

    if (!['station1', 'station2', 'station4'].includes(station)) return;
    if (!grouped[station]) grouped[station] = [];
    grouped[station].push({ item, itemIndex });
  });

  return grouped;
}

module.exports = { groupItemsByStation };
