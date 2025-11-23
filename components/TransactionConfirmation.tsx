'use client';

import { useState, useEffect } from 'react';
import { TransactionService, TransactionRequest } from '@/lib/wallet/transactionService';
import { formatAddress } from '@/lib/wallet/utils';
import { Network } from '@/lib/wallet/networks';
import { ethers } from 'ethers';
import { X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface TransactionConfirmationProps {
  request: TransactionRequest;
  network: Network;
  fromAddress: string;
  balance: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export default function TransactionConfirmation({
  request,
  network,
  fromAddress,
  balance,
  onConfirm,
  onCancel,
}: TransactionConfirmationProps) {
  const [gasEstimate, setGasEstimate] = useState<bigint | null>(null);
  const [gasPrice, setGasPrice] = useState<bigint | null>(null);
  const [isEstimating, setIsEstimating] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const estimateFees = async () => {
      try {
        setIsEstimating(true);
        
        // Create a temporary wallet for estimation (needed for gas estimation)
        const tempWallet = ethers.Wallet.createRandom();
        const tempService = new TransactionService(network, tempWallet.privateKey);
        
        // Update the wallet address in the service for estimation
        const provider = tempService['provider'];
        const estimateRequest = {
          from: fromAddress,
          to: request.to,
          value: ethers.parseEther(request.value),
          data: request.data,
        };
        
        const [estimatedGas, currentGasPrice] = await Promise.all([
          provider.estimateGas(estimateRequest).then(gas => (gas * BigInt(120)) / BigInt(100)), // 20% buffer
          tempService.getGasPrice(),
        ]);
        
        setGasEstimate(estimatedGas);
        setGasPrice(currentGasPrice);
      } catch (err: any) {
        console.error('Fee estimation error:', err);
        // Use defaults if estimation fails
        setGasEstimate(BigInt(21000));
        setGasPrice(BigInt(20000000000)); // 20 gwei
      } finally {
        setIsEstimating(false);
      }
    };

    estimateFees();
  }, [request, network, fromAddress]);

  const handleConfirm = async () => {
    try {
      setIsConfirming(true);
      setError('');
      await onConfirm();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm transaction');
      setIsConfirming(false);
    }
  };

  const calculateTotalCost = () => {
    if (!gasEstimate || !gasPrice) return '0';
    const totalWei = gasEstimate * gasPrice;
    return ethers.formatEther(totalWei);
  };

  const calculateTotalAmount = () => {
    const amount = parseFloat(request.value || '0');
    const fees = parseFloat(calculateTotalCost());
    return (amount + fees).toFixed(6);
  };

  const hasInsufficientFunds = () => {
    const total = parseFloat(calculateTotalAmount());
    const bal = parseFloat(balance || '0');
    return total > bal;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="glass rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl md:text-2xl font-bold text-white">Confirm Transaction</h2>
          <button
            onClick={onCancel}
            disabled={isConfirming}
            className="btn btn-ghost p-2.5 rounded-xl text-gray-400 hover:text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Network */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <p className="text-gray-400 text-sm mb-1">Network</p>
            <p className="text-white font-semibold">{network.name}</p>
          </div>

          {/* From */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <p className="text-gray-400 text-sm mb-1">From</p>
            <p className="text-white font-mono text-sm">{formatAddress(fromAddress, 8)}</p>
          </div>

          {/* To */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <p className="text-gray-400 text-sm mb-1">To</p>
            <p className="text-white font-mono text-sm break-all">{request.to}</p>
          </div>

          {/* Amount */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <p className="text-gray-400 text-sm mb-1">Amount</p>
            <p className="text-white font-semibold text-xl">
              {request.value} {network.currencySymbol}
            </p>
          </div>

          {/* Gas Fees */}
          {isEstimating ? (
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                <p className="text-gray-400 text-sm">Estimating gas fees...</p>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-gray-400 text-sm">Estimated Gas Fee</p>
                  <p className="text-white font-semibold">
                    {calculateTotalCost()} {network.currencySymbol}
                  </p>
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Gas Limit: {gasEstimate?.toString() || '0'}</p>
                  <p>Gas Price: {gasPrice ? ethers.formatUnits(gasPrice, 'gwei') : '0'} Gwei</p>
                </div>
              </div>

              {/* Total */}
              <div className="bg-linear-to-r from-indigo-500/20 to-purple-600/20 rounded-xl p-4 border border-indigo-500/30">
                <div className="flex justify-between items-center">
                  <p className="text-indigo-300 font-semibold">Total</p>
                  <p className="text-white font-bold text-xl">
                    {calculateTotalAmount()} {network.currencySymbol}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Insufficient Funds Warning */}
          {!isEstimating && hasInsufficientFunds() && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 font-semibold text-sm">Insufficient Balance</p>
                <p className="text-red-300 text-xs mt-1">
                  You need {calculateTotalAmount()} {network.currencySymbol} but only have {parseFloat(balance).toFixed(6)} {network.currencySymbol}
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={onCancel}
              disabled={isConfirming}
              className="flex-1 btn btn-ghost py-3 rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isConfirming || isEstimating || hasInsufficientFunds()}
              className="flex-1 btn btn-primary py-3 rounded-xl flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConfirming ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Signing & Sending...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Confirm & Sign</span>
                </>
              )}
            </button>
          </div>

          {/* Security Note */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
            <p className="text-yellow-400 text-xs">
              ⚠️ Please review all details carefully. This transaction will be signed and broadcast to the blockchain.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

