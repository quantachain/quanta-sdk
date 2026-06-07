import { QuantaWallet } from './wallet.js';

export type TxTypeObject =
    | "Transfer"
    | { TimeLockTransfer: { unlock_height: number } }
    | { MultiSigTransfer: { signers_required: number } }
    | { Stake: { validator_pubkey: number[] } }
    | "Unstake"
    | { ContractDeploy: { template_id: number; init_args: number[] } }
    | { ContractCall: { contract_address: string; method: string; call_args: number[] } };

export interface UnsignedTransaction {
    sender: string;
    recipient: string;
    amount: number;
    fee: number;
    nonce: number;
    timestamp: number;
    lock_time?: number;
    tx_type: TxTypeObject;
    sig_scheme?: string;
    network_id?: number;
    payload?: number[];
}

export interface SignedTransaction extends Omit<UnsignedTransaction, 'lock_time' | 'sig_scheme' | 'network_id' | 'payload'> {
    lock_time: number;
    sig_scheme: string;
    network_id: number;
    payload: number[];
    signature: number[];
    public_key: number[];
}

export class TransactionBuilder {
    static readonly DEFAULT_FEE = 10000;
    static readonly DEPLOY_FEE = 50000;
    static readonly CALL_FEE = 20000;

    private static createBase(sender: string, recipient: string, amount: number, fee: number, nonce: number): Partial<UnsignedTransaction> {
        return {
            sender,
            recipient,
            amount,
            fee,
            nonce,
            timestamp: Math.floor(Date.now() / 1000),
            lock_time: 0,
            sig_scheme: 'Falcon512',
            network_id: 0, // Testnet
            payload: []
        };
    }

    /**
     * @deprecated Use `createTransfer` instead.
     */
    static createUnsigned(sender: string, recipient: string, amount: number, nonce: number, fee: number = TransactionBuilder.DEFAULT_FEE): UnsignedTransaction {
        return TransactionBuilder.createTransfer(sender, recipient, amount, nonce, fee);
    }

    static createTransfer(sender: string, recipient: string, amount: number, nonce: number, fee: number = TransactionBuilder.DEFAULT_FEE): UnsignedTransaction {
        return {
            ...TransactionBuilder.createBase(sender, recipient, amount, fee, nonce),
            tx_type: "Transfer"
        } as UnsignedTransaction;
    }

    static createTimeLock(sender: string, recipient: string, amount: number, unlockHeight: number, nonce: number): UnsignedTransaction {
        return {
            ...TransactionBuilder.createBase(sender, recipient, amount, TransactionBuilder.DEFAULT_FEE, nonce),
            tx_type: { TimeLockTransfer: { unlock_height: unlockHeight } }
        } as UnsignedTransaction;
    }

    static createStake(sender: string, validatorPubkeyHex: string, amount: number, nonce: number): UnsignedTransaction {
        // Pubkey is 897 bytes hex -> array of numbers
        const pkBytes = TransactionBuilder.fromHex(validatorPubkeyHex);
        return {
            ...TransactionBuilder.createBase(sender, "SYSTEM", amount, TransactionBuilder.DEFAULT_FEE, nonce),
            tx_type: { Stake: { validator_pubkey: Array.from(pkBytes) } }
        } as UnsignedTransaction;
    }

    static createUnstake(sender: string, nonce: number): UnsignedTransaction {
        return {
            ...TransactionBuilder.createBase(sender, "SYSTEM", 0, TransactionBuilder.DEFAULT_FEE, nonce),
            tx_type: "Unstake"
        } as UnsignedTransaction;
    }

    static createContractDeploy(sender: string, templateId: number, initArgs: number[], nonce: number): UnsignedTransaction {
        return {
            ...TransactionBuilder.createBase(sender, "SYSTEM", 0, TransactionBuilder.DEPLOY_FEE, nonce),
            tx_type: { ContractDeploy: { template_id: templateId, init_args: initArgs } }
        } as UnsignedTransaction;
    }

    static createContractCall(sender: string, contractAddress: string, method: string, callArgs: number[], nonce: number, amount: number = 0): UnsignedTransaction {
        return {
            ...TransactionBuilder.createBase(sender, contractAddress, amount, TransactionBuilder.CALL_FEE, nonce),
            tx_type: { ContractCall: { contract_address: contractAddress, method, call_args: callArgs } }
        } as UnsignedTransaction;
    }

    static createEscrowDeploy(sender: string, beneficiary: string, secretHashHex: string, amount: number, nonce: number): UnsignedTransaction {
        const args = { beneficiary, secret_hash: secretHashHex };
        const initArgs = Array.from(new TextEncoder().encode(JSON.stringify(args)));
        const tx = TransactionBuilder.createContractDeploy(sender, 0, initArgs, nonce);
        tx.amount = amount;
        return tx;
    }

    static createEscrowClaim(sender: string, contractAddress: string, preimageHex: string, nonce: number): UnsignedTransaction {
        const args = { preimage: preimageHex };
        const callArgs = Array.from(new TextEncoder().encode(JSON.stringify(args)));
        return TransactionBuilder.createContractCall(sender, contractAddress, "claim", callArgs, nonce);
    }

    static createWithData(sender: string, recipient: string, amount: number, payload: number[], nonce: number): UnsignedTransaction {
        const tx = TransactionBuilder.createTransfer(sender, recipient, amount, nonce);
        tx.payload = payload;
        return tx;
    }

