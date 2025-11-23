'use client';

import { useState, useEffect } from 'react';
import { WalletProvider, useWallet } from '@/contexts/WalletContext';
import { hasStoredWallet } from '@/lib/wallet/utils';
import Onboarding from '@/components/Onboarding';
import UnlockScreen from '@/components/UnlockScreen';
import Dashboard from '@/components/Dashboard';

function WalletApp() {
  const { isUnlocked, unlockWallet } = useWallet();
  const [hasWallet, setHasWallet] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    setHasWallet(hasStoredWallet());
    setShowOnboarding(!hasStoredWallet());
  }, []);

  if (showOnboarding) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />;
  }

  if (!isUnlocked) {
    return <UnlockScreen onUnlock={unlockWallet} />;
  }

  return <Dashboard />;
}

export default function Home() {
  return (
    <WalletProvider>
      <WalletApp />
    </WalletProvider>
  );
}
