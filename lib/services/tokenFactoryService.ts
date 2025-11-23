import { ethers } from 'ethers';
import { Network } from '@/lib/wallet/networks';
import tokenFactoryABI from '@/lib/contracts/tokenFactory.json';
import customTokenABI from '@/lib/contracts/customToken.json';

const TOKEN_FACTORY_ADDRESSES: { [key: number]: string } = {
  11155111: '0x16aC53c5c1Cf0de31b62db331090Fd8a39bBBECc', // Sepolia
};

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  balance?: string;
  isOwner?: boolean;
}

export class TokenFactoryService {
  private provider: ethers.Provider;
  private network: Network;
  private factoryContract: ethers.Contract | null = null;
  private wallet: ethers.Wallet;

  constructor(network: Network, privateKey: string) {
    this.network = network;
    this.provider = new ethers.JsonRpcProvider(network.rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    
    const address = TOKEN_FACTORY_ADDRESSES[network.chainId];
    if (address) {
      this.factoryContract = new ethers.Contract(
        address,
        tokenFactoryABI,
        this.wallet
      );
    }
  }

  async getCreationFee(): Promise<string> {
    if (!this.factoryContract) {
      throw new Error('Token Factory not supported on this network');
    }
    try {
      const fee = await this.factoryContract.creationFee();
      return ethers.formatEther(fee);
    } catch (error) {
      console.error('Error getting creation fee:', error);
      throw error;
    }
  }

  async createToken(
    name: string,
    symbol: string,
    initialSupply: string
  ): Promise<string> {
    const factoryContract = this.factoryContract;
    if (!factoryContract) {
      throw new Error('Token Factory not supported on this network');
    }
    try {
      const fee = await this.getCreationFee();
      const feeWei = ethers.parseEther(fee);

      const tx = await factoryContract.createToken(
        name,
        symbol,
        initialSupply,
        { value: feeWei }
      );

      const receipt = await tx.wait();
      
      const tokenCreatedEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = factoryContract.interface.parseLog(log);
          return parsed?.name === 'TokenCreated';
        } catch {
          return false;
        }
      });

      if (tokenCreatedEvent) {
        const parsed = factoryContract.interface.parseLog(tokenCreatedEvent);
        return parsed?.args.tokenAddress as string;
      }

      throw new Error('TokenCreated event not found');
    } catch (error: any) {
      console.error('Error creating token:', error);
      throw new Error(error.message || 'Failed to create token');
    }
  }

  async getUserTokens(userAddress: string): Promise<string[]> {
    if (!this.factoryContract) return [];
    try {
      return await this.factoryContract.getUserTokens(userAddress);
    } catch (error) {
      console.error('Error getting user tokens:', error);
      return [];
    }
  }

  async getTotalTokensCreated(): Promise<number> {
    if (!this.factoryContract) return 0;
    try {
      const total = await this.factoryContract.getTotalTokensCreated();
      return Number(total);
    } catch (error) {
      console.error('Error getting total tokens:', error);
      return 0;
    }
  }

  async isToken(tokenAddress: string): Promise<boolean> {
    if (!this.factoryContract) return false;
    try {
      return await this.factoryContract.isToken(tokenAddress);
    } catch (error) {
      console.error('Error checking token:', error);
      return false;
    }
  }

  async getTokenInfo(tokenAddress: string, userAddress?: string): Promise<TokenInfo> {
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        customTokenABI,
        this.wallet
      );

      const [name, symbol, decimals, totalSupply, owner] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.totalSupply(),
        tokenContract.owner().catch(() => null),
      ]);

      let balance: string | undefined;
      if (userAddress) {
        try {
          const bal = await tokenContract.balanceOf(userAddress);
          balance = ethers.formatUnits(bal, decimals);
        } catch {
          balance = '0';
        }
      }

      return {
        address: tokenAddress,
        name,
        symbol,
        decimals: Number(decimals),
        totalSupply: ethers.formatUnits(totalSupply, decimals),
        balance,
        isOwner: userAddress && owner ? owner.toLowerCase() === userAddress.toLowerCase() : false,
      };
    } catch (error) {
      console.error('Error getting token info:', error);
      throw error;
    }
  }

  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<string> {
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        customTokenABI,
        this.wallet
      );
      const decimals = await tokenContract.decimals();
      const balance = await tokenContract.balanceOf(userAddress);
      return ethers.formatUnits(balance, decimals);
    } catch (error) {
      console.error('Error getting token balance:', error);
      return '0';
    }
  }
}