    static serialize(tx: UnsignedTransaction, pubkeyBytes: Uint8Array): Uint8Array {
        const enc = new TextEncoder();
        const senderB = enc.encode(tx.sender);
        const recipientB = enc.encode(tx.recipient);

        const nums = new Uint8Array(5 * 8); // amount, timestamp, fee, nonce, lock_time
        const dv = new DataView(nums.buffer);
        dv.setBigUint64(0, BigInt(tx.amount), true);
        dv.setBigInt64(8, BigInt(tx.timestamp), true);
        dv.setBigUint64(16, BigInt(tx.fee), true);
        dv.setBigUint64(24, BigInt(tx.nonce), true);
        dv.setBigUint64(32, BigInt(tx.lock_time ?? 0), true);

        const payload = tx.payload ?? [];
        const payloadBytes = new Uint8Array(payload);

        const mid = new Uint8Array(1 + 4 + 4 + payloadBytes.length);
        const midDv = new DataView(mid.buffer);
        // Map string 'Falcon512' to u8 discriminant 0
        midDv.setUint8(0, tx.sig_scheme === 'Falcon512' ? 0 : 0);
        midDv.setUint32(1, tx.network_id ?? 0, true);
        midDv.setUint32(5, payloadBytes.length, true);
        mid.set(payloadBytes, 9);

        let txTypeBytes: Uint8Array;
        if (tx.tx_type === "Transfer") {
            txTypeBytes = new Uint8Array([0]);
        } else if (typeof tx.tx_type === 'object') {
            if ('TimeLockTransfer' in tx.tx_type) {
                txTypeBytes = new Uint8Array(1 + 8);
                txTypeBytes[0] = 1;
                new DataView(txTypeBytes.buffer).setBigUint64(1, BigInt(tx.tx_type.TimeLockTransfer.unlock_height), true);
            } else if ('MultiSigTransfer' in tx.tx_type) {
                txTypeBytes = new Uint8Array([2, tx.tx_type.MultiSigTransfer.signers_required]);
            } else if ('Stake' in tx.tx_type) {
                const pk = new Uint8Array(tx.tx_type.Stake.validator_pubkey);
                txTypeBytes = new Uint8Array(1 + pk.length);
                txTypeBytes[0] = 3;
                txTypeBytes.set(pk, 1);
            } else if ('ContractDeploy' in tx.tx_type) {
                const args = new Uint8Array(tx.tx_type.ContractDeploy.init_args);
                txTypeBytes = new Uint8Array(1 + 1 + args.length);
                txTypeBytes[0] = 5;
                txTypeBytes[1] = tx.tx_type.ContractDeploy.template_id;
                txTypeBytes.set(args, 2);
            } else if ('ContractCall' in tx.tx_type) {
                const caddr = enc.encode(tx.tx_type.ContractCall.contract_address);
                const meth = enc.encode(tx.tx_type.ContractCall.method);
                const args = new Uint8Array(tx.tx_type.ContractCall.call_args);
                txTypeBytes = new Uint8Array(1 + caddr.length + meth.length + args.length);
                txTypeBytes[0] = 6;
                let offset = 1;
                txTypeBytes.set(caddr, offset); offset += caddr.length;
                txTypeBytes.set(meth, offset); offset += meth.length;
                txTypeBytes.set(args, offset);
            } else {
                throw new Error("Unknown tx_type object");
            }
        } else if (tx.tx_type === "Unstake") {
            txTypeBytes = new Uint8Array([4]);
        } else {
            throw new Error("Unknown tx_type");
        }

        const totalLen = senderB.length + recipientB.length + nums.length + pubkeyBytes.length + mid.length + txTypeBytes.length;
        const out = new Uint8Array(totalLen);
        let offset = 0;
        out.set(senderB, offset); offset += senderB.length;
        out.set(recipientB, offset); offset += recipientB.length;
        out.set(nums, offset); offset += nums.length;
        out.set(pubkeyBytes, offset); offset += pubkeyBytes.length;
        out.set(mid, offset); offset += mid.length;
        out.set(txTypeBytes, offset);

        return out;
    }

    static toHex(bytes: Uint8Array | number[]): string {
        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    static fromHex(hex: string): Uint8Array {
        if (hex.length % 2 !== 0) throw new Error("Invalid hex string");
        const out = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            out[i / 2] = parseInt(hex.substring(i, i + 2), 16);
        }
        return out;
    }

    static sign(tx: UnsignedTransaction, wallet: QuantaWallet): SignedTransaction {
        if (tx.sender !== wallet.address) {
            throw new Error(`Transaction sender (${tx.sender}) does not match wallet address (${wallet.address})`);
        }

        const pkBytes = TransactionBuilder.fromHex(wallet.publicKeyHex);
        const txBytes = TransactionBuilder.serialize(tx, pkBytes);
        const txHex = TransactionBuilder.toHex(txBytes);

        // signTransaction in the wallet uses the WASM `sign_transaction`
        const signedMsgHex = wallet.signTransaction(txHex);
        
        // The WASM returns `sig_bytes || hash_bytes`. We just need the sig_bytes for the node payload.
        // Falcon-512 sig length varies, but the hash is always exactly 32 bytes (64 hex chars).
        const sigHex = signedMsgHex.substring(0, signedMsgHex.length - 64);
        const signatureBytes = TransactionBuilder.fromHex(sigHex);

        return {
            ...tx,
            lock_time: tx.lock_time ?? 0,
            sig_scheme: tx.sig_scheme ?? 'Falcon512',
            network_id: tx.network_id ?? 0,
            payload: tx.payload ?? [],
            signature: Array.from(signatureBytes),
            public_key: Array.from(pkBytes)
        };
    }
}
