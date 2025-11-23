'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { TokenFactoryService, TokenInfo } from '@/lib/services/tokenFactoryService';
import { addStoredToken } from '@/lib/wallet/tokenStorage';
import { X, Plus, Coins, Loader2, CheckCircle, AlertCircle, Copy } from 'lucide-react';
import { ethers } from 'ethers';

export default function TokenFactoryModal({ onClose }: { onClose: () => void }) {
  const { wallet, currentNetwork, balance, refreshBalance } = useWallet();
  const [activeTab, setActiveTab] = useState<'create' | 'my-tokens'>('create');
  const [creationFee, setCreationFee] = useState<string>('0');
  const [isLoadingFee, setIsLoadingFee] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [myTokens, setMyTokens] = useState<TokenInfo[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    initialSupply: '',
  });

  useEffect(() => {
    if (wallet && currentNetwork) {
      loadCreationFee();
      if (activeTab === 'my-tokens') {
        loadMyTokens();
      }
    }
  }, [wallet, currentNetwork, activeTab]);

  const loadCreationFee = async () => {
    if (!wallet) return;
    try {
      setIsLoadingFee(true);
      const service = new TokenFactoryService(currentNetwork, wallet.privateKey);
      const fee = await service.getCreationFee();
      setCreationFee(fee);
    } catch (err: any) {
      console.error('Error loading creation fee:', err);
      setError(err.message || 'Failed to load creation fee');
    } finally {
      setIsLoadingFee(false);
    }
  };

  const loadMyTokens = async () => {
    if (!wallet) return;
    try {
      setIsLoadingTokens(true);
      const service = new TokenFactoryService(currentNetwork, wallet.privateKey);
      const tokenAddresses = await service.getUserTokens(wallet.address);
      
      const tokenInfos = await Promise.all(
        tokenAddresses.map(async (address) => {
          try {
            return await service.getTokenInfo(address, wallet.address);
          } catch {
            return null;
          }
        })
      );

      setMyTokens(tokenInfos.filter((t): t is TokenInfo => t !== null));
    } catch (err: any) {
      console.error('Error loading tokens:', err);
      setError('Failed to load your tokens');
    } finally {
      setIsLoadingTokens(false);
    }
  };

  const handleCreateToken = async () => {
    if (!wallet) return;

    if (!formData.name || !formData.symbol || !formData.initialSupply) {
      setError('Please fill in all fields');
      return;
    }

    if (parseFloat(formData.initialSupply) <= 0) {
      setError('Initial supply must be greater than 0');
      return;
    }

    const fee = parseFloat(creationFee);
    const userBalance = parseFloat(balance || '0');
    if (userBalance < fee) {
      setError(`Insufficient balance. Creation fee: ${fee} ${currentNetwork.currencySymbol}`);
      return;
    }

    try {
      setIsCreating(true);
      setError('');
      setSuccess('');

      const service = new TokenFactoryService(currentNetwork, wallet.privateKey);
      const tokenAddress = await service.createToken(
        formData.name,
        formData.symbol,
        formData.initialSupply
      );

      const tokenInfo = await service.getTokenInfo(tokenAddress, wallet.address);
      
      addStoredToken({
        address: tokenAddress,
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        decimals: tokenInfo.decimals,
        chainId: currentNetwork.chainId,
        createdAt: Date.now(),
      });

      setSuccess(`Token created and imported successfully! Address: ${tokenAddress}`);
      
      setTimeout(() => {
        refreshBalance();
        loadMyTokens();
        setFormData({ name: '', symbol: '', initialSupply: '' });
        setActiveTab('my-tokens');
      }, 2000);
    } catch (err: any) {
      console.error('Error creating token:', err);
      setError(err.message || 'Failed to create token');
    } finally {
      setIsCreating(false);
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
  };

  if (!wallet) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="glass rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl shadow-indigo-500/20">
        <div className="flex items-center justify-between p-8 border-b border-white/10">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-linear-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/30">
              <Coins className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white">Token Factory</h2>
              <p className="text-gray-400 text-sm mt-1">Create and manage your custom tokens</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost p-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center">
          <div className="flex space-x-4 mb-12 bg-black/30 p-2 rounded-2xl border border-white/10 w-fit">
            <button
              onClick={() => setActiveTab('create')}
              className={`px-8 py-3 rounded-xl font-medium transition-all duration-200 text-base ${
                activeTab === 'create'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Create Token
            </button>
            <button
              onClick={() => {
                setActiveTab('my-tokens');
                loadMyTokens();
              }}
              className={`px-8 py-3 rounded-xl font-medium transition-all duration-200 text-base ${
                activeTab === 'my-tokens'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              My Tokens
            </button>
          </div>

          {activeTab === 'create' && (
            <div className="space-y-8 w-full max-w-2xl">
              <div className="bg-indigo-500/10 rounded-2xl p-6 border border-indigo-500/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-indigo-500/20 rounded-lg">
                      <Coins className="w-5 h-5 text-indigo-400" />
                    </div>
                    <span className="text-indigo-300 font-medium">Estimated Creation Fee</span>
                  </div>
                  {isLoadingFee ? (
                    <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                  ) : (
                    <span className="text-white font-bold text-xl">{creationFee} {currentNetwork.currencySymbol}</span>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-gray-400 text-sm font-medium mb-3 ml-1">Token Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. My Awesome Token"
                    className="w-full bg-black/30 border border-white/10 rounded-2xl p-5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200 text-lg"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm font-medium mb-3 ml-1">Token Symbol *</label>
                  <input
                    type="text"
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                    placeholder="e.g. MAT"
                    maxLength={10}
                    className="w-full bg-black/30 border border-white/10 rounded-2xl p-5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200 uppercase text-lg"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm font-medium mb-3 ml-1">Initial Supply *</label>
                  <input
                    type="number"
                    value={formData.initialSupply}
                    onChange={(e) => setFormData({ ...formData, initialSupply: e.target.value })}
                    placeholder="e.g. 1000000"
                    min="1"
                    step="1"
                    className="w-full bg-black/30 border border-white/10 rounded-2xl p-5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200 text-lg"
                  />
                  <p className="text-gray-500 text-xs mt-3 ml-1">Note: Contract will multiply by 10^18 automatically</p>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 flex items-start space-x-3">
                  <AlertCircle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {success && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5 flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-400 shrink-0 mt-0.5" />
                  <p className="text-green-400 text-sm break-all">{success}</p>
                </div>
              )}

              <button
                onClick={handleCreateToken}
                disabled={isCreating || isLoadingFee}
                className="btn btn-primary w-full py-5 rounded-2xl flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed text-xl font-semibold shadow-lg shadow-indigo-500/20 hover:scale-[1.02] transition-all mt-4"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Creating Token...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-6 h-6" />
                    <span>Create Token</span>
                  </>
                )}
              </button>
            </div>
          )}

          {activeTab === 'my-tokens' && (
            <div className="space-y-3 w-full max-w-2xl">
              {isLoadingTokens ? (
                <div className="text-center py-12">
                  <Loader2 className="w-12 h-12 text-indigo-400/50 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-400">Loading your tokens...</p>
                </div>
              ) : myTokens.length === 0 ? (
                <div className="text-center py-12">
                  <Coins className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No tokens created yet</p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm underline"
                  >
                    Create your first token
                  </button>
                </div>
              ) : (
                myTokens.map((token) => (
                  <div
                    key={token.address}
                    className="bg-white/5 border border-white/5 rounded-2xl p-4 hover:bg-white/10 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="text-white font-semibold text-lg">{token.name}</h3>
                          <span className="text-indigo-400 font-medium">({token.symbol})</span>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center text-gray-400">
                            <span className="font-mono text-xs truncate max-w-[200px]">{token.address}</span>
                            <button
                              onClick={() => copyAddress(token.address)}
                              className="ml-2 p-1 hover:bg-white/10 rounded transition-colors"
                            >
                              <Copy className="w-3 h-3 text-gray-400 hover:text-white" />
                            </button>
                          </div>
                          <p className="text-gray-500">Total Supply: {parseFloat(token.totalSupply).toLocaleString()} {token.symbol}</p>
                          {token.balance && (
                            <p className="text-indigo-300 font-medium">Your Balance: {parseFloat(token.balance).toLocaleString()} {token.symbol}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

