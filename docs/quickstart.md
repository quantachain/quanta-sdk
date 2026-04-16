# Quanta SDK Quickstart

Welcome to the Quanta JS/TS Ecosystem! This SDK provides all the necessary functionality to interact with the Quanta node, generate Post-Quantum secured Falcon-512 wallets, and sign transactions.

## Installation

```bash
npm install quanta-sdk
```

## 1. Using the Quanta API Client

The `QuantaClient` abstracts away the boilerplate of making HTTP requests to a Quanta node.

```typescript
import { QuantaClient } from 'quanta-sdk';

const client = new QuantaClient('http://127.0.0.1:8000'); // Connect to local node
// Or connect to a public RPC
// const client = new QuantaClient('https://rpc.quantachain.io');

async function checkStatus() {
    const status = await client.getStatus();
    console.log(`Node Height: ${status.chain_height}`);
}

checkStatus();
```

## 2. Generating a Wallet

```typescript
import { QuantaWallet } from 'quanta-sdk';

// Generate a random new wallet
const newWalletInfo = QuantaWallet.create();
console.log('My Address:', newWalletInfo.address);
console.log('Secret Recovery Phrase:', newWalletInfo.mnemonic);

// Later, restore from the mnemonic
const wallet = QuantaWallet.fromMnemonic(newWalletInfo.mnemonic);
```

## 3. Sending a Transaction

The `TransactionBuilder` helps construct the correct payload format, leaving the cryptographic signing to the `QuantaWallet`.

```typescript
import { QuantaClient, QuantaWallet, TransactionBuilder } from 'quanta-sdk';

async function sendFunds() {
    const client = new QuantaClient('http://127.0.0.1:8000');
    const wallet = QuantaWallet.fromMnemonic("your 24 word secret recovery phrase goes here...");
    
    // 1. Fetch current nonce for the sender
    const addressInfo = await client.getAddressInfo(wallet.address);
    const nonce = addressInfo.nonce;

    // 2. Build the unsigned transaction (amounts are in microunits! 1 QUA = 1,000,000 microunits)
    const amountToSend = 5_000_000; // 5 QUA
    const unsignedTx = TransactionBuilder.createUnsigned(
        wallet.address,           // sender
        "0xRecipientAddress...",  // recipient
        amountToSend,
        nonce
    );

    // 3. Sign it with the Post-Quantum wallet
    const signedTx = TransactionBuilder.sign(unsignedTx, wallet);

    // 4. Broadcast to the network
    try {
        const response = await client.submitTransaction(signedTx);
        console.log("Success! Transaction Hash:", response.tx_hash);
    } catch (e) {
        console.error("Failed to send transaction:", e);
    }
}
```

## Using the CLI

The SDK also ships with a command-line utility.

```bash
npx quanta-cli wallet generate
npx quanta-cli node status http://127.0.0.1:8000
```
