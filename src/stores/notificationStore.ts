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
import type { NotificationRecord } from '../types';

function toDate(v: unknown): Date {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return new Date();
}

interface NotificationStore {
  notifications: NotificationRecord[];
  unreadCount: number;
  subscribe: (targetRole: string) => () => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  createNotification: (
    n: Omit<NotificationRecord, 'id' | 'sentAt' | 'read'>
  ) => Promise<void>;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  subscribe: (targetRole) => {
    const q = query(
      collection(db, 'notifications'),
      where('targetRole', 'in', [targetRole, 'all']),
      orderBy('sentAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const notifications = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        sentAt: toDate(d.data().sentAt),
      })) as NotificationRecord[];
      const unreadCount = notifications.filter((n) => !n.read).length;
      set({ notifications, unreadCount });
    });
    return unsub;
  },

  markRead: async (id) => {
    // Optimistic update — UI responds instantly
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      return { notifications, unreadCount: notifications.filter((n) => !n.read).length };
    });
    await updateDoc(doc(db, 'notifications', id), { read: true });
  },

  markAllRead: async () => {
    // Snapshot unread list BEFORE optimistic update
    const unread = get().notifications.filter((n) => !n.read);
    // Optimistic update — mark all read in local state immediately
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
    await Promise.all(
      unread.map((n) => updateDoc(doc(db, 'notifications', n.id), { read: true }))
    );
  },

  createNotification: async (n) => {
    await addDoc(collection(db, 'notifications'), {
      ...n,
      sentAt: serverTimestamp(),
      read: false,
    });
  },
}));
