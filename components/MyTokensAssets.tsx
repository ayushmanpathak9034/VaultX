'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { TokenFactoryService, TokenInfo } from '@/lib/services/tokenFactoryService';
import { getStoredTokens } from '@/lib/wallet/tokenStorage';
import { Send, Crown, Gift, Loader2, Copy, ChevronDown, ChevronUp, X } from 'lucide-react';
import { ethers } from 'ethers';

export default function MyTokensAssets() {
  const { wallet, currentNetwork, refreshBalance } = useWallet();
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedToken, setExpandedToken] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<{token: TokenInfo, action: 'send' | 'transferOwnership' | 'distributeRoyalty'} | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [sendForm, setSendForm] = useState({ to: '', amount: '' });
  const [ownershipForm, setOwnershipForm] = useState({ newOwner: '' });
  const [royaltyForm, setRoyaltyForm] = useState({ recipients: '', amounts: '' });

  useEffect(() => {
    if (wallet && currentNetwork) {
      loadTokens();
    }
  }, [wallet, currentNetwork]);

  const loadTokens = async () => {
    if (!wallet) return;
    try {
      setIsLoading(true);
      const storedTokens = getStoredTokens(currentNetwork.chainId);
      const service = new TokenFactoryService(currentNetwork, wallet.privateKey);
      
      const tokenInfos = await Promise.all(
        storedTokens.map(async (stored) => {
          try {
            const info = await service.getTokenInfo(stored.address, wallet.address);
            return info;
          } catch {
            return null;
          }
        })
      );

      setTokens(tokenInfos.filter((t): t is TokenInfo => t !== null));
    } catch (err: any) {
      console.error('Error loading tokens:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendToken = async (token: TokenInfo) => {
    if (!sendForm.to || !sendForm.amount) {
      setError('Please fill in all fields');
      return;
    }

    if (!ethers.isAddress(sendForm.to)) {
      setError('Invalid recipient address');
      return;
    }

    const amount = parseFloat(sendForm.amount);
    if (amount <= 0 || amount > parseFloat(token.balance || '0')) {
      setError('Invalid amount');
      return;
    }

    try {
      setIsProcessing(true);
      setError('');
      setSuccess('');

      const provider = new ethers.JsonRpcProvider(currentNetwork.rpcUrl);
      const signer = new ethers.Wallet(wallet!.privateKey, provider);
      const tokenContract = new ethers.Contract(
        token.address,
        require('@/lib/contracts/customToken.json'),
        signer
      );

      const amountWei = ethers.parseUnits(sendForm.amount, token.decimals);
      const tx = await tokenContract.transferTo(sendForm.to, amountWei);
      await tx.wait();

      setSuccess(`Successfully sent ${sendForm.amount} ${token.symbol}`);
      setTimeout(() => {
        refreshBalance();
        loadTokens();
        setActiveAction(null);
        setSendForm({ to: '', amount: '' });
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to send token');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTransferOwnership = async (token: TokenInfo) => {
    if (!ownershipForm.newOwner) {
      setError('Please enter new owner address');
      return;
    }

    if (!ethers.isAddress(ownershipForm.newOwner)) {
      setError('Invalid owner address');
      return;
    }

    try {
      setIsProcessing(true);
      setError('');
      setSuccess('');

      const provider = new ethers.JsonRpcProvider(currentNetwork.rpcUrl);
      const signer = new ethers.Wallet(wallet!.privateKey, provider);
      const tokenContract = new ethers.Contract(
        token.address,
        require('@/lib/contracts/customToken.json'),
        signer
      );

      const owner = await tokenContract.owner();
      if (owner.toLowerCase() !== wallet!.address.toLowerCase()) {
        setError('You are not the owner of this token');
        return;
      }

      const tx = await tokenContract.transferOwnership(ownershipForm.newOwner);
      await tx.wait();

      setSuccess(`Ownership transferred successfully`);
      setTimeout(() => {
        loadTokens();
        setActiveAction(null);
        setOwnershipForm({ newOwner: '' });
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to transfer ownership');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDistributeRoyalty = async (token: TokenInfo) => {
    if (!royaltyForm.recipients || !royaltyForm.amounts) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setIsProcessing(true);
      setError('');
      setSuccess('');

      const recipients = royaltyForm.recipients.split(',').map(r => r.trim());
      const amounts = royaltyForm.amounts.split(',').map(a => a.trim());

      if (recipients.length !== amounts.length) {
        setError('Recipients and amounts count must match');
        return;
      }

      recipients.forEach(addr => {
        if (!ethers.isAddress(addr)) {
          throw new Error(`Invalid address: ${addr}`);
        }
      });

      const provider = new ethers.JsonRpcProvider(currentNetwork.rpcUrl);
      const signer = new ethers.Wallet(wallet!.privateKey, provider);
      const tokenContract = new ethers.Contract(
        token.address,
        require('@/lib/contracts/customToken.json'),
        signer
      );

      const owner = await tokenContract.owner();
      if (owner.toLowerCase() !== wallet!.address.toLowerCase()) {
        setError('You are not the owner of this token');
        return;
      }

      const amountsWei = amounts.map(amount => ethers.parseUnits(amount, 0));
      const tx = await tokenContract.distributeRoyalty(recipients, amountsWei);
      await tx.wait();

      setSuccess(`Royalty distributed to ${recipients.length} recipients`);
      setTimeout(() => {
        refreshBalance();
        loadTokens();
        setActiveAction(null);
        setRoyaltyForm({ recipients: '', amounts: '' });
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to distribute royalty');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
  };

  if (!wallet) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      ) : tokens.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="text-center">
            <Gift className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No tokens found</p>
            <p className="text-gray-500 text-xs mt-1">Create tokens using Token Factory</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {tokens.map((token) => (
            <div
              key={token.address}
              className="glass rounded-xl p-4 hover:bg-white/5 transition-all duration-200"
            >
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedToken(expandedToken === token.address ? null : token.address)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="text-white font-semibold text-base truncate">
                      {token.name}
                    </h3>
                    <span className="text-indigo-400 font-medium text-sm">({token.symbol})</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-gray-500 font-mono truncate max-w-[120px]">{token.address.slice(0, 6)}...{token.address.slice(-4)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyAddress(token.address);
                      }}
                      className="p-1 hover:bg-white/10 rounded transition-all duration-200"
                    >
                      <Copy className="w-3 h-3 text-gray-400 hover:text-white" />
                    </button>
                  </div>
                  {token.balance && (
                    <p className="text-gray-300 font-medium text-sm mt-1">
                      Balance: {parseFloat(token.balance).toLocaleString()} {token.symbol}
                    </p>
                  )}
                </div>
                <button className="ml-2 p-1.5 hover:bg-white/10 rounded transition-all duration-200">
                  {expandedToken === token.address ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>

              {expandedToken === token.address && (
                <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
                  {activeAction?.token.address === token.address ? (
                    <div className="space-y-3">
                      <button
                        onClick={() => {
                          setActiveAction(null);
                          setError('');
                          setSuccess('');
                        }}
                        className="text-gray-400 hover:text-white text-xs font-medium flex items-center space-x-1"
                      >
                        <span>← Back</span>
                      </button>

                      {activeAction.action === 'send' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-gray-400 text-xs font-medium mb-1.5">Recipient Address</label>
                            <input
                              type="text"
                              value={sendForm.to}
                              onChange={(e) => setSendForm({ ...sendForm, to: e.target.value })}
                              placeholder="0x..."
                              className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-400 text-xs font-medium mb-1.5">Amount</label>
                            <input
                              type="number"
                              value={sendForm.amount}
                              onChange={(e) => setSendForm({ ...sendForm, amount: e.target.value })}
                              placeholder="0.0"
                              step="0.0001"
                              className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
                            />
                            <p className="text-gray-500 text-xs mt-1">Available: {token.balance || '0'} {token.symbol}</p>
                          </div>
                          {error && <p className="text-red-400 text-xs">{error}</p>}
                          {success && <p className="text-green-400 text-xs">{success}</p>}
                          <button
                            onClick={() => handleSendToken(token)}
                            disabled={isProcessing}
                            className="btn btn-primary w-full py-2 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 disabled:opacity-50"
                          >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            <span>Send</span>
                          </button>
                        </div>
                      )}

                      {activeAction.action === 'transferOwnership' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-gray-400 text-xs font-medium mb-1.5">New Owner Address</label>
                            <input
                              type="text"
                              value={ownershipForm.newOwner}
                              onChange={(e) => setOwnershipForm({ newOwner: e.target.value })}
                              placeholder="0x..."
                              className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs font-mono"
                            />
                          </div>
                          {error && <p className="text-red-400 text-xs">{error}</p>}
                          {success && <p className="text-green-400 text-xs">{success}</p>}
                          <button
                            onClick={() => handleTransferOwnership(token)}
                            disabled={isProcessing}
                            className="btn btn-primary w-full py-2 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 disabled:opacity-50"
                          >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                            <span>Transfer Ownership</span>
                          </button>
                        </div>
                      )}

                      {activeAction.action === 'distributeRoyalty' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-gray-400 text-xs font-medium mb-1.5">Recipients (comma-separated)</label>
                            <input
                              type="text"
                              value={royaltyForm.recipients}
                              onChange={(e) => setRoyaltyForm({ ...royaltyForm, recipients: e.target.value })}
                              placeholder="0x..., 0x..."
                              className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-400 text-xs font-medium mb-1.5">Amounts (comma-separated)</label>
                            <input
                              type="text"
                              value={royaltyForm.amounts}
                              onChange={(e) => setRoyaltyForm({ ...royaltyForm, amounts: e.target.value })}
                              placeholder="100, 200"
                              className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
                            />
                          </div>
                          {error && <p className="text-red-400 text-xs">{error}</p>}
                          {success && <p className="text-green-400 text-xs">{success}</p>}
                          <button
                            onClick={() => handleDistributeRoyalty(token)}
                            disabled={isProcessing}
                            className="btn btn-primary w-full py-2 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 disabled:opacity-50"
                          >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                            <span>Distribute Royalty</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          setActiveAction({ token, action: 'send' });
                          setError('');
                          setSuccess('');
                        }}
                        className="btn btn-primary px-3 py-1.5 text-xs flex items-center space-x-1.5 rounded-lg"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send</span>
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const provider = new ethers.JsonRpcProvider(currentNetwork.rpcUrl);
                            const tokenContract = new ethers.Contract(
                              token.address,
                              require('@/lib/contracts/customToken.json'),
                              provider
                            );
                            const owner = await tokenContract.owner();
                            if (owner.toLowerCase() === wallet.address.toLowerCase()) {
                              setActiveAction({ token, action: 'transferOwnership' });
                              setError('');
                              setSuccess('');
                            } else {
                              setError('You are not the owner');
                            }
                          } catch (err) {
                            setError('Failed to check ownership');
                          }
                        }}
                        className="btn btn-secondary px-3 py-1.5 text-xs flex items-center space-x-1.5 rounded-lg border-gray-600 text-gray-300 hover:bg-gray-800"
                      >
                        <Crown className="w-3.5 h-3.5" />
                        <span>Ownership</span>
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const provider = new ethers.JsonRpcProvider(currentNetwork.rpcUrl);
                            const tokenContract = new ethers.Contract(
                              token.address,
                              require('@/lib/contracts/customToken.json'),
                              provider
                            );
                            const owner = await tokenContract.owner();
                            if (owner.toLowerCase() === wallet.address.toLowerCase()) {
                              setActiveAction({ token, action: 'distributeRoyalty' });
                              setError('');
                              setSuccess('');
                            } else {
                              setError('You are not the owner');
                            }
                          } catch (err) {
                            setError('Failed to check ownership');
                          }
                        }}
                        className="btn btn-secondary px-3 py-1.5 text-xs flex items-center space-x-1.5 rounded-lg border-gray-600 text-gray-300 hover:bg-gray-800"
                      >
                        <Gift className="w-3.5 h-3.5" />
                        <span>Royalty</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

