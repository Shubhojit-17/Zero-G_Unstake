## Inspiration

The inspiration for **Zero-G Unstake** came from a common frustration in DeFi: users who stake tokens but later find themselves unable to unstake because they've run out of native gas tokens. This is especially painful for:

- **New users** who received tokens via airdrop but never had BNB
- **Long-term stakers** whose wallets were drained of gas tokens over time
- **Emergency situations** where users need immediate access to their funds but can't pay gas

We asked ourselves: *What if unstaking could be truly gasless?* With EIP-7702 support coming to BNB Smart Chain, we saw the perfect opportunity to solve this problem elegantly.

## What it does

Zero-G Unstake enables **gasless emergency unstaking** for users who have staked tokens but have zero native gas tokens (BNB) in their wallet.

**The Flow:**
1. User stakes tokens in the StakingVault (locked for 1 hour)
2. User runs out of BNB and cannot pay gas to unstake
3. User signs an off-chain EIP-7702 authorization (costs nothing!)
4. A relayer submits the rescue transaction, paying the gas
5. User receives their unstaked tokens minus a small 1% relayer fee

**Key Features:**
- ✅ Truly gasless for users - no BNB required
- ✅ One atomic transaction - unstake + fee payment
- ✅ MEV protection - prevents front-running attacks
- ✅ Fair fee model - relayer compensated from rescued tokens

## How we built it

**Smart Contracts (Solidity 0.8.24 + Foundry):**
- `StakingVault.sol` - Time-locked staking with 1-hour lock duration
- `UnstakeDelegate.sol` - EIP-7702 rescue logic executed on behalf of users
- `ZeroGToken.sol` - Test ERC20 token for demonstration

**Frontend (Next.js 14 + React):**
- Modern UI with TailwindCSS and glassmorphism design
- ConnectKit for wallet connection
- Real-time stake status and rescue functionality

**Backend Scripts (TypeScript + Viem):**
- EIP-7702 authorization signing
- MEV-protected transaction submission
- Auto-rescue bot for monitoring and processing rescues

**Deployed on BNB Smart Chain Testnet:**
- ZeroGToken: `0xACDca6c55F4CBA946763413854341b9E5556212A`
- StakingVault: `0x5085d1DD5FbDA9166094C3a3dc41dea7Df8fD9e7`
- UnstakeDelegate: `0x8ca2A267D31989FE05111cd46326AFA6971607AF`

## Challenges we ran into

**1. EIP-7702 Tooling Maturity**
EIP-7702 is brand new, and tooling support is still evolving. We had to use cutting-edge versions of Viem with experimental support, debug authorization list encoding issues, and handle gas estimation that differs significantly from regular transactions.

**2. Atomic Fee Extraction**
Ensuring the relayer gets paid from the same transaction that rescues the user was tricky. The unstake, user transfer, and relayer fee transfer must all happen in one atomic transaction, or the relayer risks paying gas without compensation.

**3. BSC Integration**
Configuring proper RPC endpoints, ensuring gas price compatibility with BSC's fee structure, and testing with tBNB required careful attention.

**4. Security Considerations**
Delegating an EOA to arbitrary code is powerful but dangerous. We implemented strict scope limiting, fee caps (1% max), and timelock verification.

## Accomplishments that we're proud of

- 🏆 **Working EIP-7702 implementation** on BSC Testnet - one of the first projects to leverage this new standard
- 🏆 **Truly gasless UX** - users with 0 BNB can still rescue their staked tokens
- 🏆 **Complete end-to-end solution** - smart contracts, frontend, and relayer infrastructure
- 🏆 **Fair economics** - sustainable fee model that incentivizes relayers while minimizing user costs
- 🏆 **MEV protection** - rescue transactions are protected from front-running attacks
- 🏆 **Clean, professional UI** - modern glassmorphism design with real-time feedback

## What we learned

1. **EIP-7702 Authorization Mechanics**: Unlike traditional meta-transactions, EIP-7702 allows an EOA to temporarily delegate to smart contract code. This opens up new possibilities for gasless transactions.

2. **MEV Protection Strategies**: Rescue transactions are particularly vulnerable to front-running, requiring specialized protection mechanisms.

3. **Fee Economics**: Finding the right balance where the relayer fee covers gas costs while keeping user returns attractive.

4. **BSC Ecosystem**: Deep understanding of BNB Smart Chain's infrastructure, gas mechanics, and tooling.

## What's next for Zero-G Unstake

- 🚀 **Multi-vault support**: Rescue from any staking protocol on BSC (PancakeSwap, Venus, etc.)
- 🚀 **BSC Mainnet deployment**: Launch production version with real economic incentives
- 🚀 **Decentralized relayer network**: Competing relayers for better fees and reliability
- 🚀 **Cross-chain rescue**: Bridge + unstake in one transaction across BNB ecosystem
- 🚀 **Mobile app**: Native iOS/Android app for on-the-go rescue operations
- 🚀 **Protocol integrations**: Partner with major BSC DeFi protocols for native support
