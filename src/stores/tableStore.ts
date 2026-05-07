import { create } from 'zustand';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  getDocs,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Table, TableStatus } from '../types';
import { nanoid } from '../utils/nanoid';

function toDate(v: unknown): Date {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return new Date();
}

interface TableStore {
  tables: Table[];
  loading: boolean;
  subscribe: () => () => void;
  addTable: (number: number, capacity: number, section?: 'normal' | 'family') => Promise<string>;
  deleteTable: (id: string) => Promise<void>;
  updateTableStatus: (id: string, status: TableStatus, orderId?: string) => Promise<void>;
  newSession: (id: string) => Promise<void>;
  getTableByQR: (qrToken: string) => Table | undefined;
  initDefaultTables: (count: number) => Promise<void>;
}

export const useTableStore = create<TableStore>((set, get) => ({
  tables: [],
  loading: false,

  subscribe: () => {
    set({ loading: true });
    const q = query(collection(db, 'tables'), orderBy('number', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const tables = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        updatedAt: toDate(d.data().updatedAt),
      })) as Table[];
      set({ tables, loading: false });
    });
    return unsub;
  },

  addTable: async (number, capacity, section = 'normal') => {
    const ref = await addDoc(collection(db, 'tables'), {
      number,
      capacity,
      status: 'available' as TableStatus,
      qrToken: nanoid(16),
      sessionId: nanoid(12),
      section,
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  deleteTable: async (id) => {
    await deleteDoc(doc(db, 'tables', id));
  },

  newSession: async (id) => {
    await updateDoc(doc(db, 'tables', id), {
      sessionId: nanoid(12),
      updatedAt: serverTimestamp(),
    });
  },

  updateTableStatus: async (id, status, orderId) => {
    const data: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
    if (orderId !== undefined) data.currentOrderId = orderId;
    await updateDoc(doc(db, 'tables', id), data);
  },

  getTableByQR: (qrToken) => {
    return get().tables.find((t) => t.qrToken === qrToken);
  },

  initDefaultTables: async (count) => {
    const snap = await getDocs(collection(db, 'tables'));
    if (!snap.empty) return; // Already initialized
    for (let i = 1; i <= count; i++) {
      await addDoc(collection(db, 'tables'), {
        number: i,
        capacity: 4,
        status: 'available' as TableStatus,
        qrToken: nanoid(16),
        sessionId: nanoid(12),
        updatedAt: serverTimestamp(),
      });
    }
  },
}));
