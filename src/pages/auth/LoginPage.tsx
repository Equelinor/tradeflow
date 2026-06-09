import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { auth } from '@/firebase';
import { APP_NAME } from '@/config';

type Mode = 'choose' | 'email' | 'phone' | 'otp';

// ── Rate limiting — P2 ────────────────────────────────────────
// Track failed attempts in memory. Not persisted (resets on page
// reload) which is intentional — prevents lockout from cached state.
const ATTEMPT_LIMIT  = 5;
const LOCKOUT_MS     = 5 * 60 * 1000; // 5 minutes

interface AttemptState {
  count:   number;
  lockedUntil: number | null;
}

function getAttempts(): AttemptState {
  try {
    const raw = sessionStorage.getItem('tf_login_attempts');
    return raw ? JSON.parse(raw) : { count: 0, lockedUntil: null };
  } catch { return { count: 0, lockedUntil: null }; }
}

function recordFailedAttempt(): AttemptState {
  const prev = getAttempts();
  const count = prev.count + 1;
  const lockedUntil = count >= ATTEMPT_LIMIT ? Date.now() + LOCKOUT_MS : null;
  const next = { count, lockedUntil };
  sessionStorage.setItem('tf_login_attempts', JSON.stringify(next));
  return next;
}

function clearAttempts() {
  sessionStorage.removeItem('tf_login_attempts');
}

function getLockoutSeconds(): number {
  const { lockedUntil } = getAttempts();
  if (!lockedUntil) return 0;
  return Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
}

// ── Password strength — P2 ────────────────────────────────────
function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: 'Weak',   color: 'bg-red-500'    };
  if (score <= 2) return { score, label: 'Fair',   color: 'bg-amber-500'  };
  if (score <= 3) return { score, label: 'Good',   color: 'bg-yellow-500' };
  return              { score, label: 'Strong', color: 'bg-emerald-500' };
}

