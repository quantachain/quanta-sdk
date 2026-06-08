# Quanta SDK

The official JavaScript/TypeScript developer toolkit for the Quanta Protocol.

[![npm](https://img.shields.io/npm/v/quanta-sdk)](https://www.npmjs.com/package/quanta-sdk)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

The SDK provides a complete abstraction over the Quanta Node REST API and integrates the [`quanta-wasm`](https://www.npmjs.com/package/quanta-wasm) Falcon-512 post-quantum cryptography engine. Use it to build wallets, explorers, exchanges, and any integration with the Quanta Protocol.

---

## Installation

```bash
npm install quanta-sdk
```

---

## Quick Start

```typescript
import { QuantaClient, QuantaWallet, TransactionBuilder, initQuanta } from 'quanta-sdk';

// 1. Initialize the WASM crypto engine (once at startup)
await initQuanta();

// 2. Create or restore a wallet
const wallet = QuantaWallet.create();
console.log('Address:', wallet.address);
console.log('Mnemonic:', wallet.mnemonic);  // store offline

// 3. Connect to a node
const client = new QuantaClient('https://rpc.quantachain.org');

// 4. Check balance (amounts are in microunits: 1 QUA = 1,000,000)
const balance = await client.getBalance(wallet.address);
console.log(`Balance: ${balance / 1_000_000} QUA`);

// 5. Send a transaction
const nonce = await client.getNonce(wallet.address);
const unsignedTx = TransactionBuilder.createUnsigned(
  wallet.address, '0xRECIPIENT', 5_000_000, nonce + 1  // 5 QUA
);
const signedTx = TransactionBuilder.sign(unsignedTx, wallet);
const { tx_hash } = await client.submitTransaction(signedTx);
console.log('Sent:', tx_hash);
```

---

## Features

- **Post-Quantum Cryptography** — Falcon-512 key generation and transaction signing via `quanta-wasm`
- **Node Client** — typed interface to the Quanta REST API (blocks, accounts, mempool, transactions)
- **Transaction Builder** — builds and signs Transfer, TimeLockTransfer, and MultiSigTransfer transactions
- **Wallet Management** — create, restore from mnemonic, and derive addresses
- **CLI Utility** — `npx quanta-cli` for wallet generation and node inspection
- **TypeScript** — full type definitions included

---

## API Reference

### `initQuanta()`

Initializes the WASM cryptography module. Must be called once before any wallet or signing operation.

```typescript
await initQuanta();
```

---

### `QuantaClient`

HTTP client for the Quanta REST API.

```typescript
const client = new QuantaClient(nodeUrl: string);
```

| Method | Returns | Description |
|--------|---------|-------------|
| `client.getHealth()` | `NodeHealth` | Node status, height, peer count |
| `client.getLatestBlock()` | `Block` | Latest confirmed block |
| `client.getBlock(height)` | `Block` | Block by height |
| `client.getTransaction(hash)` | `Transaction` | Transaction by hash |
| `client.getBalance(address)` | `number` | Balance in microunits |
| `client.getNonce(address)` | `number` | Current account nonce |
| `client.getMempool()` | `MempoolInfo` | Pending transactions |
| `client.submitTransaction(tx)` | `{ tx_hash }` | Broadcast signed transaction |
| `client.getNetworkStats()` | `NetworkStats` | Height, TPS, peer count |

---

### `QuantaWallet`

Wallet creation and restoration.

```typescript
// Create new wallet with fresh Falcon-512 keypair
const wallet = QuantaWallet.create();
// wallet.address  — "0x..." 
// wallet.mnemonic — 24-word BIP39 phrase

// Restore from mnemonic
const wallet = QuantaWallet.fromMnemonic("word1 word2 ... word24");
```

---

### `TransactionBuilder`

Builds and signs transactions.

```typescript
// Standard transfer
const tx = TransactionBuilder.createUnsigned(
  sender,     // "0x..." address
  recipient,  // "0x..." address
  amount,     // microunits
  nonce,      // current nonce + 1
  txType?     // optional: TimeLockTransfer | MultiSigTransfer
);

const signedTx = TransactionBuilder.sign(tx, wallet);
```

#### TimeLock Transfer

```typescript
const tx = TransactionBuilder.createUnsigned(
  sender, recipient, amount, nonce,
  { type: 'TimeLockTransfer', unlock_height: 20000 }
);
```

#### MultiSig Transfer

```typescript
const tx = TransactionBuilder.createUnsigned(
  sender, recipient, amount, nonce,
  { type: 'MultiSigTransfer', signers_required: 3 }
);
```

---

### `BrowserProvider`

Enables Web3 dApp integrations by communicating with the Quanta Wallet browser extension.

```typescript
import { BrowserProvider } from 'quanta-sdk';

// Check if the wallet extension is installed
if (window.quanta) {
  const provider = new BrowserProvider(window.quanta);
  
  // Request wallet connection
  await provider.connect();
  console.log('Connected Address:', provider.address);
  
  // Sign a message (returns signature and public key)
  const { signatureHex, publicKeyHex } = await provider.signMessage('Hello Quanta!');
}
```

---

## CLI

```bash
# Generate a new wallet
npx quanta-cli wallet generate

# Check node status
npx quanta-cli node status https://rpc.quantachain.org

# Check balance
npx quanta-cli balance 0xYOUR_ADDRESS
```

---

## Units

All amounts in the API and SDK are in **microunits**:

| QUA | Microunits |
|-----|-----------|
| 1 QUA | 1,000,000 |
| 5 QUA | 5,000,000 |
| Min fee | 100 (0.0001 QUA) |

---

## Architecture

```
quanta-sdk
├── QuantaClient      — REST API wrapper
├── QuantaWallet      — Falcon-512 keypair, address derivation, mnemonic
├── TransactionBuilder — Canonical tx construction + signing contract
└── quanta-wasm       — Rust/WASM Falcon-512 crypto engine (bundled)
```

`quanta-sdk` bundles and manages `quanta-wasm` internally. You do not need to install `quanta-wasm` separately unless you need the raw WASM API.

---

## Public Testnet Endpoint

```
https://rpc.quantachain.org
```

For high-volume integrations, run your own node. See the [node documentation](https://quantachain.gitbook.io/quantachain-docs/node-operator-guide).

---

## License

ISC License
