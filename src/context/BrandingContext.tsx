import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { DEFAULT_THEME } from '@/config';
import type { BrandingState } from '@/types';

const defaultBranding: BrandingState = {
  companyName: 'TradeFlow',
  logoUrl:     null,
  themeColor:  DEFAULT_THEME,
  address:     '',
  phone:       '',
  email:       '',
  crNumber:    null,
  vatNumber:   null,
  currency:    'BHD',
};

const BrandingContext = createContext<BrandingState>(defaultBranding);

export function BrandingProvider({
  children,
  companyId,
}: {
  children: React.ReactNode;
  companyId: string;
}) {
  const [branding, setBranding] = useState<BrandingState>(defaultBranding);

  useEffect(() => {
    if (!companyId) return;

    getDoc(doc(db, `companies/${companyId}`)).then((snap) => {
      if (!snap.exists()) return;
      const d = snap.data();

      const b: BrandingState = {
        companyName: d.name        ?? 'TradeFlow',
        logoUrl:     d.logoUrl     ?? null,
        themeColor:  d.themeColor  ?? DEFAULT_THEME,
        address:     d.address     ?? '',
        phone:       d.phone       ?? '',
        email:       d.email       ?? '',
        crNumber:    d.crNumber    ?? null,
        vatNumber:   d.vatNumber   ?? null,
        currency:    d.currency    ?? 'BHD',
      };

      setBranding(b);

      // Inject CSS variables for brand color
      document.documentElement.style.setProperty('--brand-color', b.themeColor);
    });
  }, [companyId]);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingState {
  return useContext(BrandingContext);
}
