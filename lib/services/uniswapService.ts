/**
 * Uniswap Swap Service
 * Handles token swaps using Uniswap V3 (especially for testnets)
 */

import { ethers } from 'ethers';
import { Network } from '@/lib/wallet/networks';
import { getProvider, getWallet } from '@/lib/wallet/provider';
import { NATIVE_TOKEN } from './swapService';

// Uniswap V3 Router address (same for mainnet and testnets)
const UNISWAP_V3_ROUTER: Record<number, string> = {
  1: '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Ethereum Mainnet
  11155111: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E', // Sepolia Testnet (Uniswap V3 Router)
  5: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E', // Goerli (if needed)
};

// Uniswap V3 Router ABI (SwapRouter02 - compatible with ethers v6)
const ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
  'function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum) external payable returns (uint256 amountOut)',
  'function multicall(uint256 deadline, bytes[] calldata data) external payable returns (bytes[] memory results)',
];

// Uniswap V3 Quoter V2 address (more reliable)
const UNISWAP_V3_QUOTER: Record<number, string> = {
  1: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e', // Ethereum Mainnet (QuoterV2)
  11155111: '0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3', // Sepolia Testnet (Quoter)
  // Fallback to Quoter V1 if V2 not available
};

// Quoter ABI (compatible with both V1 and V2)
const QUOTER_ABI = [
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)',
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
];

// Common fee tiers for Uniswap V3
const FEE_TIERS = [500, 3000, 10000]; // 0.05%, 0.3%, 1%

/**
 * Check if Uniswap supports the network
 */
export function isUniswapSupported(chainId: number): boolean {
  // Uniswap V3 supports mainnet and Sepolia testnet
  const supportedChains = [1, 11155111, 5, 42161, 137, 10, 8453];
  return supportedChains.includes(chainId);
}

export interface UniswapQuote {
  fromToken: string;
  toToken: string;
  fromTokenAmount: string;
  toTokenAmount: string;
  estimatedGas: string;
  fee: number;
}

/**
 * Get WETH address for a network (needed for native token swaps)
 */
function getWETHAddress(chainId: number): string | null {
  const WETH_ADDRESSES: Record<number, string> = {
    1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // Ethereum Mainnet
    11155111: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', // Sepolia Testnet
    5: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6', // Goerli
    42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // Arbitrum
    137: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // Polygon (WMATIC)
    10: '0x4200000000000000000000000000000000000006', // Optimism
  };
  return WETH_ADDRESSES[chainId] || null;
}

/**
 * Get swap quote from Uniswap V3
 */
export async function getUniswapQuote(
  network: Network,
  fromToken: string,
  toToken: string,
  amount: string
): Promise<UniswapQuote | null> {
  try {
    const chainId = network.chainId;
    const quoterAddress = UNISWAP_V3_QUOTER[chainId];
    
    if (!quoterAddress) {
      console.warn(`Uniswap V3 Quoter not available for ${network.name}`);
      return null;
    }

    const provider = getProvider(network);
    
    // Get token decimals
    const fromTokenInfo = await getTokenInfo(network, fromToken);
    const toTokenInfo = await getTokenInfo(network, toToken);
    const fromDecimals = fromTokenInfo?.decimals || 18;
    const toDecimals = toTokenInfo?.decimals || 18;

    if (!fromTokenInfo || !toTokenInfo) {
      console.error('Failed to get token info');
      return null;
    }

    const amountIn = ethers.parseUnits(amount, fromDecimals);

    // Convert native token to WETH for Uniswap
    const wethAddress = getWETHAddress(chainId);
    const tokenIn = fromToken === NATIVE_TOKEN 
      ? (wethAddress || fromToken)
      : fromToken;
    const tokenOut = toToken === NATIVE_TOKEN 
      ? (wethAddress || toToken)
      : toToken;

    // Validate token addresses
    if (!ethers.isAddress(tokenIn) || !ethers.isAddress(tokenOut)) {
      console.error('Invalid token addresses');
      return null;
    }

    const quoter = new ethers.Contract(quoterAddress, QUOTER_ABI, provider);

    // Try different fee tiers to find the best quote
    let bestQuote: bigint | null = null;
    let bestFee = 0;

    for (const fee of FEE_TIERS) {
      try {
        // Try to call the quoter - handle both single return and tuple return
        let amountOut: bigint;
        
        // Use staticCall for ethers v6 (read-only call)
        // Note: In ethers v6, we use .staticCall() method
        const result = await quoter.quoteExactInputSingle.staticCall(
          tokenIn,
          tokenOut,
          fee,
          amountIn,
          0
        );
        
        // Handle tuple response (QuoterV2) or single value (QuoterV1)
        if (Array.isArray(result) && result.length > 0) {
          amountOut = result[0];
        } else if (typeof result === 'bigint') {
          amountOut = result;
        } else {
          // Try to extract from object
          amountOut = (result as any).amountOut || (result as any)[0] || result;
        }

        if (amountOut && amountOut > BigInt(0) && (!bestQuote || amountOut > bestQuote)) {
          bestQuote = amountOut;
          bestFee = fee;
        }
      } catch (error: any) {
        // Pool might not exist for this fee tier, try next one
        const errorMsg = error.message || error.toString() || String(error);
        if (errorMsg.includes('STF') || errorMsg.includes('SPL') || 
            errorMsg.includes('revert') || errorMsg.includes('execution reverted')) {
          // Pool doesn't exist or insufficient liquidity
          continue;
        }
        // Log other errors for debugging
        console.debug(`Fee tier ${fee} failed:`, errorMsg);
        continue;
      }
    }

    if (!bestQuote || bestQuote === BigInt(0)) {
      console.warn('No valid quote found for any fee tier. Pool may not exist.');
      return null;
    }

    return {
      fromToken,
      toToken,
      fromTokenAmount: amount,
      toTokenAmount: ethers.formatUnits(bestQuote, toDecimals),
      estimatedGas: '200000', // Estimated gas for Uniswap swap (higher for safety)
      fee: bestFee,
    };
  } catch (error: any) {
    console.error('Error getting Uniswap quote:', error);
    const errorMsg = error.message || error.toString();
    
    // Provide helpful error messages
    if (errorMsg.includes('STF') || errorMsg.includes('insufficient liquidity')) {
      throw new Error('Insufficient liquidity in Uniswap pool for this token pair');
    } else if (errorMsg.includes('SPL')) {
      throw new Error('Pool does not exist for this token pair');
    }
    
    return null;
  }
}

