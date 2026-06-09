import { useEffect, useRef, useCallback, useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/firebase';

const IDLE_WARN_MS   = 25 * 60 * 1000;  // warn at 25 min
const IDLE_LOGOUT_MS = 30 * 60 * 1000;  // logout at 30 min

const ACTIVITY_EVENTS = [
  'mousedown', 'mousemove', 'keydown',
  'scroll', 'touchstart', 'click', 'focus',
];

// ─────────────────────────────────────────────────────────────
// P2: Idle session timeout
// Shows a warning banner at 25 min, auto-logs out at 30 min.
// Resets on any user activity. Only active when user is logged in.
// ─────────────────────────────────────────────────────────────
export function useIdleTimeout(isActive: boolean) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const warnTimerRef   = useRef<ReturnType<typeof setTimeout>>();
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const countdownRef   = useRef<ReturnType<typeof setInterval>>();

  const clearTimers = useCallback(() => {
    clearTimeout(warnTimerRef.current);
    clearTimeout(logoutTimerRef.current);
    clearInterval(countdownRef.current);
  }, []);

  const resetTimers = useCallback(() => {
    if (!isActive) return;
    clearTimers();
    setShowWarning(false);

    warnTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setSecondsLeft(Math.round((IDLE_LOGOUT_MS - IDLE_WARN_MS) / 1000));

      // Countdown tick
      countdownRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) { clearInterval(countdownRef.current); return 0; }
          return s - 1;
        });
      }, 1000);

      // Auto logout
      logoutTimerRef.current = setTimeout(async () => {
        clearTimers();
        setShowWarning(false);
        await signOut(auth);
      }, IDLE_LOGOUT_MS - IDLE_WARN_MS);

    }, IDLE_WARN_MS);
  }, [isActive, clearTimers]);

  // Attach activity listeners
  useEffect(() => {
    if (!isActive) { clearTimers(); return; }

    resetTimers();

    const handler = () => resetTimers();
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, handler, { passive: true }));

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, handler));
    };
  }, [isActive, resetTimers, clearTimers]);

  const stayLoggedIn = useCallback(() => {
    setShowWarning(false);
    resetTimers();
  }, [resetTimers]);

  const logoutNow = useCallback(async () => {
    clearTimers();
    setShowWarning(false);
    await signOut(auth);
  }, [clearTimers]);

  return { showWarning, secondsLeft, stayLoggedIn, logoutNow };
}
