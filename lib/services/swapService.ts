/**
 * 1inch Fusion Swap Service
 * Handles token swaps using 1inch Fusion Protocol
 */

import { ethers } from 'ethers';
import { Network } from '@/lib/wallet/networks';
import { getProvider, getWallet } from '@/lib/wallet/provider';

// 1inch Fusion API endpoints
const FUSION_API_BASE = 'https://api.1inch.dev';

// Common token addresses (native token is represented as 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
export const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// Popular token addresses by network
export const POPULAR_TOKENS: Record<number, Record<string, { address: string; symbol: string; decimals: number; name: string }>> = {
  1: { // Ethereum Mainnet
    ETH: { address: NATIVE_TOKEN, symbol: 'ETH', decimals: 18, name: 'Ethereum' },
    USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6, name: 'Tether USD' },
    DAI: { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', decimals: 18, name: 'Dai Stablecoin' },
    WETH: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18, name: 'Wrapped Ethereum' },
  },
  11155111: { // Sepolia Testnet
    ETH: { address: NATIVE_TOKEN, symbol: 'ETH', decimals: 18, name: 'Ethereum' },
    WETH: { address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', symbol: 'WETH', decimals: 18, name: 'Wrapped Ethereum' },
    // Common Sepolia testnet tokens with actual pools
    USDC: { address: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8', symbol: 'USDC', decimals: 6, name: 'USD Coin (Testnet)' },
    // Alternative: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
  },
  56: { // BSC
    BNB: { address: NATIVE_TOKEN, symbol: 'BNB', decimals: 18, name: 'BNB' },
    USDT: { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', decimals: 18, name: 'Tether USD' },
    USDC: { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC', decimals: 18, name: 'USD Coin' },
    BUSD: { address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', symbol: 'BUSD', decimals: 18, name: 'Binance USD' },
  },
  137: { // Polygon
    MATIC: { address: NATIVE_TOKEN, symbol: 'MATIC', decimals: 18, name: 'Polygon' },
    USDC: { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    USDT: { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', decimals: 6, name: 'Tether USD' },
    DAI: { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', symbol: 'DAI', decimals: 18, name: 'Dai Stablecoin' },
  },
  42161: { // Arbitrum
    ETH: { address: NATIVE_TOKEN, symbol: 'ETH', decimals: 18, name: 'Ethereum' },
    USDC: { address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
    USDT: { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT', decimals: 6, name: 'Tether USD' },
  },
};

export interface SwapQuote {
  fromToken: string;
  toToken: string;
  fromTokenAmount: string;
  toTokenAmount: string;
  estimatedGas: string;
  protocols: any[];
}

export interface SwapParams {
  fromToken: string;
  toToken: string;
  amount: string;
  fromAddress: string;
  slippage: number; // in percentage (e.g., 1 for 1%)
}

/**
 * Get swap quote from 1inch API
 */
export async function getSwapQuote(
  network: Network,
  fromToken: string,
  toToken: string,
  amount: string,
  fromAddress: string
): Promise<SwapQuote | null> {
  try {
    const chainId = network.chainId;
    const apiUrl = `${FUSION_API_BASE}/swap/v6.0/${chainId}/quote`;
    
    const params = new URLSearchParams({
      src: fromToken,
      dst: toToken,
      amount: ethers.parseUnits(amount, 18).toString(), // Assuming 18 decimals for input
      from: fromAddress,
    });

    const response = await fetch(`${apiUrl}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('1inch API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    
    return {
      fromToken: data.fromToken.address,
      toToken: data.toToken.address,
      fromTokenAmount: ethers.formatUnits(data.fromTokenAmount, data.fromToken.decimals),
      toTokenAmount: ethers.formatUnits(data.toTokenAmount, data.toToken.decimals),
      estimatedGas: data.estimatedGas || '0',
      protocols: data.protocols || [],
    };
  } catch (error) {
    console.error('Error getting swap quote:', error);
    return null;
  }
}

/**
 * Execute swap using 1inch Fusion
 */
export async function executeSwap(
  network: Network,
  privateKey: string,
  swapParams: SwapParams
): Promise<ethers.TransactionResponse> {
  try {
    const chainId = network.chainId;
    const wallet = getWallet(privateKey, network);
    const provider = getProvider(network);

    // First, get the swap quote
    const quote = await getSwapQuote(
      network,
      swapParams.fromToken,
      swapParams.toToken,
      swapParams.amount,
      swapParams.fromAddress
    );

    if (!quote) {
      throw new Error('Failed to get swap quote');
    }

    // Get token decimals for proper amount formatting
    const fromTokenInfo = await getTokenInfo(network, swapParams.fromToken);
    const decimals = fromTokenInfo?.decimals || 18;
    
    // Get swap transaction data
    const swapUrl = `${FUSION_API_BASE}/swap/v6.0/${chainId}/swap`;
    const swapParams_query = new URLSearchParams({
      src: swapParams.fromToken,
      dst: swapParams.toToken,
      amount: ethers.parseUnits(swapParams.amount, decimals).toString(),
      from: swapParams.fromAddress,
      slippage: swapParams.slippage.toString(),
      disableEstimate: 'true',
    });

    const swapResponse = await fetch(`${swapUrl}?${swapParams_query.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!swapResponse.ok) {
      const errorText = await swapResponse.text();
      throw new Error(`1inch swap API error: ${swapResponse.status} - ${errorText}`);
    }

    const swapData = await swapResponse.json();
    const tx = swapData.tx;

    // Handle token approval if needed (for ERC-20 tokens)
    if (swapParams.fromToken.toLowerCase() !== NATIVE_TOKEN.toLowerCase()) {
      // Check if approval is needed
      const erc20Abi = [
        'function allowance(address owner, address spender) view returns (uint256)',
        'function approve(address spender, uint256 amount) returns (bool)',
      ];
      
      const tokenContract = new ethers.Contract(swapParams.fromToken, erc20Abi, wallet);
      const spender = tx.to; // 1inch router address
      const amount = ethers.parseUnits(swapParams.amount, decimals);
      
      const allowance = await tokenContract.allowance(wallet.address, spender);
      
      if (allowance < amount) {
        // Approve token spending
        const approveTx = await tokenContract.approve(spender, ethers.MaxUint256);
        await approveTx.wait();
      }
    }

    // Execute swap transaction
    const swapTransaction: ethers.TransactionRequest = {
      to: tx.to,
      data: tx.data,
      value: tx.value ? BigInt(tx.value) : BigInt(0),
      gasLimit: tx.gas ? BigInt(tx.gas) : undefined,
      gasPrice: tx.gasPrice ? BigInt(tx.gasPrice) : undefined,
    };

    const swapTx = await wallet.sendTransaction(swapTransaction);
    return swapTx;
  } catch (error: any) {
    console.error('Error executing swap:', error);
    throw new Error(error.message || 'Failed to execute swap');
  }
}

/**
 * Get token info
 */
export async function getTokenInfo(
  network: Network,
  tokenAddress: string
): Promise<{ symbol: string; decimals: number; name: string } | null> {
  try {
    // Check if it's native token
    if (tokenAddress.toLowerCase() === NATIVE_TOKEN.toLowerCase()) {
      return {
        symbol: network.currencySymbol,
        decimals: 18,
        name: network.currency,
      };
    }

    // Get from popular tokens first
    const popularTokens = POPULAR_TOKENS[network.chainId];
    if (popularTokens) {
      for (const token of Object.values(popularTokens)) {
        if (token.address.toLowerCase() === tokenAddress.toLowerCase()) {
          return token;
        }
      }
    }

    // Fetch from contract
    const provider = getProvider(network);
    const erc20Abi = [
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
      'function name() view returns (string)',
    ];

    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    const [symbol, decimals, name] = await Promise.all([
      tokenContract.symbol(),
      tokenContract.decimals(),
      tokenContract.name(),
    ]);

    return { symbol, decimals: Number(decimals), name };
  } catch (error) {
    console.error('Error getting token info:', error);
    return null;
  }
}

