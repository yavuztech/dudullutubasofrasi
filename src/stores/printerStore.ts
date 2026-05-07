import { create } from 'zustand';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { PrinterSettings } from '../types';

const DEFAULTS: PrinterSettings = {
  enabled: false,
  stationMapping: {},
  bridgeUrl: 'http://localhost:3001',
};

interface PrinterState {
  settings: PrinterSettings;
  loading: boolean;
  availablePrinters: string[];
  subscribe: () => () => void;
  update: (patch: Partial<PrinterSettings>) => Promise<void>;
  fetchAvailablePrinters: () => Promise<void>;
}

export const usePrinterStore = create<PrinterState>((set, get) => ({
  settings: DEFAULTS,
  loading: true,
  availablePrinters: [],

  subscribe: () => {
    const ref = doc(db, 'settings', 'printer-config');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        set({ settings: { ...DEFAULTS, ...(snap.data() as Partial<PrinterSettings>) }, loading: false });
      } else {
        set({ settings: DEFAULTS, loading: false });
      }
    });
    return unsub;
  },

  update: async (patch) => {
    const ref = doc(db, 'settings', 'printer-config');
    await setDoc(ref, patch, { merge: true });
  },

  fetchAvailablePrinters: async () => {
    try {
      const bridgeUrl = get().settings.bridgeUrl || 'http://localhost:3001';
      const res = await fetch(`${bridgeUrl}/printers`);
      if (!res.ok) throw new Error('Bridge service ulaşılamıyor');
      const data = await res.json();
      set({ availablePrinters: data.printers || [] });
    } catch (err) {
      console.error('Yazıcı listesi alınamadı:', err);
      set({ availablePrinters: [] });
      throw err;
    }
  },
}));
