import { ethers } from 'ethers';
import { Network } from './networks';
import { getProvider, getWallet } from './provider';

export interface TransactionRequest {
  to: string;
  value: string; // In native currency (ETH, BNB, etc.)
  data?: string;
  gasLimit?: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}

export interface TransactionResult {
  hash: string;
  from: string;
  to: string;
  value: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  confirmations?: number;
}

/**
 * Modular Transaction Service - MetaMask-like functionality
 */
export class TransactionService {
  private network: Network;
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet | null = null;

  constructor(network: Network, privateKey?: string) {
    this.network = network;
    this.provider = getProvider(network);
    if (privateKey) {
      this.wallet = getWallet(privateKey, network);
    }
  }

  /**
   * Set wallet for signing transactions
   */
  setWallet(privateKey: string) {
    if (privateKey) {
      this.wallet = getWallet(privateKey, this.network);
    }
  }

  /**
   * Get current gas price from network
   */
  async getGasPrice(): Promise<bigint> {
    try {
      const feeData = await this.provider.getFeeData();
      return feeData.gasPrice || BigInt(0);
    } catch (error) {
      console.error('Error fetching gas price:', error);
      // Return default gas price if estimation fails
      return BigInt(20000000000); // 20 gwei default
    }
  }

  /**
   * Estimate gas for a transaction
   */
  async estimateGas(request: TransactionRequest): Promise<bigint> {
    try {
      if (!this.wallet) {
        throw new Error('Wallet not set');
      }

      const gasEstimate = await this.provider.estimateGas({
        from: this.wallet.address,
        to: request.to,
        value: ethers.parseEther(request.value),
        data: request.data,
      });

      // Add 20% buffer for safety
      return (gasEstimate * BigInt(120)) / BigInt(100);
    } catch (error: any) {
      console.error('Gas estimation error:', error);
      // Return default gas limit if estimation fails
      return request.gasLimit || BigInt(21000);
    }
  }

  /**
   * Send native token transaction (ETH, BNB, MATIC, etc.)
   */
  async sendTransaction(request: TransactionRequest): Promise<TransactionResult> {
    if (!this.wallet) {
      throw new Error('Wallet not set. Call setWallet() first.');
    }

    try {
      // Get gas price
      const gasPrice = request.gasPrice || await this.getGasPrice();
      
      // Estimate gas if not provided
      const gasLimit = request.gasLimit || await this.estimateGas(request);

      // Build transaction
      const txRequest: ethers.TransactionRequest = {
        to: request.to,
        value: ethers.parseEther(request.value),
        data: request.data,
        gasLimit: gasLimit,
        gasPrice: gasPrice,
      };

      // Send transaction
      const tx = await this.wallet.sendTransaction(txRequest);

      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to || request.to,
        value: request.value,
        status: 'pending',
        confirmations: 0,
      };
    } catch (error: any) {
      console.error('Transaction send error:', error);
      throw new Error(error.message || 'Failed to send transaction');
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForConfirmation(txHash: string, confirmations: number = 1): Promise<TransactionResult> {
    try {
      const receipt = await this.provider.waitForTransaction(txHash, confirmations);
      
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }
      
      // Get transaction to get value
      const tx = await this.provider.getTransaction(txHash);
      const value = tx ? ethers.formatEther(tx.value) : '0';
      
      const confirmationsCount = typeof receipt.confirmations === 'function' 
        ? await receipt.confirmations() 
        : (receipt.confirmations || 0);
      
      return {
        hash: receipt.hash,
        from: receipt.from,
        to: receipt.to || '',
        value: value,
        status: receipt.status === 1 ? 'confirmed' : 'failed',
        blockNumber: receipt.blockNumber,
        confirmations: typeof confirmationsCount === 'number' ? confirmationsCount : 0,
      };
    } catch (error: any) {
      console.error('Transaction confirmation error:', error);
      throw new Error(error.message || 'Failed to confirm transaction');
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(txHash: string): Promise<TransactionResult | null> {
    try {
      const tx = await this.provider.getTransaction(txHash);
      if (!tx) {
        return null;
      }

      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        return {
          hash: tx.hash,
          from: tx.from,
          to: tx.to || '',
          value: ethers.formatEther(tx.value),
          status: 'pending',
          confirmations: 0,
        };
      }
      
      const confirmationsCount = typeof receipt.confirmations === 'function' 
        ? await receipt.confirmations() 
        : (receipt.confirmations || 0);
      
      return {
        hash: receipt.hash,
        from: receipt.from,
        to: receipt.to || '',
        value: ethers.formatEther(tx.value),
        status: receipt.status === 1 ? 'confirmed' : 'failed',
        blockNumber: receipt.blockNumber,
        confirmations: typeof confirmationsCount === 'number' ? confirmationsCount : 0,
      };
    } catch (error) {
      console.error('Error getting transaction status:', error);
      return null;
    }
  }

  /**
   * Send ERC-20 token transaction
   */
  async sendTokenTransaction(
    tokenAddress: string,
    to: string,
    amount: string,
    decimals: number = 18
  ): Promise<TransactionResult> {
    if (!this.wallet) {
      throw new Error('Wallet not set. Call setWallet() first.');
    }

    try {
      // ERC-20 ABI
      const erc20Abi = [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function decimals() view returns (uint8)',
      ];

      const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, this.wallet);
      
      // Get decimals if not provided
      let tokenDecimals = decimals;
      try {
        tokenDecimals = await tokenContract.decimals();
      } catch {
        // Use provided decimals
      }

      const amountWei = ethers.parseUnits(amount, tokenDecimals);
      
      // Estimate gas
      const gasEstimate = await tokenContract.transfer.estimateGas(to, amountWei);
      const gasLimit = (gasEstimate * BigInt(120)) / BigInt(100); // 20% buffer
      
      // Get gas price
      const gasPrice = await this.getGasPrice();

      // Send transaction
      const tx = await tokenContract.transfer(to, amountWei, {
        gasLimit: gasLimit,
        gasPrice: gasPrice,
      });

      return {
        hash: tx.hash,
        from: this.wallet.address,
        to: to,
        value: amount,
        status: 'pending',
        confirmations: 0,
      };
    } catch (error: any) {
      console.error('Token transaction error:', error);
      throw new Error(error.message || 'Failed to send token transaction');
    }
  }
}

