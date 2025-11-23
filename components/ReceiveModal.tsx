'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { Copy, X, CheckCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function ReceiveModal({ onClose }: { onClose: () => void }) {
  const { wallet, currentNetwork } = useWallet();
  const [copied, setCopied] = useState(false);
  const [qrSize, setQrSize] = useState(192);

  useEffect(() => {
    const updateQrSize = () => {
      setQrSize(window.innerWidth < 640 ? 160 : 192);
    };
    updateQrSize();
    window.addEventListener('resize', updateQrSize);
    return () => window.removeEventListener('resize', updateQrSize);
  }, []);

  if (!wallet) return null;

  const copyAddress = () => {
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="glass rounded-3xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Receive {currentNetwork.currencySymbol}</h2>
          <button
            onClick={onClose}
            className="btn btn-ghost p-2 rounded-xl text-gray-400 hover:text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="text-center">
            <p className="text-gray-400 mb-6">Scan to send {currentNetwork.currencySymbol} to this address</p>
            
            <div className="bg-white p-4 rounded-2xl mb-6 inline-block shadow-lg shadow-indigo-500/20">
              <QRCodeSVG
                value={wallet.address}
                size={qrSize}
                level="H"
                includeMargin={true}
                fgColor="#000000"
                bgColor="#ffffff"
              />
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 group relative overflow-hidden">
              <div className="absolute inset-0 bg-linear-to-r from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <code className="text-indigo-300 text-sm break-all font-mono relative z-10">{wallet.address}</code>
            </div>

            <button
              onClick={copyAddress}
              className="btn btn-primary w-full py-3 rounded-xl flex items-center justify-center space-x-2"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  <span>Copy Address</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-start space-x-3">
            <div className="text-yellow-500 mt-0.5">⚠️</div>
            <p className="text-yellow-200/80 text-sm">
              Make sure you are sending assets on the <span className="font-bold text-yellow-200">{currentNetwork.name}</span> network.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

