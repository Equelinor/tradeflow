import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/firebase';
import type { AuthState, UserRole, Plan } from '@/types';

// P1 fix: expose companyStatus separately from plan
// Suspended companies need a hard blocked screen, not just plan: 'basic'
export type CompanyStatus =
  | 'trial'
  | 'active'
  | 'grace_period'
  | 'suspended'
  | 'cancelled';

export interface AuthStateExtended extends AuthState {
  companyStatus: CompanyStatus;
}

const defaultState: AuthStateExtended = {
  uid:           '',
  companyId:     '',
  role:          'viewer',
  plan:          'basic',
  name:          '',
  loading:       true,
  companyStatus: 'trial',
};

const AuthContext = createContext<AuthStateExtended>(defaultState);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthStateExtended>(defaultState);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ ...defaultState, loading: false });
        return;
      }

      try {
        // ── Step 1: resolve companyId ─────────────────────────
        const lookupSnap = await getDoc(doc(db, `userCompany/${user.uid}`));
        let companyId: string;

        if (lookupSnap.exists()) {
          companyId = lookupSnap.data().companyId as string;
        } else {
          const ownerSnap = await getDoc(doc(db, `companies/${user.uid}`));
          if (ownerSnap.exists()) {
            companyId = user.uid;
          } else {
            setState({ ...defaultState, uid: user.uid, loading: false });
            return;
          }
        }

        // ── Step 2: load user profile ─────────────────────────
        const userSnap = await getDoc(
          doc(db, `companies/${companyId}/users/${user.uid}`)
        );

        if (!userSnap.exists()) {
          setState({ ...defaultState, uid: user.uid, loading: false });
          return;
        }

        const userData = userSnap.data();

        // P1: inactive users are force signed out
        if (userData.status === 'inactive') {
          await auth.signOut();
          setState({ ...defaultState, loading: false });
          return;
        }

        // ── Step 3: load company ──────────────────────────────
        const companySnap = await getDoc(doc(db, `companies/${companyId}`));

        if (!companySnap.exists()) {
          await auth.signOut();
          setState({ ...defaultState, loading: false });
          return;
        }

        const companyData  = companySnap.data();
        const plan: Plan   = (companyData.plan as Plan) ?? 'basic';
        const companyStatus = (companyData.status as CompanyStatus) ?? 'trial';

        // P1 fix: suspended/cancelled companies get their own status
        // App.tsx will show a hard SuspendedScreen instead of the app
        // We no longer silently assign plan: 'basic' and let them wander
        setState({
          uid:    user.uid,
          companyId,
          role:   userData.role as UserRole,
          // P1: suspended companies get no plan features
          plan:   (companyStatus === 'suspended' || companyStatus === 'cancelled')
                  ? 'basic'
                  : plan,
          name:          userData.name as string,
          loading:       false,
          companyStatus,
        });

      } catch (err) {
        console.error('[AuthContext]', err);
        setState({ ...defaultState, uid: user.uid, loading: false });
      }
    });

    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={state}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthStateExtended {
  return useContext(AuthContext);
}
