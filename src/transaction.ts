import { QuantaWallet } from './wallet.js';
import * as wasm from 'quanta-wasm';

export interface UnsignedTransaction {
    sender: string;
    recipient: string;
    amount: number;
    fee: number;
    nonce: number;
    timestamp: number;
}

export interface SignedTransaction extends UnsignedTransaction {
    signature: string;
    public_key: string;
}

export class TransactionBuilder {
    /**
     * Standard transaction fee (e.g. 1 QUA = 1_000_000 microunits)
     * Using typical 0.01 QUA (10000 microunits) for now
     */
    static readonly DEFAULT_FEE = 10000;

    /**
     * Build an unsigned transaction object
     */
    static createUnsigned(
        sender: string,
        recipient: string,
        amountMicroUnits: number,
        nonce: number,
        feeMicroUnits: number = TransactionBuilder.DEFAULT_FEE
    ): UnsignedTransaction {
        return {
            sender,
            recipient,
            amount: amountMicroUnits,
            fee: feeMicroUnits,
            nonce,
            timestamp: Math.floor(Date.now() / 1000), // Standard UNIX timestamp
        };
    }

    /**
     * Convert an unsigned transaction to its canonical bytes format
     * This mimics the Rust behavior in `core::transaction::Transaction::to_bytes()`
     */
    static serialize(tx: UnsignedTransaction): Uint8Array {
        const textEncoder = new TextEncoder();
        
        const senderBytes = textEncoder.encode(tx.sender);
        const recipientBytes = textEncoder.encode(tx.recipient);
        
        // 8 bytes for amount, fee, nonce, timestamp (total 32 bytes)
        const numBytes = new Uint8Array(32);
        const dataView = new DataView(numBytes.buffer);
        
        // Assuming little-endian matching Rust's `to_le_bytes()`
        dataView.setBigUint64(0, BigInt(tx.amount), true);
        dataView.setBigUint64(8, BigInt(tx.fee), true);
        dataView.setBigUint64(16, BigInt(tx.nonce), true);
        dataView.setBigUint64(24, BigInt(tx.timestamp), true);
        
        const out = new Uint8Array(senderBytes.length + recipientBytes.length + 32);
        out.set(senderBytes, 0);
        out.set(recipientBytes, senderBytes.length);
        out.set(numBytes, senderBytes.length + recipientBytes.length);
        
        return out;
    }

    /**
     * Format a Uint8Array to a hex string
     */
    static toHex(bytes: Uint8Array): string {
        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Sign an unsigned transaction with a wallet
     */
    static sign(tx: UnsignedTransaction, wallet: QuantaWallet): SignedTransaction {
        if (tx.sender !== wallet.address) {
            throw new Error(`Transaction sender (${tx.sender}) does not match wallet address (${wallet.address})`);
        }

        const txBytes = TransactionBuilder.serialize(tx);
        const txHex = TransactionBuilder.toHex(txBytes);
        
        // Use wallet to sign
        const signature = wallet.signTransaction(txHex);

        return {
            ...tx,
            signature,
            public_key: wallet.publicKeyHex
        };
    }
}
