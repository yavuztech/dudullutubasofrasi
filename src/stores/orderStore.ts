import { create } from 'zustand';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Order, OrderStatus, OrderItem } from '../types';

function toDate(v: unknown): Date {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return new Date();
}

function fromSnap(id: string, data: Record<string, unknown>): Order {
  return {
    ...(data as Omit<Order, 'id' | 'createdAt' | 'updatedAt'>),
    id,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

interface OrderStore {
  orders: Order[];
  loading: boolean;
  subscribe: (statusFilter?: OrderStatus[]) => () => void;
  createOrder: (
    order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<string>;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  updateOrderItems: (id: string, items: OrderItem[]) => Promise<void>;
  addItemsToOrder: (id: string, items: OrderItem[]) => Promise<void>;
}

export const useOrderStore = create<OrderStore>((set) => ({
  orders: [],
  loading: false,

  subscribe: (statusFilter) => {
    set({ loading: true });
    const ref = collection(db, 'orders');
    const q = statusFilter?.length
      ? query(ref, where('status', 'in', statusFilter))
      : query(ref, orderBy('createdAt', 'asc'));

    const unsub = onSnapshot(q, (snap) => {
      const orders = snap.docs
        .map((d) => fromSnap(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      set({ orders, loading: false });
    }, (err) => {
      console.error('orderStore subscribe error:', err);
      set({ loading: false });
    });
    return unsub;
  },

  createOrder: async (orderData) => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore bağlantısı zaman aşımına uğradı [timeout]')), 10000)
    );
    const ref = await Promise.race([
      addDoc(collection(db, 'orders'), {
        ...orderData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
      timeout,
    ]);
    return ref.id;
  },

  updateOrderStatus: async (id, status) => {
    await updateDoc(doc(db, 'orders', id), {
      status,
      updatedAt: serverTimestamp(),
    });
  },

  updateOrderItems: async (id, items) => {
    const totalAmount = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const update: Record<string, unknown> = { items, totalAmount, updatedAt: serverTimestamp() };
    if (items.length === 0) update.status = 'cancelled';
    await updateDoc(doc(db, 'orders', id), update);
  },

  addItemsToOrder: async (id, newItems) => {
    // Merge with existing items via cloud function or client read+write
    const snap = await import('firebase/firestore').then(({ getDoc }) =>
      getDoc(doc(db, 'orders', id))
    );
    if (!snap.exists()) return;
    const existing = (snap.data().items ?? []) as OrderItem[];
    await updateDoc(doc(db, 'orders', id), {
      items: [...existing, ...newItems],
      updatedAt: serverTimestamp(),
    });
  },
}));