/**
 * Execute swap using Uniswap V3
 */
export async function executeUniswapSwap(
  network: Network,
  privateKey: string,
  fromToken: string,
  toToken: string,
  amount: string,
  amountOutMinimum: string,
  fee: number,
  slippage: number
): Promise<ethers.TransactionResponse> {
  try {
    const chainId = network.chainId;
    const routerAddress = UNISWAP_V3_ROUTER[chainId];

    if (!routerAddress) {
      throw new Error(`Uniswap V3 Router not available for ${network.name}`);
    }

    const wallet = getWallet(privateKey, network);
    const router = new ethers.Contract(routerAddress, ROUTER_ABI, wallet);

    // Get token decimals
    const fromTokenInfo = await getTokenInfo(network, fromToken);
    const toTokenInfo = await getTokenInfo(network, toToken);
    const fromDecimals = fromTokenInfo?.decimals || 18;
    const toDecimals = toTokenInfo?.decimals || 18;

    const amountIn = ethers.parseUnits(amount, fromDecimals);
    const amountOutMin = ethers.parseUnits(amountOutMinimum, toDecimals);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

    // Convert native token to WETH for Uniswap
    const wethAddress = getWETHAddress(chainId);
    if (!wethAddress && (fromToken === NATIVE_TOKEN || toToken === NATIVE_TOKEN)) {
      throw new Error('WETH address not available for this network');
    }

    const tokenIn = fromToken === NATIVE_TOKEN ? wethAddress! : fromToken;
    const tokenOut = toToken === NATIVE_TOKEN ? wethAddress! : toToken;

    // Validate addresses
    if (!ethers.isAddress(tokenIn) || !ethers.isAddress(tokenOut)) {
      throw new Error('Invalid token addresses');
    }

    // Handle native token: wrap ETH to WETH if needed
    if (fromToken === NATIVE_TOKEN) {
      // Need to wrap ETH to WETH first
      const wethAbi = [
        'function deposit() payable',
        'function balanceOf(address) view returns (uint256)',
      ];
      const wethContract = new ethers.Contract(wethAddress!, wethAbi, wallet);
      
      // Check WETH balance
      const wethBalance = await wethContract.balanceOf(wallet.address);
      if (wethBalance < amountIn) {
        // Wrap the difference
        const wrapAmount = amountIn - wethBalance;
        const wrapTx = await wethContract.deposit({ value: wrapAmount });
        await wrapTx.wait();
      }
    }

    // Approve token if needed (for ERC-20, including WETH)
    if (fromToken !== NATIVE_TOKEN || tokenIn === wethAddress) {
      const tokenToApprove = fromToken === NATIVE_TOKEN ? wethAddress! : fromToken;
      const erc20Abi = [
        'function approve(address spender, uint256 amount) returns (bool)',
        'function allowance(address owner, address spender) view returns (uint256)',
      ];
      const tokenContract = new ethers.Contract(tokenToApprove, erc20Abi, wallet);
      const allowance = await tokenContract.allowance(wallet.address, routerAddress);
      
      if (allowance < amountIn) {
        const approveTx = await tokenContract.approve(routerAddress, ethers.MaxUint256);
        await approveTx.wait();
      }
    }

    // Execute swap
    const swapParams = {
      tokenIn,
      tokenOut,
      fee,
      recipient: wallet.address,
      deadline,
      amountIn,
      amountOutMinimum: amountOutMin,
      sqrtPriceLimitX96: 0,
    };

    // For native token swaps, we've already wrapped to WETH, so value is 0
    // For WETH to native, we'll unwrap after the swap
    const tx = await router.exactInputSingle(swapParams, {
      value: 0, // No native value needed since we're using WETH
    });

    // If swapping to native token, unwrap WETH to ETH
    if (toToken === NATIVE_TOKEN && wethAddress) {
      // Note: This requires a second transaction to unwrap WETH
      // For simplicity, we'll return the swap tx and let user unwrap manually
      // Or we could add unwrap logic here
    }

    return tx;
  } catch (error: any) {
    console.error('Error executing Uniswap swap:', error);
    throw new Error(error.message || 'Failed to execute Uniswap swap');
  }
}

/**
 * Get token info helper
 */
async function getTokenInfo(
  network: Network,
  tokenAddress: string
): Promise<{ symbol: string; decimals: number; name: string } | null> {
  try {
    if (tokenAddress === NATIVE_TOKEN) {
      return {
        symbol: network.currencySymbol,
        decimals: 18,
        name: network.currency,
      };
    }

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

