'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { formatAddress, formatAddress as formatAddr } from '@/lib/wallet/utils';
import { Copy, LogOut, Send, Download, Settings, RefreshCw, ChevronDown, Wallet, Network, Eye, EyeOff, TrendingUp, Home, Coins } from 'lucide-react';
import SendModal from './SendModal';
import ReceiveModal from './ReceiveModal';
import NetworkSelector from './NetworkSelector';
import SettingsModal from './SettingsModal';
import TransactionHistory from './TransactionHistory';
import TrendingTokens from './TrendingTokens';
import TokenFactoryModal from './TokenFactoryModal';
import MyTokensAssets from './MyTokensAssets';

export default function Dashboard() {
  const { wallet, lockWallet, balance, currentNetwork, refreshBalance, isLoading } = useWallet();
  const [showSend, setShowSend] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [showNetwork, setShowNetwork] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTrending, setShowTrending] = useState(false);
  const [showTokenFactory, setShowTokenFactory] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    if (wallet) {
      navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!wallet) return null;

  return (
    <div className="min-h-screen relative bg-linear-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Modern animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-pink-600/20 rounded-full blur-[100px] animate-pulse delay-1000"></div>
      </div>

      {/* Header */}
      <header className="relative z-40 glass sticky top-0 border-b border-white/10 w-full">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <div className="flex items-center space-x-3 md:space-x-4">
              <div className="flex items-center space-x-2 md:space-x-3">
                <div className="p-2 bg-linear-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/30">
                  <Wallet className="w-5 h-5 md:w-6 md:h-6 text-white" />
                </div>
                <span className="text-lg md:text-xl lg:text-2xl font-bold text-white tracking-tight">
                  VaultX
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2 md:space-x-4">
              <button
                onClick={() => setShowNetwork(true)}
                className="flex items-center space-x-1.5 md:space-x-2 bg-white/5 hover:bg-white/10 px-3 md:px-4 py-2 rounded-xl transition-all duration-200 border border-white/10"
              >
                <Network className="w-4 h-4 text-indigo-400" />
                <span className="text-white text-xs md:text-sm font-medium hidden sm:inline">{currentNetwork.name}</span>
                <ChevronDown className="w-3 h-3 md:w-4 md:h-4 text-gray-400" />
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 md:p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all duration-200 border border-white/10"
                aria-label="Settings"
              >
                <Settings className="w-4 h-4 md:w-5 md:h-5 text-gray-300" />
              </button>
              <button
                onClick={lockWallet}
                className="p-2 md:p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all duration-200 border border-white/10"
                aria-label="Lock Wallet"
              >
                <LogOut className="w-4 h-4 md:w-5 md:h-5 text-gray-300" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 min-h-[calc(100vh-4rem)] flex flex-col items-center w-full">
        <div className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 md:py-12 lg:py-16 pb-24 md:pb-12 flex flex-col">
          {/* Balance Card */}
          <div className="glass rounded-3xl p-8 md:p-12 mb-8 md:mb-12 relative overflow-hidden group">
            <div className="absolute inset-0 bg-linear-to-br from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative z-10 text-center">
            <p className="text-gray-400 mb-4 md:mb-5 text-sm md:text-base font-medium uppercase tracking-wider">Total Balance</p>
            <div className="flex items-center justify-center space-x-3 md:space-x-4 mb-5 md:mb-7">
              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white tracking-tight">
                {showBalance ? (isNaN(parseFloat(balance)) ? '0.0000' : parseFloat(balance).toFixed(4)) : '••••••'}
              </h1>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="text-gray-400 hover:text-white transition-colors p-1.5"
                aria-label={showBalance ? 'Hide balance' : 'Show balance'}
              >
                {showBalance ? <EyeOff className="w-6 h-6 md:w-7 md:h-7" /> : <Eye className="w-6 h-6 md:w-7 md:h-7" />}
              </button>
            </div>
            <p className="text-indigo-400 font-semibold mb-8 md:mb-10 text-lg md:text-xl">{currentNetwork.currencySymbol}</p>
            
            <div className="flex items-center justify-center mb-8 md:mb-10">
              <button
                onClick={() => setShowTokenFactory(true)}
                className="btn btn-primary px-10 md:px-12 py-4 md:py-5 rounded-2xl text-lg md:text-xl shadow-lg shadow-indigo-500/30 hover:scale-105 transition-transform duration-200"
              >
                <Coins className="w-6 h-6 md:w-7 md:h-7 mr-3" />
                <span>Create Custom Token</span>
              </button>
            </div>
            
            <div className="flex items-center justify-center space-x-3 md:space-x-4 mb-8 md:mb-10 flex-wrap gap-3">
              <div className="bg-black/30 rounded-xl px-4 md:px-5 py-2.5 md:py-3 max-w-full border border-white/10">
                <code className="text-gray-300 text-sm sm:text-base md:text-lg break-all font-mono">{formatAddr(wallet.address)}</code>
              </div>
              <button
                onClick={copyAddress}
                className="p-2.5 md:p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all duration-200"
                aria-label="Copy address"
              >
                {copied ? (
                  <span className="text-green-400 text-sm md:text-base font-medium">Copied!</span>
                ) : (
                  <Copy className="w-5 h-5 md:w-6 md:h-6 text-gray-400" />
                )}
              </button>
            </div>

            <div className="hidden md:flex items-center justify-center gap-4 md:gap-6 flex-wrap">
              <button
                onClick={() => setShowSend(true)}
                className="btn btn-primary min-w-[140px] py-3 text-base"
              >
                <Send className="w-5 h-5 mr-2" />
                <span>Send</span>
              </button>
              <button
                onClick={() => setShowReceive(true)}
                className="btn btn-secondary min-w-[140px] py-3 text-base"
              >
                <Download className="w-5 h-5 mr-2" />
                <span>Receive</span>
              </button>
              <button
                onClick={() => setShowTrending(true)}
                className="btn btn-ghost bg-white/5 hover:bg-white/10 text-white min-w-[140px] py-3 text-base"
              >
                <TrendingUp className="w-5 h-5 mr-2" />
                <span>Trending</span>
              </button>
              <button
                onClick={refreshBalance}
                disabled={isLoading}
                className="p-3 md:p-3.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all duration-300 border border-white/10"
                aria-label="Refresh balance"
              >
                <RefreshCw className={`w-5 h-5 md:w-6 md:h-6 text-gray-300 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          </div>

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10 items-start">
            <div className="flex-1 min-h-0 h-full">
              <TransactionHistory />
            </div>
            <div className="flex-1 min-h-0 h-full">
              <div className="glass rounded-3xl p-8 md:p-10 h-full flex flex-col">
                <div className="flex items-center justify-between mb-6 md:mb-8 flex-wrap gap-3">
                  <h2 className="text-xl md:text-2xl font-bold text-white">My Tokens & Assets</h2>
                </div>
                <MyTokensAssets />
              </div>
            </div>
          </div>
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass safe-area-bottom border-t border-white/10">
        <div className="max-w-7xl mx-auto px-2 py-2 safe-area-bottom">
          <div className="flex items-center justify-around">
            <button
              onClick={() => setShowSend(true)}
              className="flex flex-col items-center justify-center space-y-1 px-4 py-2 rounded-xl transition-all duration-200 active:scale-95 flex-1 max-w-20"
            >
              <div className="p-2.5 bg-linear-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/30">
                <Send className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs text-indigo-300 font-medium">Send</span>
            </button>

            <button
              onClick={() => setShowReceive(true)}
              className="flex flex-col items-center justify-center space-y-1 px-4 py-2 rounded-xl transition-all duration-200 active:scale-95 flex-1 max-w-20"
            >
              <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl">
                <Download className="w-5 h-5 text-gray-400" />
              </div>
              <span className="text-xs text-gray-400 font-medium">Receive</span>
            </button>

            <button
              onClick={refreshBalance}
              disabled={isLoading}
              className="flex flex-col items-center justify-center space-y-1 px-4 py-2 rounded-xl transition-all duration-200 active:scale-95 flex-1 max-w-20 disabled:opacity-50"
            >
              <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl">
                <RefreshCw className={`w-5 h-5 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
              </div>
              <span className="text-xs text-gray-400 font-medium">Refresh</span>
            </button>

            <button
              onClick={() => setShowTrending(true)}
              className="flex flex-col items-center justify-center space-y-1 px-4 py-2 rounded-xl transition-all duration-200 active:scale-95 flex-1 max-w-20"
            >
              <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl">
                <TrendingUp className="w-5 h-5 text-gray-400" />
              </div>
              <span className="text-xs text-gray-400 font-medium">Trending</span>
            </button>

            <button
              onClick={() => setShowSettings(true)}
              className="flex flex-col items-center justify-center space-y-1 px-4 py-2 rounded-xl transition-all duration-200 active:scale-95 flex-1 max-w-20"
            >
              <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl">
                <Settings className="w-5 h-5 text-gray-400" />
              </div>
              <span className="text-xs text-gray-400 font-medium">Settings</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="md:hidden h-20"></div>

      {showSend && <SendModal onClose={() => setShowSend(false)} />}
      {showReceive && <ReceiveModal onClose={() => setShowReceive(false)} />}
      {showNetwork && <NetworkSelector onClose={() => setShowNetwork(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showTrending && <TrendingTokens onClose={() => setShowTrending(false)} />}
      {showTokenFactory && <TokenFactoryModal onClose={() => setShowTokenFactory(false)} />}
    </div>
  );
}

