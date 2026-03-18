# VaultX

**Introducing a next-gen non-custodial crypto wallet — built for creators and everyday users. Send & receive assets securely, mint custom ERC tokens directly from the UI, and define ownership + royalties with complete on-chain transparency. No code needed. Full control. True ownership.**

## 🌟 Overview

VaultX is a cutting-edge, non-custodial cryptocurrency wallet designed for both creators and everyday users. Built with modern web technologies, it provides a seamless experience for managing digital assets, creating custom tokens, and handling ownership transfers—all without writing a single line of code.

### Key Features

- **Non-Custodial Security**: Your keys, your coins. Private keys are encrypted and stored locally in your browser.
- **Custom Token Creation**: Mint ERC-20 tokens directly from the UI with a simple, intuitive interface.
- **Ownership Management**: Transfer token ownership with a single click.
- **Royalty Distribution**: Distribute royalties to multiple recipients effortlessly.
- **Multi-Chain Support**: Works with multiple EVM-compatible networks (Ethereum, BSC, Polygon, Arbitrum, and more).
- **Responsive Design**: Beautiful, modern UI that works seamlessly on desktop and mobile devices.
- **Real-Time Balance**: Automatic balance updates and transaction tracking.
- **No Code Required**: All functionality accessible through an intuitive user interface.

##  Features

### Core Wallet Features
- **Secure Key Management**: Generate or import wallets with encrypted local storage
- **Multi-Network Support**: Switch between Ethereum, BSC, Polygon, Arbitrum, and custom networks
- **Send & Receive**: Transfer native tokens and ERC-20 tokens securely
- **Transaction History**: View and track all on-chain transactions
- **QR Code Support**: Generate QR codes for easy address sharing

### Token Factory Features
- **Create Custom Tokens**: Deploy ERC-20 tokens with custom name, symbol, and initial supply
- **Token Management**: View all your created tokens in one place
- **Send Tokens**: Transfer tokens to any address
- **Transfer Ownership**: Change token ownership (owner only)
- **Distribute Royalties**: Batch distribute royalties to multiple recipients (owner only)
- **Auto-Import**: Created tokens are automatically added to your wallet

### Security Features
- **Local Encryption**: All sensitive data encrypted using AES-256
- **Password Protection**: Wallet locked by default, requires password to unlock
- **Private Key Security**: Private keys never leave your device
- **Recovery Phrase**: 12-word mnemonic phrase for wallet recovery
- **Export/Import**: Backup and restore wallet functionality

## 🛠️ Technology Stack

- **Framework**: Next.js 16.0 (React 18)
- **Language**: TypeScript
- **Blockchain**: ethers.js v6
- **Styling**: Tailwind CSS
- **Cryptography**: 
  - BIP39 for mnemonic generation
  - crypto-js for encryption (PBKDF2 + AES)
- **Storage**: 
  - localStorage for encrypted wallet data
  - IndexedDB for transaction indexing
- **UI Components**: Lucide React icons
- **QR Codes**: qrcode.react

##  Installation

### Prerequisites

- Node.js 18+ and npm/yarn
- A modern web browser (Chrome, Firefox, Safari, Edge)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/vaultx.git
   cd vaultx
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   COINGECKO_API_KEY=your_coingecko_api_key_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
npm run build
npm start
```

## 🎯 Usage

### Creating a Wallet

1. Click "Create New Wallet" on the onboarding screen
2. Securely save your 12-word recovery phrase (download option available)
3. Set a strong password to encrypt your wallet
4. Your wallet is ready to use!

### Importing a Wallet

- **Recovery Phrase**: Enter your 12-word mnemonic phrase
- **Private Key**: Import using a private key directly

### Creating Custom Tokens

1. Click the "Create Custom Token" button on the dashboard
2. Fill in token details:
   - Token Name
   - Token Symbol
   - Initial Supply
3. Pay the creation fee (displayed in the modal)
4. Confirm the transaction
5. Your token is created and automatically added to your wallet!

### Managing Tokens

1. View all your tokens in the "My Tokens & Assets" panel
2. Click on any token to expand and see available actions:
   - **Send**: Transfer tokens to another address
   - **Transfer Ownership**: Change token owner (owner only)
   - **Distribute Royalty**: Batch send royalties to multiple recipients (owner only)

### Sending Assets

1. Click "Send" button on the dashboard
2. Enter recipient address
3. Enter amount
4. Review transaction details
5. Confirm and sign the transaction

##  Security Considerations

- **Never share your recovery phrase or private key** with anyone
- **Always verify recipient addresses** before sending transactions
- **Use strong, unique passwords** for wallet encryption
- **Keep your recovery phrase safe** - it's the only way to recover your wallet
- **This is a client-side wallet** - all operations happen in your browser
- **No server-side storage** - your keys never leave your device

##  Supported Networks

- Ethereum Mainnet
- Sepolia Testnet
- BNB Smart Chain (BSC)
- Polygon
- Arbitrum
- Avalanche
- Custom Networks (add your own RPC endpoints)

##  Responsive Design

VaultX is fully responsive and optimized for:
- Desktop (1920px+)
- Laptop (1024px - 1919px)
- Tablet (768px - 1023px)
- Mobile (320px - 767px)

##  UI/UX Features

- **Space-themed Design**: Beautiful gradient borders and neon accents
- **Smooth Animations**: Fluid transitions and hover effects
- **Dark Mode**: Eye-friendly dark theme optimized for extended use
- **Accessibility**: Keyboard navigation and screen reader support
- **Custom Fonts**: Inter, Space Grotesk, and JetBrains Mono for optimal readability

##  Smart Contract Integration

VaultX integrates with custom smart contracts:

- **TokenFactory Contract**: `0x16aC53c5c1Cf0de31b62db331090Fd8a39bBBECc`
  - Create new ERC-20 tokens
  - Track user-created tokens
  - Manage creation fees

- **CustomToken Contract**: Deployed per token
  - Standard ERC-20 functionality
  - Ownership management
  - Royalty distribution
  - Pause/Resume functionality

##  License

This project is licensed under the MIT License - see the LICENSE file for details.

##  Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

##  Disclaimer

VaultX is provided "as is" without warranty of any kind. Users are responsible for:
- Securing their recovery phrases and private keys
- Verifying all transaction details before confirming
- Understanding the risks associated with cryptocurrency transactions
- Complying with local laws and regulations

**Always test with small amounts first and never invest more than you can afford to lose.**


For issues, questions, or suggestions:
- Open an issue on GitHub
- Check the documentation
- Review the code comments
