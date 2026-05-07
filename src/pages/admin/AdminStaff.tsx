import { useState } from 'react';
import { Plus, UserCheck, Trash2, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createUserWithEmailAndPassword,
  updateProfile,
  initializeAuth,
} from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { doc, setDoc, updateDoc, serverTimestamp, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, app } from '../../lib/firebase';
import { useEffect } from 'react';
import type { StaffUser } from '../../types';

const ROLE_LABELS: Record<string, string> = {
  admin:    'Yönetici',
  kitchen:  'Mutfak',
  waiter:   'Garson',
  cashier:  'Kasa',
  clothing: 'Giyim Kasiyeri',
};

export default function AdminStaff() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [form, setForm] = useState({ email: '', password: '', displayName: '', roles: ['waiter'] as string[] });

  const toggleRole = (role: string) => {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(role)
        ? f.roles.filter((r) => r !== role)
        : [...f.roles, role],
    }));
  };

  const toggleEditRole = (role: string) => {
    setEditRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleEditOpen = (s: StaffUser) => {
    setEditingStaff(s);
    setEditRoles(Array.isArray(s.roles) ? [...s.roles] : [s.roles as unknown as string]);
  };

  const handleEditSave = async () => {
    if (!editingStaff || editRoles.length === 0) return;
    try {
      await updateDoc(doc(db, 'staff', editingStaff.uid), { roles: editRoles });
      toast.success(`${editingStaff.displayName} rolleri güncellendi.`);
      setEditingStaff(null);
      await fetchStaff();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi.');
    }
  };
  const [loading, setLoading] = useState(false);

  const fetchStaff = async () => {
    const snap = await getDocs(collection(db, 'staff'));
    setStaff(snap.docs.map((d) => {
      const data = d.data();
      const roles = Array.isArray(data.roles)
        ? data.roles
        : data.role
        ? [data.role]
        : [];
      return { uid: d.id, ...data, roles } as StaffUser;
    }));
  };

  useEffect(() => { fetchStaff(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.displayName || form.roles.length === 0) return;
    setLoading(true);
    try {
      // Use a secondary app instance so the admin session is NOT disrupted
      const secondaryApp = initializeApp(app.options, 'secondary-' + Date.now());
      const secondaryAuth = initializeAuth(secondaryApp);

      const cred = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.password);
      await updateProfile(cred.user, { displayName: form.displayName });

      // Write Firestore doc with admin's db (secondary app doesn't need its own db)
      await setDoc(doc(db, 'staff', cred.user.uid), {
        email:       form.email,
        displayName: form.displayName,
        roles:       form.roles,
        createdAt:   serverTimestamp(),
      });

      // Clean up secondary app
      await deleteApp(secondaryApp);

      toast.success(`${form.displayName} eklendi.`);
      setShowForm(false);
      setForm({ email: '', password: '', displayName: '', roles: ['waiter'] });
      await fetchStaff();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Kullanıcı oluşturulamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (uid: string, name: string) => {
    if (!confirm(`"${name}" silinsin mi?`)) return;
    try {
      // Try Cloud Function first (requires Blaze + deployed functions)
      const functions = getFunctions(app, 'europe-west1');
      const deleteStaffUser = httpsCallable(functions, 'deleteStaffUser');
      await deleteStaffUser({ uid });
    } catch {
      // Function not deployed yet — just remove from Firestore
      await deleteDoc(doc(db, 'staff', uid));
    }
    await fetchStaff();
    toast.success(`${name} silindi.`);
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-gray-800">Personel Yönetimi</h2>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm py-2">
          <Plus className="w-4 h-4" />
          Personel Ekle
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {staff.map((s) => (
          <div key={s.uid} className="card flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <UserCheck className="w-5 h-5 text-brand-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{s.displayName}</p>
              <p className="text-xs text-gray-500">{s.email}</p>
            </div>
            <div className="flex gap-1 flex-wrap">
              {(Array.isArray(s.roles) ? s.roles : [s.roles]).map((r: string) => (
                <span key={r} className="badge bg-brand-100 text-brand-700 text-xs">{ROLE_LABELS[r] ?? r}</span>
              ))}
            </div>
            <button
              onClick={() => handleEditOpen(s)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-brand-50 hover:text-brand-600"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(s.uid, s.displayName)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Edit roles modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingStaff(null)} />
          <div className="relative bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 animate-slide-in">
            <h3 className="font-bold text-gray-900 mb-1">Rol Düzenle</h3>
            <p className="text-sm text-gray-500 mb-4">{editingStaff.displayName}</p>
            <div className="flex flex-col gap-3 mb-5">
              {(['waiter', 'kitchen', 'cashier', 'clothing', 'admin'] as const).map((r) => (
                <label key={r} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editRoles.includes(r)}
                    onChange={() => toggleEditRole(r)}
                    className="w-4 h-4 rounded accent-brand-600"
                  />
                  <span className="text-sm text-gray-700">{ROLE_LABELS[r]}</span>
                </label>
              ))}
              {editRoles.length === 0 && (
                <p className="text-xs text-red-500">En az bir rol seçin.</p>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditingStaff(null)} className="btn-secondary flex-1">İptal</button>
              <button onClick={handleEditSave} disabled={editRoles.length === 0} className="btn-primary flex-1">Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* Create staff modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 animate-slide-in">
            <h3 className="font-bold text-gray-900 mb-4">Yeni Personel</h3>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="Ad Soyad"
                className="input"
                required
              />
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="E-posta"
                className="input"
                required
              />
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Şifre (min 6 karakter)"
                className="input"
                minLength={6}
                required
              />
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Rol(ler) *</p>
                <div className="flex flex-col gap-2">
                  {(['waiter', 'kitchen', 'cashier', 'clothing', 'admin'] as const).map((r) => (
                    <label key={r} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.roles.includes(r)}
                        onChange={() => toggleRole(r)}
                        className="w-4 h-4 rounded accent-brand-600"
                      />
                      <span className="text-sm text-gray-700">{ROLE_LABELS[r]}</span>
                    </label>
                  ))}
                </div>
                {form.roles.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">En az bir rol seçin.</p>
                )}
              </div>
              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">İptal</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? 'Oluşturuluyor…' : 'Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
