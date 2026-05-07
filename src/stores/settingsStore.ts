import { create } from 'zustand';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { GelAlSettings } from '../types';

const DEFAULTS: GelAlSettings = {
  phoneVerification: true,
  whatsappEnabled: false,
  whatsappNumber: '',
  staffDiscount: false,
  staffDiscountRate: 20,
  enableTableCleaning: true,
};

interface SettingsState {
  settings: GelAlSettings;
  loading: boolean;
  subscribe: () => () => void;
  update: (patch: Partial<GelAlSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULTS,
  loading: true,

  subscribe: () => {
    const ref = doc(db, 'settings', 'gel-al');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        set({ settings: { ...DEFAULTS, ...(snap.data() as Partial<GelAlSettings>) }, loading: false });
      } else {
        set({ settings: DEFAULTS, loading: false });
      }
    });
    return unsub;
  },

  update: async (patch) => {
    const ref = doc(db, 'settings', 'gel-al');
    await setDoc(ref, patch, { merge: true });
  },
}));
