export interface StoredToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  chainId: number;
  createdAt: number;
}

const STORAGE_KEY = 'custom_tokens';

export function getStoredTokens(chainId?: number): StoredToken[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  
  const allTokens: StoredToken[] = JSON.parse(stored);
  if (chainId) {
    return allTokens.filter(token => token.chainId === chainId);
  }
  return allTokens;
}

export function addStoredToken(token: StoredToken): void {
  if (typeof window === 'undefined') return;
  
  const tokens = getStoredTokens();
  
  const exists = tokens.some(
    t => t.address.toLowerCase() === token.address.toLowerCase() && t.chainId === token.chainId
  );
  
  if (!exists) {
    tokens.push(token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  }
}

export function removeStoredToken(address: string, chainId: number): void {
  if (typeof window === 'undefined') return;
  
  const tokens = getStoredTokens();
  const filtered = tokens.filter(
    t => !(t.address.toLowerCase() === address.toLowerCase() && t.chainId === chainId)
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function isTokenStored(address: string, chainId: number): boolean {
  const tokens = getStoredTokens();
  return tokens.some(
    t => t.address.toLowerCase() === address.toLowerCase() && t.chainId === chainId
  );
}

