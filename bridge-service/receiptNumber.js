async function reserveReceiptNumbers(db, count) {
  if (!Number.isInteger(count) || count < 1 || count > 1000) {
    throw new Error('Fiş numarası adedi geçersiz.');
  }

  const counterRef = db.collection('counters').doc('receipt-sequence');
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(counterRef);
    const lastNumber = snapshot.exists ? snapshot.get('lastNumber') : 0;
    if (!Number.isInteger(lastNumber) || lastNumber < 0) {
      throw new Error('Fiş numarası sayacı geçersiz.');
    }

    const firstNumber = lastNumber + 1;
    transaction.set(counterRef, { lastNumber: lastNumber + count }, { merge: true });
    return Array.from({ length: count }, (_, index) =>
      String(firstNumber + index).padStart(5, '0'));
  });
}

module.exports = { reserveReceiptNumbers };