export default function LoginPage() {
  const navigate = useNavigate();

  const [mode, setMode]         = useState<Mode>('choose');
  const [phone, setPhone]       = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [otp, setOtp]           = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [lockoutSecs, setLockoutSecs] = useState(getLockoutSeconds());

  const confirmRef    = useRef<ConfirmationResult | null>(null);
  const recaptchaRef  = useRef<RecaptchaVerifier | null>(null);
  const recaptchaDivRef = useRef<HTMLDivElement>(null);

  const strength = getPasswordStrength(password);

  // ── Lockout countdown timer ───────────────────────────────
  useEffect(() => {
    if (lockoutSecs <= 0) return;
    const t = setInterval(() => {
      const s = getLockoutSeconds();
      setLockoutSecs(s);
      if (s <= 0) { clearAttempts(); clearInterval(t); }
    }, 1000);
    return () => clearInterval(t);
  }, [lockoutSecs]);

  // ── reCAPTCHA cleanup on unmount — P1 ────────────────────
  useEffect(() => {
    return () => {
      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
        recaptchaRef.current = null;
      }
    };
  }, []);

  // ── reCAPTCHA init — P1 ───────────────────────────────────
  const initRecaptcha = useCallback(() => {
    // Always clear before creating a new one — prevents duplicate error
    if (recaptchaRef.current) {
      recaptchaRef.current.clear();
      recaptchaRef.current = null;
    }
    if (!recaptchaDivRef.current) return;
    recaptchaRef.current = new RecaptchaVerifier(
      auth,
      recaptchaDivRef.current,
      { size: 'invisible' }
    );
  }, []);

  function clearError() { setError(''); }

  // ── Email login with rate limiting ────────────────────────
  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (lockoutSecs > 0) return;
    setLoading(true); clearError();

    try {
      // P2: set session persistence based on remember me choice
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );
      await signInWithEmailAndPassword(auth, email, password);
      clearAttempts();
      navigate('/dashboard');
    } catch (err: any) {
      const state = recordFailedAttempt();
      if (state.lockedUntil) {
        setLockoutSecs(getLockoutSeconds());
        setError(`Too many failed attempts. Please wait ${Math.ceil(LOCKOUT_MS / 60000)} minutes.`);
      } else {
        const remaining = ATTEMPT_LIMIT - state.count;
        setError(
          err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password'
            ? `Invalid email or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
            : 'Sign in failed. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Phone OTP — send — P1 fix ─────────────────────────────
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (lockoutSecs > 0) return;
    setLoading(true); clearError();
    try {
      initRecaptcha();
      const formatted = phone.startsWith('+') ? phone : `+973${phone.replace(/\s/g, '')}`;
      confirmRef.current = await signInWithPhoneNumber(
        auth, formatted, recaptchaRef.current!
      );
      setMode('otp');
    } catch (err: any) {
      // Reset reCAPTCHA so user can try again cleanly
      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
        recaptchaRef.current = null;
      }
      const state = recordFailedAttempt();
      if (state.lockedUntil) {
        setLockoutSecs(getLockoutSeconds());
        setError(`Too many attempts. Please wait ${Math.ceil(LOCKOUT_MS / 60000)} minutes.`);
      } else {
        setError('Could not send OTP. Check the number and try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Phone OTP — verify ────────────────────────────────────
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmRef.current) return;
    setLoading(true); clearError();
    try {
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );
      await confirmRef.current.confirm(otp);
      clearAttempts();
      navigate('/dashboard');
    } catch {
      const state = recordFailedAttempt();
      if (state.lockedUntil) {
        setLockoutSecs(getLockoutSeconds());
        setError(`Too many attempts. Please wait ${Math.ceil(LOCKOUT_MS / 60000)} minutes.`);
      } else {
        setError('Invalid OTP. Please check and try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  const isLocked = lockoutSecs > 0;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      {/* reCAPTCHA container — P1: ref-based, properly cleaned up */}
      <div ref={recaptchaDivRef} />

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">TF</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">{APP_NAME}</h1>
          <p className="text-sm text-gray-500 mt-1">Business management for traders</p>
        </div>

        {/* Lockout banner */}
        {isLocked && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
            <i className="ti ti-lock text-red-600" aria-hidden="true" />
            <p className="text-sm text-red-700">
              Too many failed attempts. Try again in{' '}
              <strong>{Math.floor(lockoutSecs / 60)}:{String(lockoutSecs % 60).padStart(2, '0')}</strong>
            </p>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">

          {/* Choose method */}
          {mode === 'choose' && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700 text-center mb-5">
                Sign in to your account
              </p>
              <button
                onClick={() => setMode('phone')}
                disabled={isLocked}
                className="w-full flex items-center gap-3 px-4 h-12 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-colors text-sm font-medium text-gray-700 disabled:opacity-40"
              >
                <i className="ti ti-phone text-lg text-emerald-600" aria-hidden="true" />
                Continue with Phone
              </button>
              <button
                onClick={() => setMode('email')}
                disabled={isLocked}
                className="w-full flex items-center gap-3 px-4 h-12 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 disabled:opacity-40"
              >
                <i className="ti ti-mail text-lg text-gray-500" aria-hidden="true" />
                Continue with Email
              </button>
            </div>
          )}

          {/* Email form */}
          {mode === 'email' && (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <button
                type="button"
                onClick={() => { setMode('choose'); clearError(); }}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-2"
              >
                <i className="ti ti-arrow-left" aria-hidden="true" /> Back
              </button>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email" required value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    required value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full h-12 px-4 pr-11 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    <i className={`ti ${showPw ? 'ti-eye-off' : 'ti-eye'} text-lg`} aria-hidden="true" />
                  </button>
                </div>
                {/* P2: Password strength indicator */}
                {password.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex gap-1 flex-1">
                      {[1,2,3,4].map(i => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-all ${
                            i <= strength.score ? strength.color : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">{strength.label}</span>
                  </div>
                )}
              </div>

              {/* P2: Session persistence choice */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600"
                />
                <span className="text-sm text-gray-600">Keep me signed in on this device</span>
              </label>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || isLocked}
                className="w-full h-12 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* Phone form */}
          {mode === 'phone' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <button
                type="button"
                onClick={() => { setMode('choose'); clearError(); }}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-2"
              >
                <i className="ti ti-arrow-left" aria-hidden="true" /> Back
              </button>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Phone number
                </label>
                <div className="flex gap-2">
                  <div className="h-12 px-3 rounded-xl border border-gray-200 flex items-center text-sm text-gray-500 bg-gray-50 whitespace-nowrap flex-shrink-0">
                    🇧🇭 +973
                  </div>
                  <input
                    type="tel" required value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="3300 0000"
                    inputMode="numeric"
                    autoComplete="tel"
                    className="flex-1 h-12 px-4 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  Bahrain numbers. For other countries include full country code.
                </p>
              </div>

              {/* P2: Session persistence */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600"
                />
                <span className="text-sm text-gray-600">Keep me signed in on this device</span>
              </label>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || isLocked}
                className="w-full h-12 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </form>
          )}

          {/* OTP verification */}
          {mode === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center mb-2">
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                  <i className="ti ti-message text-xl text-emerald-600" aria-hidden="true" />
                </div>
                <p className="text-sm font-medium text-gray-700">Enter the OTP sent to</p>
                <p className="text-sm text-emerald-600 font-medium">+973 {phone}</p>
              </div>

              <input
                type="text" required value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                className="w-full h-14 px-4 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors text-center text-2xl tracking-widest font-mono"
              />

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || otp.length < 6 || isLocked}
                className="w-full h-12 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>

              <button
                type="button"
                onClick={() => { setMode('phone'); clearError(); setOtp(''); }}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                ← Change number
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          TradeFlow · Business Management Platform
        </p>
      </div>
    </div>
  );
}
