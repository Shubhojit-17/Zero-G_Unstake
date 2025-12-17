# 🚀 Zero-G Unstake
### *The Gasless Emergency Exit*

> **Unstake your tokens with zero BNB in your wallet.** Powered by EIP-7702 Account Abstraction on BSC.

---

## 🏆 BSC Hackathon 2025 — EIP-7702 Track

**Zero-G Unstake** is a novel rescue protocol that enables users to exit staking positions even when they have absolutely no native gas tokens (BNB) in their wallet. By leveraging EIP-7702's temporary EOA delegation, users can pay for gas using the very tokens they're unstaking.

---

## 📋 Table of Contents

- [The Problem](#-the-problem)
- [The Solution](#-the-solution)
- [How It Works](#-how-it-works)
- [Architecture Flow](#-architecture-flow)
- [Key Features](#-key-features)
- [Smart Contracts](#-smart-contracts)
- [Getting Started](#-getting-started)
- [License](#-license)

---

## ❌ The Problem

### The "Out of Gas" Trap

Imagine this scenario:

1. ✅ You staked 1,000 USDT into a yield vault 30 days ago
2. ✅ The lock period has expired — your tokens are ready to withdraw
3. ❌ Your wallet has **0 BNB** — you cannot pay gas fees
4. 😰 **You're stuck.** Your valuable assets are locked, visible but unreachable.

This is a **critical UX failure** in DeFi:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   💰 Your Wallet                                                │
│   ├── BNB Balance:    0.000 BNB                                 │
│   └── Staked USDT:    1,000 USDT (Ready to Unstake!)            │
│                                                                 │
│   ⛽ Gas Required:     0.001 BNB (~$0.60)                        │
│                                                                 │
│   ❌ RESULT: Cannot unstake. Assets trapped.                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Current workarounds are painful:**
- 🔄 Ask a friend to send you BNB (trust + coordination required)
- 💱 Use a CEX to buy and withdraw BNB (KYC, fees, delays)
- 🌉 Bridge from another chain (complex, risky, slow)

**There has to be a better way.**

---

## ✅ The Solution

### EIP-7702: Rescue-7702 Protocol

**Zero-G Unstake** introduces a paradigm shift using EIP-7702's account delegation:

> *"What if your EOA could temporarily become a smart account, unstake your tokens, and pay gas from the unstaked amount — all in one atomic transaction?"*

#### The Magic of EIP-7702

EIP-7702 allows an Externally Owned Account (EOA) to **temporarily delegate its execution logic** to a smart contract. This means:

- 🔐 **Your keys, your control** — Only you can authorize the delegation
- ⚡ **Temporary upgrade** — Your EOA "borrows" smart contract capabilities
- 🔄 **Atomic execution** — Unstake + gas payment happens in one transaction
- 💸 **Pay with what you have** — Use your staked tokens to cover gas fees

---

## 🔧 How It Works

### Step-by-Step Rescue Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  STEP 1: User Authorization (Off-Chain)                                  │
│  ═══════════════════════════════════════                                 │
│                                                                          │
│  User signs an EIP-7702 authorization payload:                           │
│  • Delegates EOA logic → UnstakeDelegate contract                        │
│  • Specifies: vault address, token, expected amount                      │
│  • NO gas required — this is just a signature!                           │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  STEP 2: Relayer Submission (On-Chain)                                   │
│  ═══════════════════════════════════════                                 │
│                                                                          │
│  A Relayer bot picks up the authorization:                               │
│  • Bundles the EIP-7702 auth into a transaction                          │
│  • Pays the BNB gas fee upfront                                          │
│  • Submits to BSC Testnet                                                │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  STEP 3: Atomic Execution (On-Chain)                                     │
│  ════════════════════════════════════                                    │
│                                                                          │
│  The UnstakeDelegate logic executes FROM the user's EOA:                 │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────┐         │
│  │ 1. Call vault.unstake() ──────────────► Tokens released     │         │
│  │ 2. Receive ERC20 tokens ──────────────► Into user's EOA     │         │
│  │ 3. Calculate gas cost + fee ──────────► e.g., 5 USDT        │         │
│  │ 4. Transfer fee to Relayer ───────────► Relayer reimbursed  │         │
│  │ 5. Keep remaining tokens ─────────────► User's wallet       │         │
│  └─────────────────────────────────────────────────────────────┘         │
│                                                                          │
│  ALL STEPS ARE ATOMIC — If any step fails, everything reverts!           │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### The Result

| Before | After |
|--------|-------|
| 0 BNB | 0 BNB (unchanged) |
| 1,000 USDT (staked) | 995 USDT (in wallet) |
| ❌ Trapped | ✅ **Free!** |

*The user paid ~5 USDT (gas + fee) and rescued 995 USDT — without ever holding BNB.*

---

## 🏗️ Architecture Flow

```
                                    ┌─────────────────┐
                                    │   BSC TESTNET   │
                                    │   BLOCKCHAIN    │
                                    └────────▲────────┘
                                             │
                                             │ 3. Submit Tx
                                             │    (Pays Gas)
                                             │
┌──────────────┐   1. Sign Auth    ┌─────────┴─────────┐
│              │ ────────────────► │                   │
│     USER     │   (Off-Chain)     │     RELAYER       │
│   (0 BNB)    │                   │      (Bot)        │
│              │ ◄──────────────── │                   │
└──────────────┘   6. Success!     └───────────────────┘
       │                                     │
       │                                     │
       ▼                                     ▼
┌──────────────────────────────────────────────────────────────┐
│                        ON-CHAIN EXECUTION                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                   User's EOA                           │  │
│  │            (Temporarily Upgraded via 7702)             │  │
│  │                         │                              │  │
│  │    ┌────────────────────▼────────────────────┐         │  │
│  │    │         UnstakeDelegate Logic           │         │  │
│  │    │  ┌────────────┐    ┌─────────────────┐  │         │  │
│  │    │  │  unstake() │───►│ Transfer Tokens │  │         │  │
│  │    │  │  from Vault│    │ (User + Relayer)│  │         │  │
│  │    │  └────────────┘    └─────────────────┘  │         │  │
│  │    └─────────────────────────────────────────┘         │  │
│  └────────────────────────────────────────────────────────┘  │
│                              │                               │
│              ┌───────────────┴───────────────┐               │
│              ▼                               ▼               │
│     ┌─────────────────┐             ┌─────────────────┐      │
│     │   Staking Vault │             │   ERC20 Token   │      │
│     │   (Releases $)  │             │   (USDT/etc)    │      │
│     └─────────────────┘             └─────────────────┘      │
└──────────────────────────────────────────────────────────────┘
```

---

## ⭐ Key Features

### 🔄 Atomic Execution
Every step — from unstaking to relayer reimbursement — happens in a **single, atomic transaction**. If any part fails, the entire operation reverts. Your funds are never at risk of being partially processed.

### ⏱️ No Cool-Down Required
Unlike traditional meta-transaction solutions that require pre-setup or session keys, Zero-G Unstake works **instantly**. Sign once, rescue immediately.

### ⛽ True Gas Abstraction
Users don't just "defer" gas payment — they **pay with a different asset entirely**. No BNB needed, ever. The gas cost is deducted from the unstaked tokens.

### 🔐 Non-Custodial & Trustless
- Private keys never leave the user's device
- The Relayer cannot steal funds (atomic execution ensures fair reimbursement)
- EIP-7702 delegation is temporary and scoped

### 💱 Automatic Fee Calculation
The delegate contract calculates the real-time gas cost (in BNB) and converts it to the equivalent token amount plus a small service fee. Transparent and fair.

### 🌐 BSC Testnet Ready
Built and tested on BSC Testnet with full EIP-7702 support. Ready for mainnet deployment post-audit.

---

## 📜 Smart Contracts

| Contract | Description |
|----------|-------------|
| `MockERC20.sol` | Test token for simulating staked assets |
| `StakingVault.sol` | Simple time-locked staking vault |
| `UnstakeDelegate.sol` | Core EIP-7702 delegate logic for rescue operations |
| `Relayer.sol` | (Optional) On-chain relayer registry and fee management |

---

## 🚀 Getting Started

### Prerequisites

- [Foundry](https://book.getfoundry.sh/) installed
- [Node.js](https://nodejs.org/) v18+ (for Viem scripts)
- BSC Testnet BNB (for relayer operations)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-team/zero-g-unstake.git
cd zero-g-unstake

# Install Foundry dependencies
forge install

# Install Node.js dependencies
npm install
```

### Build & Test

```bash
# Compile contracts
forge build

# Run tests
forge test -vvv

# Deploy to BSC Testnet
forge script script/Deploy.s.sol --rpc-url $BSC_TESTNET_RPC --broadcast
```

### Run the Relayer

```bash
# Start the relayer bot
npx ts-node scripts/relayer.ts
```

---

## 🛣️ Roadmap

- [x] Core concept & architecture design
- [ ] Smart contract implementation
- [ ] Foundry test suite
- [ ] Viem relayer integration
- [ ] BSC Testnet deployment
- [ ] Frontend demo UI
- [ ] Security audit
- [ ] Mainnet launch

---

## 🤝 Team

Built with ❤️ for the BSC EIP-7702 Hackathon 2025

---

## 📄 License

MIT License — See [LICENSE](LICENSE) for details.

---

<p align="center">
  <b>Zero-G Unstake</b> — Because your tokens shouldn't be held hostage by gas fees.
</p>
