# 🛠️ Tech Stack

> Complete technology stack for the **Zero-G Unstake** project — BSC EIP-7702 Hackathon 2025

---

## Overview

| Category | Technology | Purpose |
|----------|------------|---------|
| Smart Contracts | Solidity | Contract development |
| Development Framework | Foundry | Build, test, deploy |
| Client Library | Viem | EIP-7702 interactions |
| Network | BSC Testnet | Deployment target |
| Core Standard | EIP-7702 | Account abstraction |

---

## 📋 Detailed Stack

### 1. Solidity

| | |
|---|---|
| **What** | Smart contract programming language for EVM-compatible chains |
| **Why We're Using It** | Solidity is the industry-standard language for Ethereum and BSC smart contract development. It provides the security features and tooling ecosystem necessary for writing our `StakingVault` and `UnstakeDelegate` contracts. Version 0.8.x includes built-in overflow protection. |
| **Version** | `^0.8.24` (for EIP-7702 compatibility) |
| **Documentation** | [https://docs.soliditylang.org/](https://docs.soliditylang.org/) |

**Key Features We'll Use:**
- Custom errors for gas-efficient reverts
- Interfaces for vault interactions
- Low-level `call` for atomic token transfers

---

### 2. Foundry (Forge / Cast / Anvil)

| | |
|---|---|
| **What** | A blazing-fast, portable, and modular toolkit for Ethereum application development written in Rust |
| **Why We're Using It** | Foundry offers the fastest compile times and native support for advanced EVM features. `Forge` handles testing with Solidity-native tests, `Cast` enables CLI interactions with deployed contracts, and `Anvil` provides a local testnet. Critical for rapid hackathon iteration. |
| **Version** | Latest stable |
| **Documentation** | [https://book.getfoundry.sh/](https://book.getfoundry.sh/) |

**Components:**

| Tool | Purpose | Docs |
|------|---------|------|
| **Forge** | Build & test smart contracts | [Forge Book](https://book.getfoundry.sh/forge/) |
| **Cast** | CLI for contract interactions | [Cast Book](https://book.getfoundry.sh/cast/) |
| **Anvil** | Local EVM testnet | [Anvil Book](https://book.getfoundry.sh/anvil/) |
| **Chisel** | Solidity REPL | [Chisel Book](https://book.getfoundry.sh/chisel/) |

**Why Not Hardhat?**
- Foundry is 10-100x faster for compilation
- Native Solidity tests (no JavaScript context switching)
- Better fuzzing and invariant testing support
- Superior gas reporting

---

### 3. Viem

| | |
|---|---|
| **What** | A TypeScript interface for Ethereum, designed as a modern alternative to ethers.js and web3.js |
| **Why We're Using It** | Viem has **first-class support for EIP-7702** authorization signing and transaction construction. It's lightweight, tree-shakable, and provides type-safe APIs. The `signAuthorization` and `sendTransaction` with `authorizationList` are essential for our relayer implementation. |
| **Version** | `^2.x` (with EIP-7702 support) |
| **Documentation** | [https://viem.sh/](https://viem.sh/) |

**Key EIP-7702 Functions:**

```typescript
// Viem provides native support for:
import { 
  signAuthorization,     // Sign 7702 auth off-chain
  sendTransaction,       // Submit with authorizationList
  parseAuthorizationList // Decode existing auths
} from 'viem';
```

**Specific Docs:**
| Topic | Link |
|-------|------|
| EIP-7702 Overview | [https://viem.sh/experimental/eip7702](https://viem.sh/experimental/eip7702) |
| Authorization Signing | [https://viem.sh/experimental/eip7702/signAuthorization](https://viem.sh/experimental/eip7702/signAuthorization) |
| Sending 7702 Transactions | [https://viem.sh/experimental/eip7702/sendTransaction](https://viem.sh/experimental/eip7702/sendTransaction) |

**Why Not ethers.js?**
- Viem has built-in EIP-7702 support
- Better TypeScript inference
- Smaller bundle size
- More active development on cutting-edge EIPs

---

### 4. BSC Testnet (BNB Smart Chain Testnet)

| | |
|---|---|
| **What** | The official test network for BNB Smart Chain (formerly Binance Smart Chain) |
| **Why We're Using It** | This hackathon targets BSC. The testnet provides a risk-free environment to deploy and test our contracts with free test BNB. BSC has confirmed EIP-7702 support in their latest upgrades. |
| **Chain ID** | `97` |
| **Documentation** | [https://docs.bnbchain.org/bnb-smart-chain/](https://docs.bnbchain.org/bnb-smart-chain/) |

**Network Configuration:**

```javascript
// BSC Testnet Parameters
{
  chainId: 97,
  name: 'BSC Testnet',
  rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
  explorer: 'https://testnet.bscscan.com/',
  currency: 'tBNB'
}
```

**Useful Links:**
| Resource | Link |
|----------|------|
| BSC Documentation | [https://docs.bnbchain.org/](https://docs.bnbchain.org/) |
| Testnet Faucet | [https://testnet.bnbchain.org/faucet-smart](https://testnet.bnbchain.org/faucet-smart) |
| Testnet Explorer | [https://testnet.bscscan.com/](https://testnet.bscscan.com/) |
| RPC Endpoints | [https://docs.bnbchain.org/bnb-smart-chain/developers/rpc/](https://docs.bnbchain.org/bnb-smart-chain/developers/rpc/) |

---

### 5. EIP-7702 (Set EOA Account Code)

| | |
|---|---|
| **What** | An Ethereum Improvement Proposal that allows EOAs to temporarily delegate their execution logic to a smart contract |
| **Why We're Using It** | EIP-7702 is the **core innovation** enabling Zero-G Unstake. It allows a user's EOA to "borrow" the unstaking logic from our delegate contract, enabling atomic unstake + fee payment without requiring the user to hold native gas tokens beforehand. |
| **Status** | Included in Pectra upgrade (2024/2025) |
| **EIP Number** | `7702` |

**Official Resources:**
| Resource | Link |
|----------|------|
| EIP-7702 Specification | [https://eips.ethereum.org/EIPS/eip-7702](https://eips.ethereum.org/EIPS/eip-7702) |
| Ethereum Magicians Discussion | [https://ethereum-magicians.org/t/eip-7702-set-eoa-account-code/19923](https://ethereum-magicians.org/t/eip-7702-set-eoa-account-code/19923) |
| EIP GitHub | [https://github.com/ethereum/EIPs/blob/master/EIPS/eip-7702.md](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-7702.md) |

**How It Works (Summary):**

```
┌─────────────────────────────────────────────────────────────────┐
│                      EIP-7702 Flow                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User signs: authorization = { address, nonce, chainId }    │
│                                                                 │
│  2. Relayer submits tx with: authorizationList: [authorization]│
│                                                                 │
│  3. EVM sets user's EOA code to: delegate_address code         │
│                                                                 │
│  4. Transaction executes with delegated logic                  │
│                                                                 │
│  5. After tx, EOA code is cleared (temporary delegation)       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Concepts:**
- **Authorization Tuple:** `(chainId, address, nonce, v, r, s)`
- **Delegation Indicator:** `0xef0100 || address` set as EOA code
- **Temporary:** Code delegation lasts only for the transaction

---

## 🔧 Development Environment Setup

### Prerequisites Checklist

```bash
# 1. Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 2. Verify installation
forge --version
cast --version
anvil --version

# 3. Install Node.js (v18+)
# Download from: https://nodejs.org/

# 4. Verify Node.js
node --version  # Should be v18+
npm --version

# 5. Install project dependencies
npm install viem typescript ts-node @types/node
```

### Environment Variables

```bash
# .env file
BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545/
PRIVATE_KEY=your_relayer_private_key_here
BSCSCAN_API_KEY=your_bscscan_api_key_for_verification
```

---

## 📦 Package Versions

```json
{
  "dependencies": {
    "viem": "^2.21.0",
    "typescript": "^5.3.0",
    "ts-node": "^10.9.0"
  }
}
```

```toml
# foundry.toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.24"
evm_version = "cancun"

[rpc_endpoints]
bsc_testnet = "${BSC_TESTNET_RPC}"
```

---

## 📚 Additional Resources

### Tutorials & Guides

| Topic | Link |
|-------|------|
| Foundry Getting Started | [https://book.getfoundry.sh/getting-started/installation](https://book.getfoundry.sh/getting-started/installation) |
| Viem Getting Started | [https://viem.sh/docs/getting-started](https://viem.sh/docs/getting-started) |
| EIP-7702 Deep Dive | [https://www.eip7702.io/](https://www.eip7702.io/) |
| Account Abstraction Explained | [https://ethereum.org/en/roadmap/account-abstraction/](https://ethereum.org/en/roadmap/account-abstraction/) |

### Community & Support

| Platform | Link |
|----------|------|
| Foundry Telegram | [https://t.me/foundry_rs](https://t.me/foundry_rs) |
| Viem GitHub Discussions | [https://github.com/wevm/viem/discussions](https://github.com/wevm/viem/discussions) |
| BSC Discord | [https://discord.gg/bnbchain](https://discord.gg/bnbchain) |
| Ethereum Research | [https://ethresear.ch/](https://ethresear.ch/) |

---

<p align="center">
  <i>Stack curated for maximum hackathon velocity ⚡</i>
</p>
