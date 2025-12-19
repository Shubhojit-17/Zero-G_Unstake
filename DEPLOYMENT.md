# Zero-G Unstake - Deployment Guide

Complete step-by-step guide to deploy the Zero-G Unstake project on BSC Testnet.

---

## 📋 Prerequisites

Before starting, ensure you have:

1. **Foundry installed**
   ```bash
   # Windows (PowerShell)
   curl -L https://foundry.paradigm.xyz | bash
   # Then restart terminal and run:
   foundryup
   ```

2. **Node.js v18+**
   - Download from: https://nodejs.org/

3. **Three BSC Testnet wallets with private keys:**
   - **Deployer**: For deploying contracts
   - **Relayer**: For submitting rescue transactions (needs tBNB)
   - **User**: For testing (simulate "stuck" user)

4. **Test BNB (tBNB)** for Deployer and Relayer wallets
   - Faucet: https://testnet.bnbchain.org/faucet-smart

---

## 🚀 Deployment Steps

### Step 1: Clone and Setup

```bash
# Navigate to project directory
cd "Zero-G Unstake"

# Install Foundry dependencies
forge install foundry-rs/forge-std

# Install Node.js dependencies
npm install
```

### Step 2: Configure Environment

```bash
# Copy the example environment file
copy .env.example .env
```

Edit `.env` with your values:

```env
# BSC Testnet RPC
BSC_TESTNET_RPC=https://bsc-testnet-rpc.publicnode.com

# Private Keys (with 0x prefix)
DEPLOYER_PRIVATE_KEY=0x...your_deployer_private_key...
RELAYER_PRIVATE_KEY=0x...your_relayer_private_key...
USER_PRIVATE_KEY=0x...your_user_private_key...

# BSCScan API Key (for contract verification)
BSCSCAN_API_KEY=your_api_key_here
```

### Step 3: Build Contracts

```bash
# Compile all Solidity contracts
forge build
```

Expected output:
```
[⠆] Compiling...
[⠔] Compiling 8 files with 0.8.24
[⠒] Solc 0.8.24 finished in 2.15s
Compiler run successful!
```

### Step 4: Run Tests

```bash
# Run the test suite
forge test -vvv
```

All tests should pass. If tests fail, check your Foundry version with `forge --version`.

### Step 5: Deploy to BSC Testnet

```bash
# Load environment variables (PowerShell)
$env:DEPLOYER_PRIVATE_KEY = "your_key_here"
$env:BSC_TESTNET_RPC = "https://bsc-testnet-rpc.publicnode.com"

# Deploy contracts
forge script script/Deploy.s.sol --rpc-url $env:BSC_TESTNET_RPC --broadcast
```

**Alternative (using .env file with dotenv):**
```bash
# Using source (Git Bash or WSL)
source .env
forge script script/Deploy.s.sol --rpc-url $BSC_TESTNET_RPC --broadcast
```

Expected output:
```
=== Zero-G Unstake Deployment ===
Deployer: 0x...
Chain ID: 97
ZeroGToken deployed at: 0x...
StakingVault deployed at: 0x...
UnstakeDelegate deployed at: 0x...

=== Add these to your .env file ===
ZERO_G_TOKEN_ADDRESS= 0x...
STAKING_VAULT_ADDRESS= 0x...
UNSTAKE_DELEGATE_ADDRESS= 0x...
```

### Step 6: Update .env with Contract Addresses

Copy the deployed addresses to your `.env` file:

```env
ZERO_G_TOKEN_ADDRESS=0x... (from deployment output)
STAKING_VAULT_ADDRESS=0x... (from deployment output)
UNSTAKE_DELEGATE_ADDRESS=0x... (from deployment output)
```

### Step 7: Verify Contracts (Optional but Recommended)

