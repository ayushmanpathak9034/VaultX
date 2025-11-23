'use client';

import { useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { clearStoredWallet, getStoredWallet, decryptWallet, encryptWallet, storeWallet } from '@/lib/wallet/utils';
import { X, Download, Upload, Trash2, Eye, EyeOff, Copy, CheckCircle, FileText } from 'lucide-react';

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { wallet, lockWallet } = useWallet();
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const handleExportWallet = () => {
    if (!wallet) return;
    
    const data = {
      address: wallet.address,
      mnemonic: wallet.mnemonic,
      privateKey: wallet.privateKey,
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wallet-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteWallet = () => {
    if (!confirm('Are you sure you want to delete your wallet? This action cannot be undone!')) {
      return;
    }
    
    clearStoredWallet();
    lockWallet();
    onClose();
  };

  const handleChangePassword = () => {
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    try {
      const stored = getStoredWallet();
      if (!stored || !wallet) {
        setError('No wallet found');
        return;
      }

      // Re-encrypt with new password
      const encrypted = encryptWallet(wallet, password);
      storeWallet(encrypted);
      setError('');
      setPassword('');
      alert('Password changed successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(''), 2000);
  };

  if (!wallet) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="glass rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="btn btn-ghost p-2 rounded-xl text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-8">
          {/* Wallet Info */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Wallet Information</h3>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-3">
              <div>
                <label className="text-gray-400 text-sm">Address</label>
                <div className="flex items-center space-x-2 mt-1">
                  <code className="text-indigo-300 text-sm flex-1 break-all font-mono">{wallet.address}</code>
                  <button
                    onClick={() => copyToClipboard(wallet.address, 'address')}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    {copied === 'address' ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Recovery Phrase */}
          {wallet.mnemonic && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Recovery Phrase</h3>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                {!showMnemonic ? (
                  <button
                    onClick={() => setShowMnemonic(true)}
                    className="w-full flex items-center justify-center space-x-2 bg-white/5 hover:bg-white/10 text-white py-3 px-6 rounded-xl transition-all duration-200 border border-white/5"
                  >
                    <Eye className="w-5 h-5" />
                    <span>Show Recovery Phrase</span>
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      {wallet.mnemonic.split(' ').map((word, i) => (
                        <div key={i} className="bg-black/30 rounded-lg p-2 text-center border border-white/5">
                          <span className="text-xs text-gray-500">{i + 1}</span>
                          <p className="text-white font-medium text-sm">{word}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          const content = `VaultX - Recovery Phrase Backup\n\n` +
                            `IMPORTANT: Keep this file secure and private!\n` +
                            `Never share your recovery phrase with anyone.\n\n` +
                            `Recovery Phrase:\n${wallet.mnemonic}\n\n` +
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
                        className="flex-1 btn btn-primary py-2 px-4 rounded-xl flex items-center justify-center space-x-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download</span>
                      </button>
                      <button
                        onClick={() => copyToClipboard(wallet.mnemonic, 'mnemonic')}
                        className="flex-1 btn btn-ghost py-2 px-4 rounded-xl flex items-center justify-center space-x-2 border border-white/10"
                      >
                        {copied === 'mnemonic' ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Private Key */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Private Key</h3>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              {!showPrivateKey ? (
                <button
                  onClick={() => setShowPrivateKey(true)}
                  className="w-full flex items-center justify-center space-x-2 bg-white/5 hover:bg-white/10 text-white py-3 px-6 rounded-xl transition-all duration-200 border border-white/5"
                >
                  <Eye className="w-5 h-5" />
                  <span>Show Private Key</span>
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="bg-black/30 rounded-lg p-3 border border-white/5">
                    <code className="text-indigo-300 text-sm break-all font-mono">{wallet.privateKey}</code>
                  </div>
                  <button
                    onClick={() => copyToClipboard(wallet.privateKey, 'privateKey')}
                    className="w-full btn btn-primary py-2 px-4 rounded-xl flex items-center justify-center space-x-2"
                  >
                    {copied === 'privateKey' ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Private Key</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Export Wallet */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Backup & Export</h3>
            <button
              onClick={handleExportWallet}
              className="w-full btn btn-primary py-3 px-6 rounded-xl flex items-center justify-center space-x-2"
            >
              <Download className="w-5 h-5" />
              <span>Export Wallet Backup</span>
            </button>
          </div>

          {/* Change Password */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Change Password</h3>
            <div className="space-y-3">
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="New password (min 8 characters)"
                className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}
              <button
                onClick={handleChangePassword}
                className="w-full btn btn-primary py-3 px-6 rounded-xl"
              >
                Change Password
              </button>
            </div>
          </div>

          {/* Delete Wallet */}
          <div>
            <h3 className="text-lg font-semibold text-red-400 mb-4">Danger Zone</h3>
            <button
              onClick={handleDeleteWallet}
              className="w-full flex items-center justify-center space-x-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold py-3 px-6 rounded-xl transition-all duration-200"
            >
              <Trash2 className="w-5 h-5" />
              <span>Delete Wallet</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

