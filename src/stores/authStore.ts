import { create } from 'zustand';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { StaffUser, UserRole } from '../types';

interface AuthState {
  user: StaffUser | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setFCMToken: (token: string) => Promise<void>;
  init: () => () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  error: null,

  init: () => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        set({ user: null, loading: false });
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'staff', firebaseUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          // Backward-compat: old docs have `role` string, new have `roles` array
          const roles: UserRole[] = Array.isArray(data.roles)
            ? (data.roles as UserRole[])
            : data.role
            ? [data.role as UserRole]
            : [];
          set({
            user: { uid: firebaseUser.uid, ...data, roles } as StaffUser,
            loading: false,
            error: null,
          });
        } else {
          // Müşteri telefon auth'u — staff doc'u yok, sign-out yapmadan sessizce geç
          set({ user: null, loading: false, error: null });
        }
      } catch (e) {
        console.error('Auth init error:', e);
        set({ user: null, loading: false, error: 'Firestore erişim hatası: ' + (e instanceof Error ? e.message : String(e)) });
      }
    });
    return unsub;
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: unknown) {
      const msg = authErrorMessage(e);
      set({ error: msg, loading: false });
      throw e;
    }
  },

  signOut: async () => {
    await firebaseSignOut(auth);
    set({ user: null });
  },

  setFCMToken: async (token) => {
    const user = get().user;
    if (!user) return;
    await setDoc(
      doc(db, 'staff', user.uid),
      { fcmToken: token, updatedAt: serverTimestamp() },
      { merge: true }
    );
  },
}));

// Firebase hata kodlarını Türkçeye çevir
function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-credential':       'E-posta veya şifre hatalı.',
    'auth/user-not-found':           'Bu e-posta ile kayıtlı kullanıcı bulunamadı.',
    'auth/wrong-password':           'Şifre hatalı.',
    'auth/invalid-email':            'Geçersiz e-posta adresi.',
    'auth/user-disabled':            'Bu hesap devre dışı bırakılmış.',
    'auth/too-many-requests':        'Çok fazla başarısız deneme. Lütfen biraz bekleyin.',
    'auth/network-request-failed':   'Ağ bağlantısı hatası. İnternetinizi kontrol edin.',
    'auth/email-already-in-use':     'Bu e-posta zaten kullanımda.',
    'auth/weak-password':            'Şifre en az 6 karakter olmalıdır.',
    'auth/operation-not-allowed':    'Bu giriş yöntemi etkin değil.',
  };
  return map[code] ?? 'Giriş başarısız. Lütfen tekrar deneyin.';
}
export function hasRole(user: StaffUser | null, ...roles: UserRole[]): boolean {
  if (!user) return false;
  return user.roles.some((r) => roles.includes(r));
}