```bash
# Verify ZeroGToken
forge verify-contract <ZERO_G_TOKEN_ADDRESS> src/ZeroGToken.sol:ZeroGToken \
  --chain-id 97 \
  --constructor-args $(cast abi-encode "constructor(uint256,address)" 1000000000000000000000000 <DEPLOYER_ADDRESS>) \
  --etherscan-api-key $BSCSCAN_API_KEY

# Verify StakingVault
forge verify-contract <STAKING_VAULT_ADDRESS> src/StakingVault.sol:StakingVault \
  --chain-id 97 \
  --constructor-args $(cast abi-encode "constructor(address,uint256)" <ZERO_G_TOKEN_ADDRESS> 60) \
  --etherscan-api-key $BSCSCAN_API_KEY

# Verify UnstakeDelegate
forge verify-contract <UNSTAKE_DELEGATE_ADDRESS> src/UnstakeDelegate.sol:UnstakeDelegate \
  --chain-id 97 \
  --etherscan-api-key $BSCSCAN_API_KEY
```

### Step 8: Check Deployment Status

```bash
# Using TypeScript status checker
npm run status
```

Or using Foundry:
```bash
forge script script/CheckStatus.s.sol --rpc-url $BSC_TESTNET_RPC
```

---

## 🎮 Running the Demo

### Option A: Full Automated Demo

```bash
npm run demo
```

This will:
1. Transfer tokens to the user
2. Stake tokens in the vault
3. Wait for lock period to expire
4. Execute the EIP-7702 rescue

### Option B: Manual Step-by-Step

**1. Setup Test User (stake tokens):**
```bash
forge script script/SetupTestUser.s.sol --rpc-url $BSC_TESTNET_RPC --broadcast
```

**2. Wait for lock period (3600 seconds / 1 hour)**

**3. Check status:**
```bash
npm run status
```

**4. User signs authorization:**
```bash
npm run sign
```

**5. Relayer processes request:**
```bash
npm run relayer -- --request ./rescue-request-<timestamp>.json
```

---

## 🔧 Troubleshooting

### "Insufficient funds for gas"
- Ensure Deployer and Relayer wallets have tBNB
- Get from faucet: https://testnet.bnbchain.org/faucet-smart

### "Contract not found"
- Ensure you've updated `.env` with deployed contract addresses
- Run `npm run status` to verify configuration

### "Transaction reverted"
- Check if user has stake: `npm run status`
- Check if lock period has expired
- Ensure contracts are properly deployed

### "EIP-7702 not supported"
- BSC Testnet must support EIP-7702 (Pectra upgrade)
- Check BSC documentation for latest network updates

---

## 📁 Project Structure After Deployment

```
Zero-G Unstake/
├── .env                      # Your configuration (DO NOT COMMIT!)
├── foundry.toml              # Foundry configuration
├── package.json              # Node.js dependencies
├── src/
│   ├── interfaces/           # Solidity interfaces
│   ├── ZeroGToken.sol        # ERC20 test token
│   ├── StakingVault.sol      # Time-locked staking
│   └── UnstakeDelegate.sol   # EIP-7702 delegate
├── script/
│   ├── Deploy.s.sol          # Main deployment
│   ├── SetupTestUser.s.sol   # User setup helper
│   └── CheckStatus.s.sol     # Status checker
├── test/
│   └── ZeroGUnstake.t.sol    # Test suite
├── scripts/                  # TypeScript/Viem
│   ├── relayer.ts            # Relayer service
│   ├── userSign.ts           # User signing
│   ├── checkStatus.ts        # Status checker
│   └── demo.ts               # Full demo
├── broadcast/                # Deployment artifacts
│   └── Deploy.s.sol/
│       └── 97/               # BSC Testnet deployments
└── out/                      # Compiled contracts
```

---

## 🔒 Security Reminders

1. **NEVER commit `.env` file** - It contains private keys
2. **Use separate wallets** for testnet and mainnet
3. **Audit contracts** before mainnet deployment
4. **Test thoroughly** on testnet first

---

## 📞 Support

- BSC Docs: https://docs.bnbchain.org/
- Foundry Book: https://book.getfoundry.sh/
- Viem Docs: https://viem.sh/
- EIP-7702 Spec: https://eips.ethereum.org/EIPS/eip-7702
