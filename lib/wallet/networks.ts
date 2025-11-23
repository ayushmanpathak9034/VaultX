export interface Network {
  id: string;
  name: string;
  rpcUrl: string;
  chainId: number;
  currency: string;
  currencySymbol: string;
  blockExplorer?: string;
  isCustom?: boolean;
}

export const DEFAULT_NETWORKS: Network[] = [
  {
    id: 'ethereum',
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://eth.llamarpc.com',
    chainId: 1,
    currency: 'ETH',
    currencySymbol: 'ETH',
    blockExplorer: 'https://etherscan.io',
  },
  {
    id: 'sepolia',
    name: 'Sepolia Testnet',
    rpcUrl: 'https://0xrpc.io/sep',
    chainId: 11155111,
    currency: 'ETH',
    currencySymbol: 'ETH',
    blockExplorer: 'https://sepolia.etherscan.io',
  },
  {
    id: 'bsc',
    name: 'BNB Smart Chain',
    rpcUrl: 'https://bsc-dataseed1.binance.org',
    chainId: 56,
    currency: 'BNB',
    currencySymbol: 'BNB',
    blockExplorer: 'https://bscscan.com',
  },
  {
    id: 'polygon',
    name: 'Polygon',
    rpcUrl: 'https://polygon-rpc.com',
    chainId: 137,
    currency: 'MATIC',
    currencySymbol: 'MATIC',
    blockExplorer: 'https://polygonscan.com',
  },
  {
    id: 'avalanche',
    name: 'Avalanche',
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    chainId: 43114,
    currency: 'AVAX',
    currencySymbol: 'AVAX',
    blockExplorer: 'https://snowtrace.io',
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum One',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    chainId: 42161,
    currency: 'ETH',
    currencySymbol: 'ETH',
    blockExplorer: 'https://arbiscan.io',
  },
];

const STORAGE_KEY = 'custom_networks';

/**
 * Get all networks (default + custom)
 */
export function getAllNetworks(): Network[] {
  const customNetworks = getCustomNetworks();
  return [...DEFAULT_NETWORKS, ...customNetworks];
}

/**
 * Get custom networks from localStorage
 */
export function getCustomNetworks(): Network[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

/**
 * Add custom network
 */
export function addCustomNetwork(network: Network): void {
  if (typeof window === 'undefined') return;
  const customNetworks = getCustomNetworks();
  
  // Check if network with same chainId already exists
  if (customNetworks.some(n => n.chainId === network.chainId)) {
    throw new Error('Network with this Chain ID already exists');
  }
  
  const newNetwork = { ...network, isCustom: true };
  customNetworks.push(newNetwork);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customNetworks));
}

/**
 * Remove custom network
 */
export function removeCustomNetwork(chainId: number): void {
  if (typeof window === 'undefined') return;
  const customNetworks = getCustomNetworks().filter(n => n.chainId !== chainId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customNetworks));
}

/**
 * Get network by chain ID
 */
export function getNetworkByChainId(chainId: number): Network | undefined {
  return getAllNetworks().find(n => n.chainId === chainId);
}

/**
 * Get current network from localStorage
 */
export function getCurrentNetwork(): Network {
  if (typeof window === 'undefined') return DEFAULT_NETWORKS[0];
  const stored = localStorage.getItem('current_network');
  if (stored) {
    const chainId = parseInt(stored);
    return getNetworkByChainId(chainId) || DEFAULT_NETWORKS[0];
  }
  return DEFAULT_NETWORKS[0];
}

/**
 * Set current network
 */
export function setCurrentNetwork(chainId: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('current_network', chainId.toString());
}

