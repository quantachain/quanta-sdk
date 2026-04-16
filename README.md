# Quanta SDK

The official JavaScript/TypeScript developer toolkit for the Quanta Protocol ecosystem.

This SDK provides a robust abstraction layer over the Quanta Node REST API and the Post-Quantum (Falcon-512) WASM cryptography engine, enabling developers to build exchanges, wallets, and network analytics tools.

## Installation

```bash
npm install quanta-sdk
```

## Features

- **Post-Quantum Cryptography**: Fully integrates with `quanta-wasm` for Falcon-512 key generation and signature validation.
- **Node HTTP Client**: Provides a structured interface to interact with Quanta Nodes.
- **Transaction Builder**: Simplifies UTXO and state transitions for crafting unsigned payloads.
- **CLI Utility**: Includes a built-in CLI for wallet management and checking node health.

## Quickstart Guide

### 1. Connecting to the Node

```typescript
import { QuantaClient } from 'quanta-sdk';

const client = new QuantaClient('https://rpc.quantachain.org');

async function checkStatus() {
    const status = await client.getStatus();
    console.log(`Node Height: ${status.chain_height}`);
}
```

### 2. Generating a Wallet

```typescript
import { QuantaWallet, initQuanta } from 'quanta-sdk';

async function generate() {
    // Note: Always initialize the WASM module before using cryptographic functions.
    await initQuanta();

    const newWalletInfo = QuantaWallet.create();
    console.log('Address:', newWalletInfo.address);
    console.log('Secret Recovery Phrase:', newWalletInfo.mnemonic);
}
```

### 3. Signing and Sending a Transaction

Amounts in the Quanta Network are calculated in microunits (1 QUA = 1,000,000 microunits).

```typescript
import { QuantaClient, QuantaWallet, TransactionBuilder, initQuanta } from 'quanta-sdk';

async function sendFunds() {
    await initQuanta();

    const client = new QuantaClient('https://rpc.quantachain.org');
    const wallet = QuantaWallet.fromMnemonic("your twenty four word bip39 pass phrase goes here for testing...");
    
    // Fetch current nonce for the sender
    const addressInfo = await client.getAddressInfo(wallet.address);
    const nonce = addressInfo.nonce;

    const amountToSend = 5_000_000; // 5 QUA
    
    // Build unsigned transaction
    const unsignedTx = TransactionBuilder.createUnsigned(
        wallet.address,
        "0xRecipientAddressHere",
        amountToSend,
        nonce
    );

    // Sign transaction with Falcon-512
    const signedTx = TransactionBuilder.sign(unsignedTx, wallet);

    // Broadcast to the network
    const response = await client.submitTransaction(signedTx);
    console.log("Transaction Hash:", response.tx_hash);
}
```

## Command Line Interface (CLI)

The SDK ships with a built-in command-line utility for ecosystem management.

```bash
npx quanta-cli wallet generate
npx quanta-cli node status https://rpc.quantachain.org
```

## License

ISC License.
