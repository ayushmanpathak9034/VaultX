import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import CryptoJS from 'crypto-js';

export interface WalletData {
  address: string;
  privateKey: string;
  mnemonic: string;
}

export interface EncryptedWallet {
  encryptedData: string;
  salt: string;
}

/**
 * Generate a new wallet with mnemonic phrase
 */
export function generateWallet(): WalletData {
  const mnemonic = bip39.generateMnemonic();
  const wallet = ethers.Wallet.fromPhrase(mnemonic);
  
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: mnemonic,
  };
}

/**
 * Import wallet from mnemonic phrase
 */
export function importWalletFromMnemonic(mnemonic: string): WalletData {
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic phrase');
  }
  
  const wallet = ethers.Wallet.fromPhrase(mnemonic);
  
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: mnemonic,
  };
}

/**
 * Import wallet from private key
 */
export function importWalletFromPrivateKey(privateKey: string): WalletData {
  try {
    const wallet = new ethers.Wallet(privateKey);
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: '', // Cannot recover mnemonic from private key
    };
  } catch (error) {
    throw new Error('Invalid private key');
  }
}

/**
 * Encrypt wallet data with password
 */
export function encryptWallet(wallet: WalletData, password: string): EncryptedWallet {
  const salt = CryptoJS.lib.WordArray.random(128 / 8).toString();
  const key = CryptoJS.PBKDF2(password, salt, {
    keySize: 512 / 32,
    iterations: 10000,
  });
  
  const encrypted = CryptoJS.AES.encrypt(JSON.stringify(wallet), key.toString(), {
    iv: CryptoJS.lib.WordArray.random(128 / 8),
  });
  
  return {
    encryptedData: encrypted.toString(),
    salt: salt,
  };
}

/**
 * Decrypt wallet data with password
 */
export function decryptWallet(encryptedWallet: EncryptedWallet, password: string): WalletData {
  try {
    const key = CryptoJS.PBKDF2(password, encryptedWallet.salt, {
      keySize: 512 / 32,
      iterations: 10000,
    });
    
    const decrypted = CryptoJS.AES.decrypt(encryptedWallet.encryptedData, key.toString());
    const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedText) {
      throw new Error('Invalid password');
    }
    
    return JSON.parse(decryptedText);
  } catch (error) {
    throw new Error('Failed to decrypt wallet. Invalid password or corrupted data.');
  }
}

/**
 * Store wallet in localStorage (encrypted)
 */
export function storeWallet(encryptedWallet: EncryptedWallet): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('wallet_encrypted', JSON.stringify(encryptedWallet));
}

/**
 * Retrieve wallet from localStorage
 */
export function getStoredWallet(): EncryptedWallet | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('wallet_encrypted');
  return stored ? JSON.parse(stored) : null;
}

/**
 * Clear stored wallet
 */
export function clearStoredWallet(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('wallet_encrypted');
  localStorage.removeItem('wallet_unlocked');
}

/**
 * Check if wallet exists
 */
export function hasStoredWallet(): boolean {
  return getStoredWallet() !== null;
}

/**
 * Sign transaction with private key
 */
export function signTransaction(
  privateKey: string,
  transaction: ethers.TransactionRequest
): Promise<string> {
  const wallet = new ethers.Wallet(privateKey);
  return wallet.signTransaction(transaction);
}

/**
 * Format address for display
 */
export function formatAddress(address: string, chars: number = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Validate Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return ethers.isAddress(address);
}

