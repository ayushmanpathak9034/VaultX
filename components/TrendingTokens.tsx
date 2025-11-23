'use client';

import { useState, useEffect } from 'react';
import { getTrendingTokens, TrendingToken } from '@/lib/services/coingecko';
import { TrendingUp, TrendingDown, Loader2, X, ExternalLink } from 'lucide-react';

interface TrendingTokensProps {
  onClose: () => void;
}

export default function TrendingTokens({ onClose }: TrendingTokensProps) {
  const [tokens, setTokens] = useState<TrendingToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        setIsLoading(true);
        setError('');
        const trending = await getTrendingTokens();
        setTokens(trending);
      } catch (err: any) {
        console.error('Error loading trending tokens:', err);
        setError(err.message || 'Failed to load trending tokens');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrending();
  }, []);

  const formatPrice = (price?: number) => {
    if (!price) return 'N/A';
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatChange = (change?: number) => {
    if (change === undefined || change === null) return 'N/A';
    const isPositive = change >= 0;
    return (
      <span className={`flex items-center space-x-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
        {isPositive ? (
          <TrendingUp className="w-4 h-4" />
        ) : (
          <TrendingDown className="w-4 h-4" />
        )}
        <span>{Math.abs(change).toFixed(2)}%</span>
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="glass rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white">Trending Tokens</h2>
            <p className="text-gray-400 text-sm mt-1">Powered by CoinGecko</p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost p-2.5 rounded-xl text-gray-400 hover:text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <span className="ml-3 text-gray-400">Loading trending tokens...</span>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
              <p className="text-red-400">{error}</p>
            </div>
          ) : tokens.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No trending tokens found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tokens.map((token, index) => (
                <div
                  key={token.id}
                  className="bg-white/5 rounded-xl md:rounded-2xl p-4 border border-white/5 hover:bg-white/10 transition-all duration-200 animate-fadeIn"
                >
                  <div className="flex items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-3 md:space-x-4 flex-1 min-w-0">
                      <div className="text-indigo-400 font-bold text-xs md:text-sm w-5 md:w-6 shrink-0">
                        #{index + 1}
                      </div>
                      {token.thumb && (
                        <img
                          src={token.thumb}
                          alt={token.name}
                          className="w-8 h-8 md:w-10 md:h-10 rounded-full shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                          <h3 className="text-white font-semibold text-sm md:text-base truncate">{token.name}</h3>
                          <span className="text-indigo-400 text-xs md:text-sm font-medium">
                            {token.symbol}
                          </span>
                        </div>
                        {token.market_cap_rank && (
                          <p className="text-gray-500 text-xs mt-1">
                            Rank #{token.market_cap_rank}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 md:space-x-6 shrink-0">
                      <div className="text-right">
                        <p className="text-white font-semibold text-sm md:text-base">
                          {formatPrice(token.price_usd)}
                        </p>
                        {token.price_change_24h !== undefined && (
                          <div className="mt-1">
                            {formatChange(token.price_change_24h)}
                          </div>
                        )}
                      </div>
                      <a
                        href={`https://www.coingecko.com/en/coins/${token.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-white/10 rounded-lg transition-all duration-200 active:scale-95"
                        title="View on CoinGecko"
                        aria-label="View on CoinGecko"
                      >
                        <ExternalLink className="w-4 h-4 text-gray-400 hover:text-white" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-gray-500 text-xs text-center">
              Data provided by CoinGecko. Prices update in real-time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

