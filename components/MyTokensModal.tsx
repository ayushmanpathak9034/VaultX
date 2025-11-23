'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { TokenFactoryService, TokenInfo } from '@/lib/services/tokenFactoryService';
import { getStoredTokens } from '@/lib/wallet/tokenStorage';
import { X, Send, Crown, Gift, Loader2, AlertCircle, CheckCircle, Copy } from 'lucide-react';
import { ethers } from 'ethers';

export default function MyTokensModal({ onClose }: { onClose: () => void }) {
  const { wallet, currentNetwork, refreshBalance } = useWallet();
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const [activeAction, setActiveAction] = useState<'send' | 'transferOwnership' | 'distributeRoyalty' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [sendForm, setSendForm] = useState({
    to: '',
    amount: '',
  });

  const [ownershipForm, setOwnershipForm] = useState({
    newOwner: '',
  });

  const [royaltyForm, setRoyaltyForm] = useState({
    recipients: '',
    amounts: '',
  });

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
      setError('Failed to load tokens');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendToken = async () => {
    if (!selectedToken || !wallet) return;

    if (!sendForm.to || !sendForm.amount) {
      setError('Please fill in all fields');
      return;
    }

    if (!ethers.isAddress(sendForm.to)) {
      setError('Invalid recipient address');
      return;
    }

    const amount = parseFloat(sendForm.amount);
    if (amount <= 0 || amount > parseFloat(selectedToken.balance || '0')) {
      setError('Invalid amount');
      return;
    }

    try {
      setIsProcessing(true);
      setError('');
      setSuccess('');

      const service = new TokenFactoryService(currentNetwork, wallet.privateKey);
      const provider = new ethers.JsonRpcProvider(currentNetwork.rpcUrl);
      const signer = new ethers.Wallet(wallet.privateKey, provider);
      const tokenContract = new ethers.Contract(
        selectedToken.address,
        require('@/lib/contracts/customToken.json'),
        signer
      );

      const amountWei = ethers.parseUnits(sendForm.amount, selectedToken.decimals);
      const tx = await tokenContract.transferTo(sendForm.to, amountWei);
      await tx.wait();

      setSuccess(`Successfully sent ${sendForm.amount} ${selectedToken.symbol} to ${sendForm.to}`);
      setTimeout(() => {
        refreshBalance();
        loadTokens();
        setActiveAction(null);
        setSendForm({ to: '', amount: '' });
      }, 2000);
    } catch (err: any) {
      console.error('Error sending token:', err);
      setError(err.message || 'Failed to send token');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTransferOwnership = async () => {
    if (!selectedToken || !wallet) return;

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
      const signer = new ethers.Wallet(wallet.privateKey, provider);
      const tokenContract = new ethers.Contract(
        selectedToken.address,
        require('@/lib/contracts/customToken.json'),
        signer
      );

      const owner = await tokenContract.owner();
      if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
        setError('You are not the owner of this token');
        return;
      }

      const tx = await tokenContract.transferOwnership(ownershipForm.newOwner);
      await tx.wait();

      setSuccess(`Ownership transferred to ${ownershipForm.newOwner}`);
      setTimeout(() => {
        loadTokens();
        setActiveAction(null);
        setOwnershipForm({ newOwner: '' });
      }, 2000);
    } catch (err: any) {
      console.error('Error transferring ownership:', err);
      setError(err.message || 'Failed to transfer ownership');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDistributeRoyalty = async () => {
    if (!selectedToken || !wallet) return;

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
      const signer = new ethers.Wallet(wallet.privateKey, provider);
      const tokenContract = new ethers.Contract(
        selectedToken.address,
        require('@/lib/contracts/customToken.json'),
        signer
      );

      const owner = await tokenContract.owner();
      if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
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
      console.error('Error distributing royalty:', err);
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="glass rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-2xl md:text-3xl font-bold text-white">My Created Tokens</h2>
          <button
            onClick={onClose}
            className="btn btn-ghost p-2.5 rounded-xl text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Token List */}
          <div className={`w-full md:w-1/3 border-b md:border-b-0 md:border-r border-white/10 overflow-y-auto ${selectedToken ? 'hidden md:block' : 'block'}`}>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            ) : tokens.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-400">No tokens found</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {tokens.map((token) => (
                  <div
                    key={token.address}
                    onClick={() => {
                      setSelectedToken(token);
                      setActiveAction(null);
                      setError('');
                      setSuccess('');
                    }}
                    className={`p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                      selectedToken?.address === token.address
                        ? 'bg-indigo-500/20 border border-indigo-500/50'
                        : 'bg-white/5 border border-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/30">
                          {token.symbol[0]}
                        </div>
                        <div>
                          <h3 className="text-white font-semibold">{token.name}</h3>
                          <p className="text-gray-400 text-xs">{token.symbol}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-gray-400 text-xs">Balance</p>
                        <p className="text-white font-medium">{parseFloat(token.balance || '0').toLocaleString()}</p>
                      </div>
                      {token.isOwner && (
                        <span className="px-2 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-medium border border-indigo-500/30">
                          Owner
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Token Details */}
          <div className={`w-full md:w-2/3 overflow-y-auto bg-black/20 ${!selectedToken ? 'hidden md:block' : 'block'}`}>
            {selectedToken ? (
              <div className="p-6">
                <button
                  onClick={() => setSelectedToken(null)}
                  className="md:hidden mb-4 text-gray-400 hover:text-white flex items-center space-x-2"
                >
                  <span>← Back to list</span>
                </button>

                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-indigo-500/30">
                      {selectedToken.symbol[0]}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">{selectedToken.name}</h2>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-indigo-400 font-medium">{selectedToken.symbol}</span>
                        <span className="text-gray-600">•</span>
                        <div className="flex items-center space-x-1 bg-white/5 rounded-lg px-2 py-0.5">
                          <span className="text-gray-400 text-xs font-mono truncate max-w-[100px]">
                            {selectedToken.address}
                          </span>
                          <button
                            onClick={() => navigator.clipboard.writeText(selectedToken.address)}
                            className="text-gray-500 hover:text-white transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <p className="text-gray-400 text-sm mb-1">Total Supply</p>
                    <p className="text-white font-mono text-lg">{parseFloat(selectedToken.totalSupply).toLocaleString()}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <p className="text-gray-400 text-sm mb-1">Your Balance</p>
                    <p className="text-white font-mono text-lg">{parseFloat(selectedToken.balance || '0').toLocaleString()}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <p className="text-gray-400 text-sm mb-1">Decimals</p>
                    <p className="text-white font-mono text-lg">{selectedToken.decimals}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 mb-8">
                  <button
                    onClick={() => setActiveAction('send')}
                    className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center space-x-2 transition-all duration-200 ${
                      activeAction === 'send'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                        : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Send className="w-5 h-5" />
                    <span>Send</span>
                  </button>
                  {selectedToken.isOwner && (
                    <>
                      <button
                        onClick={() => setActiveAction('transferOwnership')}
                        className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center space-x-2 transition-all duration-200 ${
                          activeAction === 'transferOwnership'
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                            : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <Crown className="w-5 h-5" />
                        <span>Transfer Owner</span>
                      </button>
                      <button
                        onClick={() => setActiveAction('distributeRoyalty')}
                        className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center space-x-2 transition-all duration-200 ${
                          activeAction === 'distributeRoyalty'
                            ? 'bg-pink-600 text-white shadow-lg shadow-pink-500/30'
                            : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <Gift className="w-5 h-5" />
                        <span>Distribute</span>
                      </button>
                    </>
                  )}
                </div>

                {/* Action Forms */}
                <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                  {!activeAction && (
                    <div className="text-center py-8 text-gray-400">
                      <p>Select an action above to manage your token</p>
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-start space-x-3">
                      <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      <p className="text-red-400 text-sm">{error}</p>
                    </div>
                  )}

                  {success && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6 flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                      <p className="text-green-400 text-sm">{success}</p>
                    </div>
                  )}

                  {activeAction === 'send' && (
                    <div className="space-y-4 animate-fadeIn">
                      <h3 className="text-xl font-bold text-white mb-4">Send Tokens</h3>
                      <div>
                        <label className="block text-gray-400 text-sm font-medium mb-2">Recipient Address</label>
                        <input
                          type="text"
                          value={sendForm.to}
                          onChange={(e) => setSendForm({ ...sendForm, to: e.target.value })}
                          placeholder="0x..."
                          className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-400 text-sm font-medium mb-2">Amount</label>
                        <input
                          type="number"
                          value={sendForm.amount}
                          onChange={(e) => setSendForm({ ...sendForm, amount: e.target.value })}
                          placeholder="0.0"
                          className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <button
                        onClick={handleSendToken}
                        disabled={isProcessing}
                        className="btn btn-primary w-full py-3 rounded-xl flex items-center justify-center space-x-2 disabled:opacity-50 mt-4"
                      >
                        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        <span>{isProcessing ? 'Sending...' : 'Send Tokens'}</span>
                      </button>
                    </div>
                  )}

                  {activeAction === 'transferOwnership' && (
                    <div className="space-y-4 animate-fadeIn">
                      <h3 className="text-xl font-bold text-white mb-4">Transfer Ownership</h3>
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-4">
                        <p className="text-yellow-400 text-sm">
                          Warning: This action cannot be undone. You will lose control over this token contract.
                        </p>
                      </div>
                      <div>
                        <label className="block text-gray-400 text-sm font-medium mb-2">New Owner Address</label>
                        <input
                          type="text"
                          value={ownershipForm.newOwner}
                          onChange={(e) => setOwnershipForm({ newOwner: e.target.value })}
                          placeholder="0x..."
                          className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono text-sm"
                        />
                      </div>
                      <button
                        onClick={handleTransferOwnership}
                        disabled={isProcessing}
                        className="btn btn-primary w-full py-3 rounded-xl flex items-center justify-center space-x-2 disabled:opacity-50 mt-4"
                      >
                        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Crown className="w-5 h-5" />}
                        <span>{isProcessing ? 'Transferring...' : 'Transfer Ownership'}</span>
                      </button>
                    </div>
                  )}

                  {activeAction === 'distributeRoyalty' && (
                    <div className="space-y-4 animate-fadeIn">
                      <h3 className="text-xl font-bold text-white mb-4">Distribute Royalty</h3>
                      <div>
                        <label className="block text-gray-400 text-sm font-medium mb-2">Recipients (comma-separated)</label>
                        <input
                          type="text"
                          value={royaltyForm.recipients}
                          onChange={(e) => setRoyaltyForm({ ...royaltyForm, recipients: e.target.value })}
                          placeholder="0x..., 0x..."
                          className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-400 text-sm font-medium mb-2">Amounts (comma-separated)</label>
                        <input
                          type="text"
                          value={royaltyForm.amounts}
                          onChange={(e) => setRoyaltyForm({ ...royaltyForm, amounts: e.target.value })}
                          placeholder="100, 200"
                          className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <button
                        onClick={handleDistributeRoyalty}
                        disabled={isProcessing}
                        className="btn btn-primary w-full py-3 rounded-xl flex items-center justify-center space-x-2 disabled:opacity-50 mt-4"
                      >
                        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Gift className="w-5 h-5" />}
                        <span>{isProcessing ? 'Distributing...' : 'Distribute Royalty'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 p-8">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <Gift className="w-10 h-10 opacity-50" />
                </div>
                <p className="text-lg font-medium">Select a token to view details</p>
                <p className="text-sm mt-2">Choose from your created tokens on the left</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

