'use client';

import { useState } from 'react';
import { generateWallet, importWalletFromMnemonic, importWalletFromPrivateKey, encryptWallet, storeWallet, hasStoredWallet } from '@/lib/wallet/utils';
import { Wallet, Download } from 'lucide-react';

type Step = 'welcome' | 'create' | 'import' | 'import-mnemonic' | 'import-private' | 'backup' | 'password';

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>(hasStoredWallet() ? 'welcome' : 'welcome');
  const [mnemonic, setMnemonic] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [backupConfirmed, setBackupConfirmed] = useState(false);

  const handleCreateWallet = () => {
    const wallet = generateWallet();
    setMnemonic(wallet.mnemonic);
    setStep('backup');
  };

  const handleImportMnemonic = () => {
    try {
      const wallet = importWalletFromMnemonic(mnemonic.trim());
      setMnemonic(wallet.mnemonic);
      setStep('password');
    } catch (err: any) {
      setError(err.message || 'Invalid mnemonic phrase');
    }
  };

  const handleImportPrivateKey = () => {
    try {
      const wallet = importWalletFromPrivateKey(privateKey.trim());
      setMnemonic(''); // No mnemonic for private key import
      setStep('password');
    } catch (err: any) {
      setError(err.message || 'Invalid private key');
    }
  };

  const handleSetPassword = () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      let wallet: any;
      if (mnemonic) {
        wallet = importWalletFromMnemonic(mnemonic);
      } else if (privateKey) {
        wallet = importWalletFromPrivateKey(privateKey);
      } else {
        setError('No wallet data found');
        return;
      }

      const encrypted = encryptWallet(wallet, password);
      storeWallet(encrypted);
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to create wallet');
    }
  };

  if (step === 'welcome') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
        <div className="max-w-2xl w-full glass rounded-3xl p-8 md:p-12">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 mb-6 shadow-lg shadow-indigo-500/30">
              <Wallet className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-3">VaultX</h1>
            <p className="text-gray-400 text-lg">Your secure non-custodial crypto wallet</p>
          </div>

          {hasStoredWallet() ? (
            <div className="space-y-6">
              <button
                onClick={() => onComplete()}
                className="btn btn-primary w-full py-4 px-6 rounded-2xl text-xl font-semibold shadow-lg shadow-indigo-500/20 hover:scale-[1.02] transition-all"
              >
                Unlock Existing Wallet
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <button
                onClick={() => setStep('create')}
                className="btn btn-primary w-full py-4 px-6 rounded-2xl text-xl font-semibold shadow-lg shadow-indigo-500/20 hover:scale-[1.02] transition-all"
              >
                Create New Wallet
              </button>
              <button
                onClick={() => setStep('import')}
                className="btn btn-secondary w-full py-3 px-6 rounded-xl text-lg border-gray-600 text-gray-300 hover:bg-gray-800 hover:border-gray-500"
              >
                Import Wallet
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === 'create') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
        <div className="max-w-2xl w-full glass rounded-3xl p-8 md:p-12">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3">Create New Wallet</h2>
            <p className="text-gray-400 text-lg">
              We'll generate a secure wallet for you. Make sure to backup your recovery phrase!
            </p>
          </div>
          <div className="space-y-5">
            <button
              onClick={handleCreateWallet}
              className="btn btn-primary w-full py-4 px-6 rounded-2xl text-xl font-semibold shadow-lg shadow-indigo-500/20 hover:scale-[1.02] transition-all"
            >
              Generate Wallet
            </button>
            <button
              onClick={() => setStep('welcome')}
              className="btn btn-ghost w-full py-4 px-6 rounded-2xl text-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'import') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
        <div className="max-w-2xl w-full glass rounded-3xl p-8 md:p-12">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3">Import Wallet</h2>
            <p className="text-gray-400 text-lg">Choose how you want to access your wallet</p>
          </div>
          <div className="space-y-5">
            <button
              onClick={() => setStep('import-mnemonic')}
              className="btn btn-primary w-full py-4 px-6 rounded-2xl text-xl font-semibold shadow-lg shadow-indigo-500/20 hover:scale-[1.02] transition-all"
            >
              Import with Recovery Phrase
            </button>
            <button
              onClick={() => setStep('import-private')}
              className="btn btn-secondary w-full py-4 px-6 rounded-2xl text-xl font-semibold border-gray-600 text-gray-300 hover:bg-gray-800 hover:border-gray-500 transition-all"
            >
              Import with Private Key
            </button>
            <button
              onClick={() => setStep('welcome')}
              className="btn btn-ghost w-full py-4 px-6 rounded-2xl text-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'import-mnemonic') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
        <div className="max-w-2xl w-full glass rounded-3xl p-8 md:p-12">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3">Import Recovery Phrase</h2>
            <p className="text-gray-400 text-lg">Enter your 12 or 24 word recovery phrase</p>
          </div>
          <textarea
            value={mnemonic}
            onChange={(e) => {
              setMnemonic(e.target.value);
              setError('');
            }}
            placeholder="word1 word2 word3..."
            className="w-full bg-black/30 border border-white/10 rounded-2xl p-5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 mb-6 min-h-40 text-lg"
          />
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-6">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          <div className="space-y-5">
            <button
              onClick={handleImportMnemonic}
              className="btn btn-primary w-full py-4 px-6 rounded-2xl text-xl font-semibold shadow-lg shadow-indigo-500/20 hover:scale-[1.02] transition-all"
            >
              Import
            </button>
            <button
              onClick={() => {
                setStep('import');
                setMnemonic('');
                setError('');
              }}
              className="btn btn-ghost w-full py-4 px-6 rounded-2xl text-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'import-private') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
        <div className="max-w-2xl w-full glass rounded-3xl p-8 md:p-12">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3">Import Private Key</h2>
            <p className="text-gray-400 text-lg">Enter your private key (keep it secure!)</p>
          </div>
          <textarea
            value={privateKey}
            onChange={(e) => {
              setPrivateKey(e.target.value);
              setError('');
            }}
            placeholder="0x..."
            className="w-full bg-black/30 border border-white/10 rounded-2xl p-5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 mb-6 min-h-40 font-mono text-base"
          />
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-6">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          <div className="space-y-5">
            <button
              onClick={handleImportPrivateKey}
              className="btn btn-primary w-full py-4 px-6 rounded-2xl text-xl font-semibold shadow-lg shadow-indigo-500/20 hover:scale-[1.02] transition-all"
            >
              Import
            </button>
            <button
              onClick={() => {
                setStep('import');
                setPrivateKey('');
                setError('');
              }}
              className="btn btn-ghost w-full py-4 px-6 rounded-2xl text-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'backup') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
        <div className="max-w-2xl w-full glass rounded-3xl p-8 md:p-12">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3">Backup Recovery Phrase</h2>
            <p className="text-red-400 text-base font-semibold bg-red-500/10 py-2 px-4 rounded-xl inline-block">
              ⚠️ Write down these words in order. Never share them with anyone!
            </p>
          </div>
          
          {!showMnemonic ? (
            <button
              onClick={() => setShowMnemonic(true)}
              className="btn btn-primary w-full py-4 px-6 rounded-2xl text-xl font-semibold shadow-lg shadow-indigo-500/20 hover:scale-[1.02] transition-all mb-6"
            >
              Reveal Recovery Phrase
            </button>
          ) : (
            <>
              <div className="bg-black/30 border border-white/10 rounded-2xl p-8 mb-8">
                <div className="grid grid-cols-3 gap-4">
                  {mnemonic.split(' ').map((word, i) => (
                    <div key={i} className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                      <span className="text-xs text-gray-500 block mb-1">{i + 1}</span>
                      <p className="text-white font-medium text-lg">{word}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Download Button */}
              <button
                onClick={() => {
                  const content = `VaultX - Recovery Phrase Backup\n\n` +
                    `IMPORTANT: Keep this file secure and private!\n` +
                    `Never share your recovery phrase with anyone.\n\n` +
                    `Recovery Phrase:\n${mnemonic}\n\n` +
                    `Date: ${new Date().toLocaleString()}\n\n` +
                    `Instructions:\n` +
                    `1. Store this file in a secure location\n` +
                    `2. Never store it online or in cloud storage\n` +
                    `3. Consider printing it and storing it physically\n` +
                    `4. If you lose this phrase, you will lose access to your wallet permanently`;
                  
                  const blob = new Blob([content], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `vaultx-recovery-phrase-${Date.now()}.txt`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="w-full flex items-center justify-center space-x-3 bg-white/5 hover:bg-white/10 text-white font-semibold py-4 px-6 rounded-2xl border border-white/10 transition-all duration-200 mb-6 text-lg"
              >
                <Download className="w-6 h-6" />
                <span>Download Recovery Phrase</span>
              </button>
            </>
          )}

          <label className="flex items-center space-x-3 mb-8 cursor-pointer bg-white/5 p-4 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
            <input
              type="checkbox"
              checked={backupConfirmed}
              onChange={(e) => setBackupConfirmed(e.target.checked)}
              className="w-6 h-6 rounded border-gray-500 text-indigo-600 focus:ring-indigo-500 bg-transparent"
            />
            <span className="text-gray-300 text-base">
              I have securely backed up my recovery phrase
            </span>
          </label>

          <button
            onClick={() => setStep('password')}
            disabled={!backupConfirmed || !showMnemonic}
            className="btn btn-primary w-full py-4 px-6 rounded-2xl text-xl font-semibold shadow-lg shadow-indigo-500/20 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (step === 'password') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
        <div className="max-w-2xl w-full glass rounded-3xl p-8 md:p-12">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3">Set Password</h2>
            <p className="text-gray-400 text-lg">
              This password encrypts your wallet locally. You'll need it to unlock your wallet.
            </p>
          </div>
          
          <div className="space-y-6 mb-6">
            <div>
              <label className="block text-gray-400 text-sm font-medium mb-2 ml-1">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Password (min 8 characters)"
                className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm font-medium mb-2 ml-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError('');
                }}
                placeholder="Confirm Password"
                className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-6">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={handleSetPassword}
            className="btn btn-primary w-full py-4 px-6 rounded-2xl text-xl font-semibold shadow-lg shadow-indigo-500/20 hover:scale-[1.02] transition-all"
          >
            Create Wallet
          </button>
        </div>
      </div>
    );
  }

  return null;
}

