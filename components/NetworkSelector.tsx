'use client';

import { useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { addCustomNetwork, removeCustomNetwork, Network } from '@/lib/wallet/networks';
import { X, Plus, Trash2, Check } from 'lucide-react';

export default function NetworkSelector({ onClose }: { onClose: () => void }) {
  const { networks, currentNetwork, setNetwork, refreshNetworks } = useWallet();
  const [showAddNetwork, setShowAddNetwork] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    rpcUrl: '',
    chainId: '',
    currency: '',
    currencySymbol: '',
    blockExplorer: '',
  });
  const [error, setError] = useState('');

  const handleAddNetwork = () => {
    try {
      if (!formData.name || !formData.rpcUrl || !formData.chainId || !formData.currencySymbol) {
        setError('Please fill in all required fields');
        return;
      }

      const chainId = parseInt(formData.chainId);
      if (isNaN(chainId)) {
        setError('Invalid Chain ID');
        return;
      }

      const newNetwork: Network = {
        id: `custom-${chainId}`,
        name: formData.name,
        rpcUrl: formData.rpcUrl,
        chainId: chainId,
        currency: formData.currency || formData.currencySymbol,
        currencySymbol: formData.currencySymbol,
        blockExplorer: formData.blockExplorer || undefined,
        isCustom: true,
      };

      addCustomNetwork(newNetwork);
      refreshNetworks();
      setNetwork(chainId);
      setShowAddNetwork(false);
      setFormData({
        name: '',
        rpcUrl: '',
        chainId: '',
        currency: '',
        currencySymbol: '',
        blockExplorer: '',
      });
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to add network');
    }
  };

  const handleRemoveNetwork = (chainId: number) => {
    if (currentNetwork.chainId === chainId) {
      setError('Cannot remove the currently active network');
      return;
    }
    removeCustomNetwork(chainId);
    refreshNetworks();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="glass rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Select Network</h2>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowAddNetwork(true)}
              className="btn btn-primary p-2.5 rounded-xl"
              aria-label="Add network"
            >
              <Plus className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={onClose}
              className="btn btn-ghost p-2.5 rounded-xl text-gray-400 hover:text-white"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">

        {showAddNetwork ? (
          <div className="space-y-5">
            <h3 className="text-2xl font-bold text-white">Add Custom Network</h3>
            
            <div>
              <label className="block text-gray-400 text-sm font-medium mb-2.5">Network Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ethereum Mainnet"
                className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-gray-400 text-sm font-medium mb-2.5">RPC URL *</label>
              <input
                type="text"
                value={formData.rpcUrl}
                onChange={(e) => setFormData({ ...formData, rpcUrl: e.target.value })}
                placeholder="https://..."
                className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-gray-400 text-sm font-medium mb-2.5">Chain ID *</label>
              <input
                type="number"
                value={formData.chainId}
                onChange={(e) => setFormData({ ...formData, chainId: e.target.value })}
                placeholder="1"
                className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-gray-400 text-sm font-medium mb-2.5">Currency Symbol *</label>
              <input
                type="text"
                value={formData.currencySymbol}
                onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                placeholder="ETH"
                className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-gray-400 text-sm font-medium mb-2.5">Block Explorer URL</label>
              <input
                type="text"
                value={formData.blockExplorer}
                onChange={(e) => setFormData({ ...formData, blockExplorer: e.target.value })}
                placeholder="https://etherscan.io"
                className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200 font-mono text-sm"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="flex space-x-4 pt-2">
              <button
                onClick={() => {
                  setShowAddNetwork(false);
                  setError('');
                  setFormData({
                    name: '',
                    rpcUrl: '',
                    chainId: '',
                    currency: '',
                    currencySymbol: '',
                    blockExplorer: '',
                  });
                }}
                className="flex-1 btn btn-ghost py-3.5 px-6 rounded-xl text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNetwork}
                className="flex-1 btn btn-primary py-3.5 px-6 rounded-xl"
              >
                Add Network
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {networks.map((network) => (
              <div
                key={network.chainId}
                className={`flex items-center justify-between p-5 rounded-xl transition-all duration-200 cursor-pointer border ${
                  currentNetwork.chainId === network.chainId
                    ? 'bg-indigo-500/10 border-indigo-500/50'
                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                }`}
                onClick={() => {
                  setNetwork(network.chainId);
                  onClose();
                }}
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-white font-semibold text-lg">{network.name}</h3>
                    {network.isCustom && (
                      <span className="text-xs bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full font-medium">Custom</span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm mt-1">Chain ID: {network.chainId}</p>
                </div>
                <div className="flex items-center space-x-3">
                  {currentNetwork.chainId === network.chainId && (
                    <div className="w-6 h-6 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  {network.isCustom && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveNetwork(network.chainId);
                      }}
                      className="p-2.5 hover:bg-red-500/20 rounded-xl transition-colors group"
                    >
                      <Trash2 className="w-4 h-4 text-red-400 group-hover:text-red-300" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

