'use client';

import { useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { isValidAddress } from '@/lib/wallet/utils';
import { TransactionService, TransactionRequest } from '@/lib/wallet/transactionService';
import TransactionConfirmation from './TransactionConfirmation';
import { X, Send, AlertCircle, ArrowRight } from 'lucide-react';

export default function SendModal({ onClose }: { onClose: () => void }) {
  const { wallet, currentNetwork, refreshBalance, refreshTransactions, balance } = useWallet();
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [txRequest, setTxRequest] = useState<TransactionRequest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleNext = () => {
    if (!wallet) return;

    setError('');
    setSuccess('');

    if (!to || !isValidAddress(to)) {
      setError('Invalid recipient address');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Invalid amount');
      return;
    }

    // Check if amount exceeds balance
    if (parseFloat(amount) > parseFloat(balance || '0')) {
      setError('Amount exceeds your balance');
      return;
    }

    // Prepare transaction request
    const request: TransactionRequest = {
      to: to.trim(),
      value: amount,
    };

    setTxRequest(request);
    setShowConfirmation(true);
  };

  const handleConfirm = async () => {
    if (!wallet || !txRequest) return;

    try {
      setIsLoading(true);
      setError('');

      // Use modular transaction service
      const txService = new TransactionService(currentNetwork, wallet.privateKey);
      
      // Send transaction (this will sign and broadcast)
      const txResult = await txService.sendTransaction(txRequest);

      setSuccess(`Transaction sent! Hash: ${txResult.hash}`);
      
      // Wait for 1 confirmation
      const confirmed = await txService.waitForConfirmation(txResult.hash, 1);
      
      if (confirmed.status === 'confirmed') {
        setSuccess(`Transaction confirmed! Block: ${confirmed.blockNumber}`);
      } else {
        setError('Transaction failed');
        setIsLoading(false);
        return;
      }
      
      // Refresh balance and transactions
      setTimeout(() => {
        refreshBalance();
        refreshTransactions();
      }, 1000);

      // Close modal after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Send error:', err);
      // Provide more helpful error messages
      if (err.message?.includes('insufficient funds')) {
        setError('Insufficient balance for this transaction');
      } else if (err.message?.includes('network')) {
        setError(`Network error: ${err.message}`);
      } else {
        setError(err.message || 'Failed to send transaction. Please check your balance and network connection.');
      }
      setIsLoading(false);
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
    setTxRequest(null);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="glass rounded-3xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Send {currentNetwork.currencySymbol}</h2>
          <button
            onClick={onClose}
            className="btn btn-ghost p-2 rounded-xl text-gray-400 hover:text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-gray-400 text-sm font-medium mb-2">
              Recipient Address
            </label>
            <input
              type="text"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setError('');
              }}
              placeholder="0x..."
              className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono text-sm transition-all duration-200"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm font-medium mb-2">
              Amount ({currentNetwork.currencySymbol})
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
              placeholder="0.0"
              step="0.0001"
              min="0"
              className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 btn btn-ghost py-3 rounded-xl text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleNext}
              disabled={isLoading || !to || !amount}
              className="flex-1 btn btn-primary py-3 rounded-xl flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Review & Sign</span>
              <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
        </div>
      </div>

      {showConfirmation && txRequest && wallet && (
        <TransactionConfirmation
          request={txRequest}
          network={currentNetwork}
          fromAddress={wallet.address}
          balance={balance}
          onConfirm={handleConfirm}
          onCancel={handleCancelConfirmation}
        />
      )}
    </div>
  );
}

