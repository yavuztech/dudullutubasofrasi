import { create } from 'zustand';
import {
  collection,
  onSnapshot,
  doc,
  runTransaction,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ClothingSale, ClothingSaleItem } from '../types';

function toDate(v: unknown): Date {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return new Date();
}

interface CreateSaleParams {
  items: ClothingSaleItem[];
  customerName?: string;
  totalAmount: number;
  discountApplied: boolean;
  discountRate: number;
}

interface ClothingStore {
  sales: ClothingSale[];
  loading: boolean;
  subscribeSales: () => () => void;
  createSale: (params: CreateSaleParams) => Promise<void>;
}

export const useClothingStore = create<ClothingStore>((set) => ({
  sales: [],
  loading: false,

  subscribeSales: () => {
    set({ loading: true });
    const q = query(collection(db, 'clothingSales'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const sales = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: toDate(d.data().createdAt),
      })) as ClothingSale[];
      set({ sales, loading: false });
    });
    return unsub;
  },

  createSale: async ({ items, customerName, totalAmount, discountApplied, discountRate }) => {
    // Firestore transaction: check stock >= qty for each item, then decrement and write sale
    await runTransaction(db, async (tx) => {
      // Read all product docs first
      const productRefs = items.map((item) => doc(db, 'products', item.productId));
      const productSnaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));

      // Validate stock
      for (let i = 0; i < items.length; i++) {
        const snap = productSnaps[i];
        const data = snap.data();
        if (!snap.exists() || data === undefined) {
          throw new Error(`Ürün bulunamadı: ${items[i].productName}`);
        }
        const currentStock = typeof data.stock === 'number' ? data.stock : Infinity;
        if (currentStock < items[i].quantity) {
          throw new Error(`"${items[i].productName}" için yeterli stok yok. Mevcut: ${currentStock}`);
        }
      }

      // Decrement stock for each item
      for (let i = 0; i < items.length; i++) {
        const snap = productSnaps[i];
        const data = snap.data()!;
        if (typeof data.stock === 'number') {
          tx.update(productRefs[i], {
            stock: data.stock - items[i].quantity,
            updatedAt: serverTimestamp(),
          });
        }
      }

      // Write sale record
      const saleRef = doc(collection(db, 'clothingSales'));
      tx.set(saleRef, {
        items,
        customerName: customerName ?? null,
        totalAmount,
        discountApplied,
        discountRate,
        createdAt: serverTimestamp(),
      });
    });
  },
}));
