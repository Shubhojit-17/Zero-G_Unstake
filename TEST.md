# Zero-G Unstake - Testing Guide

Complete step-by-step guide to set up, deploy, and test the Zero-G Unstake project on BNB Smart Chain Testnet.

---

## Table of Contents

1. [Prerequisites](#step-0-prerequisites)
2. [Environment Setup](#step-1-environment-setup)
3. [Install Dependencies](#step-2-install-dependencies)
4. [Configure Environment Variables](#step-3-configure-environment-variables)
5. [Deploy Smart Contracts](#step-4-deploy-smart-contracts)
6. [Verify Deployment](#step-5-verify-deployment)
7. [Setup Test User](#step-6-setup-test-user)
8. [Run the Frontend](#step-7-run-the-frontend)
9. [Test the Complete Flow](#step-8-test-the-complete-flow)
10. [Run Automated Demo](#step-9-run-automated-demo)
11. [Run Unit Tests](#step-10-run-unit-tests)

---

## Step 0: Prerequisites

Ensure you have the following installed on your system:

### Required Software

| Software | Version | Installation |
|----------|---------|--------------|
| Node.js | v18+ | https://nodejs.org/ |
| Git | Latest | https://git-scm.com/ |
| Foundry | Latest | See below |

### Install Foundry

```bash
# Windows (PowerShell)
irm https://foundry.paradigm.xyz | iex

# Linux/macOS
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Get Test BNB

1. Go to [BNB Smart Chain Faucet](https://testnet.bnbchain.org/faucet-smart)
2. Connect your wallet
3. Request tBNB for your deployer, relayer, and user wallets

---

## Step 1: Environment Setup

### Clone the Repository

```bash
git clone https://github.com/Shubhojit-17/Zero-G_Unstake.git
cd Zero-G_Unstake
```

### Project Structure

```
Zero-G_Unstake/
├── src/                    # Smart contracts
│   ├── StakingVault.sol
│   ├── UnstakeDelegate.sol
│   └── ZeroGToken.sol
├── script/                 # Deployment scripts
│   ├── Deploy.s.sol
│   └── SetupTestUser.s.sol
├── scripts/                # TypeScript scripts
│   ├── demo.ts
│   ├── checkStatus.ts
│   └── relayer.ts
├── frontend/               # Next.js frontend
├── test/                   # Foundry tests
└── lib/                    # Dependencies
```

---

## Step 2: Install Dependencies

### Install Root Dependencies

```bash
npm install
```

### Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

### Install Foundry Dependencies

```bash
forge install
```

---

## Step 3: Configure Environment Variables

### Create .env File

Copy the example environment file:

```bash
cp .env.example .env
```

### Edit .env File

```env
# BSC Testnet RPC URL
BSC_TESTNET_RPC=https://bsc-testnet-rpc.publicnode.com

# Private Keys (Use test wallets only - NEVER use real funds!)
# Deployer: Account that deploys contracts
DEPLOYER_PRIVATE_KEY=0x_your_deployer_private_key

# Relayer: Account that submits rescue transactions and pays gas
RELAYER_PRIVATE_KEY=0x_your_relayer_private_key

# User: Account that stakes tokens and needs rescue (for testing)
USER_PRIVATE_KEY=0x_your_user_private_key

# BscScan API Key for contract verification (optional)
BSCSCAN_API_KEY=your_bscscan_api_key

# Configuration
RELAYER_FEE_BPS=100
```

### Configure Frontend .env

```bash
cd frontend
cp .env.example .env.local
```

Edit `frontend/.env.local`:

```env
NEXT_PUBLIC_ZERO_G_TOKEN_ADDRESS=0xACDca6c55F4CBA946763413854341b9E5556212A
NEXT_PUBLIC_STAKING_VAULT_ADDRESS=0x5085d1DD5FbDA9166094C3a3dc41dea7Df8fD9e7
NEXT_PUBLIC_UNSTAKE_DELEGATE_ADDRESS=0x8ca2A267D31989FE05111cd46326AFA6971607AF
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
RELAYER_PRIVATE_KEY=0x_your_relayer_private_key
```

---

## Step 4: Deploy Smart Contracts

### Compile Contracts

```bash
forge build
```

### Deploy to BSC Testnet

```bash
forge script script/Deploy.s.sol:Deploy --rpc-url $BSC_TESTNET_RPC --broadcast
```

### Expected Output

```
== Logs ==
  Deploying Zero-G Unstake contracts...
  Deployer: 0x...
  ZeroGToken deployed at: 0x...
  StakingVault deployed at: 0x...
  UnstakeDelegate deployed at: 0x...
  Deployment complete!
```

### Update .env with Deployed Addresses

After deployment, update your `.env` file with the new contract addresses:

```env
ZERO_G_TOKEN_ADDRESS=0x_deployed_token_address
STAKING_VAULT_ADDRESS=0x_deployed_vault_address
UNSTAKE_DELEGATE_ADDRESS=0x_deployed_delegate_address
```

---

## Step 5: Verify Deployment

### Check Contract Status

```bash
npx ts-node scripts/checkStatus.ts
```

### Expected Output

```
╔═══════════════════════════════════════════╗
║     Zero-G Unstake - Status Checker       ║
╚═══════════════════════════════════════════╝

📝 Contract Addresses:
   ZeroGToken: 0xACDca6c55F4CBA946763413854341b9E5556212A
   StakingVault: 0x5085d1DD5FbDA9166094C3a3dc41dea7Df8fD9e7
   UnstakeDelegate: 0x8ca2A267D31989FE05111cd46326AFA6971607AF

⚙️  Vault Configuration:
   Staking Token: 0xACDca6c55F4CBA946763413854341b9E5556212A
   Lock Duration: 3600 seconds
   Relayer Fee: 100 bps (1%)

👤 Account Balances:
   Deployer: 0x...
      BNB: 0.01 tBNB
      ZGT: 999000 ZGT
```

### Verify on BscScan (Optional)

```bash
forge verify-contract <CONTRACT_ADDRESS> src/StakingVault.sol:StakingVault \
  --chain-id 97 \
  --etherscan-api-key $BSCSCAN_API_KEY
```

---

## Step 6: Setup Test User

### Transfer Tokens to Test User

```bash
forge script script/SetupTestUser.s.sol:SetupTestUser --rpc-url $BSC_TESTNET_RPC --broadcast
```

This script will:
1. Transfer 1000 ZGT to the test user
2. Approve the StakingVault to spend user's tokens
3. Stake tokens on behalf of the user

---

## Step 7: Run the Frontend

### Start Development Server

```bash
cd frontend
npm run dev
```

### Access the Application

Open your browser and navigate to:

```
http://localhost:3000
```

### Frontend Features

1. **Connect Wallet**: Click "Connect Wallet" and select your wallet
2. **View Stake Info**: See your current staked amount and unlock time
3. **Stake Tokens**: Enter amount and click "Stake"
4. **Request Rescue**: Sign EIP-7702 authorization for gasless unstake
5. **View Transaction Log**: Track all transactions in real-time

---

## Step 8: Test the Complete Flow

### Manual Testing Steps

#### 8.1 Stake Tokens

1. Connect wallet with ZGT tokens
2. Approve the StakingVault to spend your tokens
3. Enter stake amount and click "Stake"
4. Wait for transaction confirmation
5. Verify stake appears in "Your Stake" section

#### 8.2 Wait for Lock Period

The default lock duration is **3600 seconds (1 hour)**.

Check remaining time:
```bash
npx ts-node scripts/checkStatus.ts
```

#### 8.3 Request Rescue (Gasless Unstake)

1. Ensure the lock period has expired
2. Click "Request Rescue" button
3. Sign the EIP-7702 authorization in your wallet (no gas required!)
4. Wait for relayer to process the rescue
5. Verify tokens received (minus 1% relayer fee)

---

## Step 9: Run Automated Demo

### Full End-to-End Demo

This script runs the complete flow automatically:

```bash
npx ts-node scripts/demo.ts
```

### Demo Phases

1. **Phase 1**: Initial state check
2. **Phase 2**: User stakes tokens
3. **Phase 3**: Wait for lock period to expire
4. **Phase 4**: Simulate user with 0 BNB
5. **Phase 5**: User signs EIP-7702 authorization
6. **Phase 6**: Relayer executes rescue with MEV protection
7. **Phase 7**: Verify final state

### Expected Demo Output

```
╔═══════════════════════════════════════════════════════════════╗
║          Zero-G Unstake - Full Demo                           ║
║          Gasless Emergency Exit on BSC Testnet                ║
╚═══════════════════════════════════════════════════════════════╝

📋 Configuration:
   Token: 0xACDca6c55F4CBA946763413854341b9E5556212A
   Vault: 0x5085d1DD5FbDA9166094C3a3dc41dea7Df8fD9e7
   Delegate: 0x8ca2A267D31989FE05111cd46326AFA6971607AF

...

═══════════════════════════════════════════════════════════════
🎉 PHASE 7: Final State - SUCCESS!
═══════════════════════════════════════════════════════════════

   📊 User Final State:
      BNB: 0.004824338 tBNB (unchanged!)
      ZGT: 975.15 ZGT
      Staked: 0 ZGT

   📊 Relayer Final State:
      ZGT: 24.85 ZGT
      Fee Earned: 9.85 ZGT

═══════════════════════════════════════════════════════════════
✅ Demo Complete! Zero-G Unstake Works!
═══════════════════════════════════════════════════════════════

   View on BscScan: https://testnet.bscscan.com/tx/0x...
```

---

## Step 10: Run Unit Tests

### Run Foundry Tests

```bash
forge test
```

### Run Specific Test

```bash
forge test --match-test testStake -vvv
```

### Run with Gas Report

```bash
forge test --gas-report
```

### Expected Test Output

```
Running 10 tests for test/ZeroGUnstake.t.sol:ZeroGUnstakeTest
[PASS] testCanUnstakeAfterLock() (gas: 123456)
[PASS] testCannotUnstakeBeforeLock() (gas: 65432)
[PASS] testRescueExecution() (gas: 234567)
[PASS] testRelayerFeeCalculation() (gas: 45678)
[PASS] testStake() (gas: 87654)
...
```

---

## Troubleshooting

### Common Issues

#### 1. "Insufficient funds for gas"
- Ensure your deployer/relayer wallet has enough tBNB
- Get test BNB from the [faucet](https://testnet.bnbchain.org/faucet-smart)

#### 2. "Transaction reverted: StillLocked"
- Wait for the lock period to expire (1 hour)
- Check time remaining with `npx ts-node scripts/checkStatus.ts`

#### 3. "EIP-7702 authorization failed"
- Ensure you're using a compatible wallet (MetaMask latest)
- Check that Viem version supports EIP-7702

#### 4. "Contract not verified"
- Ensure BSCSCAN_API_KEY is set correctly
- Wait a few minutes and retry verification

### Get Help

- Check logs in terminal for detailed error messages
- Review transaction on [BscScan Testnet](https://testnet.bscscan.com/)
- Open an issue on [GitHub](https://github.com/Shubhojit-17/Zero-G_Unstake/issues)

---

## Deployed Contract Addresses (BSC Testnet)

| Contract | Address |
|----------|---------|
| ZeroGToken | `0xACDca6c55F4CBA946763413854341b9E5556212A` |
| StakingVault | `0x5085d1DD5FbDA9166094C3a3dc41dea7Df8fD9e7` |
| UnstakeDelegate | `0x8ca2A267D31989FE05111cd46326AFA6971607AF` |

---

## Test Transaction Reference

| Field | Value |
|-------|-------|
| Chain | BNB Smart Chain Testnet (Chain ID: 97) |
| Lock Duration | 3600 seconds (1 hour) |
| Relayer Fee | 1% (100 bps) |
| Rescue Tx Hash | `0x1ed14c9046affea06a231e9fb0509b86ac09bebffda50efdf29429dfa1135648` |
| Block Number | 79747531 |
| Unstake Timestamp | 2025-12-21T06:17:36.000Z |

**View Transaction:** https://testnet.bscscan.com/tx/0x1ed14c9046affea06a231e9fb0509b86ac09bebffda50efdf29429dfa1135648
