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
  increment,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Product, Category } from '../types';

function toDate(v: unknown): Date {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return new Date();
}

interface ProductStore {
  products: Product[];
  categories: Category[];
  loading: boolean;
  subscribe: () => () => void;
  subscribeCategories: () => () => void;
  addProduct: (p: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  toggleAvailability: (id: string, available: boolean) => Promise<void>;
  updateStock: (id: string, delta: number) => Promise<void>;
  addCategory: (name: string, sortOrder: number, department?: 'food' | 'clothing', kitchenStation?: string) => Promise<string>;
  updateCategory: (id: string, data: Partial<Omit<Category, 'id'>>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

export const useProductStore = create<ProductStore>((set) => ({
  products: [],
  categories: [],
  loading: false,

  subscribe: () => {
    set({ loading: true });
    const q = query(collection(db, 'products'), orderBy('sortOrder', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const products = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: toDate(d.data().createdAt),
        updatedAt: toDate(d.data().updatedAt),
      })) as Product[];
      set({ products, loading: false });
    });
    return unsub;
  },

  subscribeCategories: () => {
    const q = query(collection(db, 'categories'), orderBy('sortOrder', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const categories = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Category[];
      set({ categories });
    });
    return unsub;
  },

  addProduct: async (p) => {
    const ref = await addDoc(collection(db, 'products'), {
      ...p,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  updateProduct: async (id, data) => {
    await updateDoc(doc(db, 'products', id), { ...data, updatedAt: serverTimestamp() });
  },

  deleteProduct: async (id) => {
    await deleteDoc(doc(db, 'products', id));
  },

  toggleAvailability: async (id, available) => {
    await updateDoc(doc(db, 'products', id), { available, updatedAt: serverTimestamp() });
  },

  updateStock: async (id, delta) => {
    await updateDoc(doc(db, 'products', id), { stock: increment(delta), updatedAt: serverTimestamp() });
  },

  addCategory: async (name, sortOrder, department = 'food', kitchenStation) => {
    const ref = await addDoc(collection(db, 'categories'), {
      name,
      sortOrder,
      department,
      ...(kitchenStation ? { kitchenStation } : {}),
    });
    return ref.id;
  },

  updateCategory: async (id, data) => {
    await updateDoc(doc(db, 'categories', id), data);
  },

  deleteCategory: async (id) => {
    await deleteDoc(doc(db, 'categories', id));
  },
}));
