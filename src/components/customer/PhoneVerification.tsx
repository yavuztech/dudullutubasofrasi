import { useState } from 'react';
import { Phone, ShieldCheck } from 'lucide-react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { auth } from '../../lib/firebase';

interface Props {
  onVerified: (phone: string) => void;
}

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
    confirmationResult?: Awaited<ReturnType<typeof signInWithPhoneNumber>>;
  }
}

export default function PhoneVerification({ onVerified }: Props) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOTP = async () => {
    setError('');
    const formatted = phone.startsWith('+') ? phone : `+90${phone.replace(/^0/, '')}`;
    if (!/^\+90\d{10}$/.test(formatted)) {
      setError('Geçerli bir Türkiye numarası girin (5xx xxx xx xx)');
      return;
    }
    setLoading(true);
    try {
      // Her denemede yeni verifier oluştur (stale verifier auth/internal-error'a yol açar)
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch { /* ignore */ }
        window.recaptchaVerifier = undefined;
      }
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
      const result = await signInWithPhoneNumber(auth, formatted, window.recaptchaVerifier);
      window.confirmationResult = result;
      setStep('otp');
    } catch (e: unknown) {
      // Hatalı verifier'ı temizle
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch { /* ignore */ }
        window.recaptchaVerifier = undefined;
      }
      const msg = e instanceof Error ? e.message : 'SMS gönderilemedi.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setError('');
    if (otp.length !== 6) {
      setError('6 haneli kodu girin.');
      return;
    }
    setLoading(true);
    try {
      if (!window.confirmationResult) throw new Error('Önce SMS gönderin.');
      const credential = PhoneAuthProvider.credential(
        window.confirmationResult.verificationId,
        otp
      );
      await signInWithCredential(auth, credential);
      const formatted = phone.startsWith('+') ? phone : `+90${phone.replace(/^0/, '')}`;
      onVerified(formatted);
    } catch {
      setError('Kod hatalı veya süresi dolmuş. Tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card max-w-sm mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-brand-100 rounded-xl flex items-center justify-center">
          <Phone className="w-6 h-6 text-brand-600" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900">Telefon Doğrulama</h2>
          <p className="text-xs text-gray-500">Gel Al siparişi için gereklidir</p>
        </div>
      </div>

      {step === 'phone' ? (
        <>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Telefon Numarası
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="05xx xxx xx xx"
            className="input mb-3"
            inputMode="tel"
          />
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <div id="recaptcha-container" />
          <button
            onClick={handleSendOTP}
            disabled={loading || !phone}
            className="btn-primary w-full"
          >
            {loading ? 'Gönderiliyor…' : 'SMS Kodu Gönder'}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-600 mb-4">
            <span className="font-medium">{phone}</span> numarasına gönderilen 6 haneli kodu girin.
          </p>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Doğrulama Kodu
          </label>
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            className="input mb-3 text-center text-2xl tracking-[0.5em] font-mono"
            inputMode="numeric"
            maxLength={6}
          />
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <button
            onClick={handleVerifyOTP}
            disabled={loading || otp.length < 6}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            {loading ? 'Doğrulanıyor…' : 'Doğrula'}
          </button>
          <button
            onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
            className="btn-secondary w-full mt-2"
          >
            Numarayı Değiştir
          </button>
        </>
      )}
    </div>
  );
}

