import { create } from 'zustand';
import {
  collection,
  deleteField,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  getDocs,
  writeBatch,
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
  addTable: (number: number, capacity: number, section?: 'normal' | 'family' | 'ladies') => Promise<string>;
  splitTable: (id: string, groupCapacities: number[]) => Promise<void>;
  unsplitTable: (id: string) => Promise<void>;
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
        status: d.data().status === 'occupied' ? 'occupied' : 'available',
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

  splitTable: async (id, groupCapacities) => {
    const table = get().tables.find((candidate) => candidate.id === id);
    if (!table) throw new Error('Bölünecek masa bulunamadı.');
    if (table.parentTableId) throw new Error('Alt masa tekrar bölünemez.');
    if (groupCapacities.length < 2 || groupCapacities.some((capacity) => !Number.isInteger(capacity) || capacity < 1)) {
      throw new Error('En az iki geçerli grup kapasitesi girin.');
    }
    if (groupCapacities.reduce((total, capacity) => total + capacity, 0) !== table.capacity) {
      throw new Error(`Grup kapasiteleri toplamı ${table.capacity} olmalıdır.`);
    }
    if (get().tables.some((candidate) => candidate.parentTableId === id)) {
      throw new Error('Bu masa zaten bölünmüş.');
    }

    const batch = writeBatch(db);
    const groupIds = [id];
    groupCapacities.slice(1).forEach(() => {
      groupIds.push(doc(collection(db, 'tables')).id);
    });

    batch.update(doc(db, 'tables', id), {
      capacity: groupCapacities[0],
      displayName: `${table.number}_1`,
      originalCapacity: table.capacity,
      parentTableId: id,
      splitGroupIds: groupIds,
      updatedAt: serverTimestamp(),
    });
    groupIds.slice(1).forEach((groupId, index) => {
      batch.set(doc(db, 'tables', groupId), {
        number: table.number,
        displayName: `${table.number}_${index + 2}`,
        capacity: groupCapacities[index + 1],
        status: 'available' as TableStatus,
        qrToken: nanoid(16),
        sessionId: nanoid(12),
        section: table.section ?? 'normal',
        parentTableId: id,
        splitGroupIds: groupIds,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  },

  unsplitTable: async (id) => {
    const table = get().tables.find((candidate) => candidate.id === id);
    if (!table || table.parentTableId !== id || !table.splitGroupIds?.length || !table.originalCapacity) {
      throw new Error('Bölünmüş ana masa bulunamadı.');
    }

    const groups = table.splitGroupIds
      .map((groupId) => get().tables.find((candidate) => candidate.id === groupId))
      .filter((group): group is Table => !!group);
    if (groups.length !== table.splitGroupIds.length || groups.some((group) => group.status !== 'available')) {
      throw new Error('Masa bölünmesini kaldırmak için tüm alt masalar boş olmalıdır.');
    }

    const activeOrders = await getDocs(query(
      collection(db, 'orders'),
      where('tableId', 'in', table.splitGroupIds),
      where('tableSection', '==', table.section ?? 'normal'),
    ));
    if (activeOrders.docs.some((order) => ['pending', 'preparing', 'ready', 'delivered'].includes(order.data().status))) {
      throw new Error('Alt masalarda aktif sipariş varken bölünme kaldırılamaz.');
    }

    const batch = writeBatch(db);
    table.splitGroupIds.filter((groupId) => groupId !== id).forEach((groupId) => {
      batch.delete(doc(db, 'tables', groupId));
    });
    batch.update(doc(db, 'tables', id), {
      capacity: table.originalCapacity,
      displayName: deleteField(),
      originalCapacity: deleteField(),
      parentTableId: deleteField(),
      splitGroupIds: deleteField(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
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
