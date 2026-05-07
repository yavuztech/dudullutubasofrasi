import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

const ROLE_ROUTES: Record<string, string> = {
  kitchen:  '/kitchen/orders',
  waiter:   '/waiter',
  cashier:  '/cashier',
  clothing: '/clothing',
  admin:    '/admin/staff',
};

export default function LoginPage() {
  const { signIn, error, user, loading } = useAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Redirect when user is set in store — use first role to determine default page
  useEffect(() => {
    if (user) {
      const firstRole = user.roles[0];
      navigate(ROLE_ROUTES[firstRole] ?? '/', { replace: true });
    }
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
      // Navigation handled by useEffect above
    } catch {
      // error shown from store
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg">
            <ChefHat className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-bold text-gray-900 text-xl">Tuba Sofrası</h1>
          <p className="text-gray-500 text-sm mt-1">Personel Girişi</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">E-posta</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@dudullutubasofrasi.com"
              className="input"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Şifre</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input pr-11"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || loading}
            className="btn-primary w-full mt-2"
          >
            {(submitting || loading) ? 'Giriş Yapılıyor…' : 'Giriş Yap'}
          </button>
        </form>

        <p className="text-xs text-center text-gray-400 mt-6">
          Müşteri menüsüne gitmek için masadaki QR kodu okutun.
        </p>
      </div>
    </div>
  );
}
