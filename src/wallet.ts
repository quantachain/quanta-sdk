import init, * as wasm from 'quanta-wasm';
import * as fs from 'fs';
import { dirname, join } from 'path';

/**
 * Initialize the Post-Quantum cryptography engine.
 * MUST be called before using QuantaWallet or TransactionBuilder.
 */
export async function initQuanta(wasmUrl?: string | Buffer): Promise<void> {
    if (typeof window !== 'undefined') {
        // Browser environment
        await init(wasmUrl);
    } else {
        // Node.js environment
        // We will safely resolve the exact path to the WASM file without triggering bundler/ts CJS warnings
        let buffer: Buffer;
        if (Buffer.isBuffer(wasmUrl)) {
            buffer = wasmUrl;
        } else {
            let wasmPath = '';
            try {
                // CommonJS fallback resolution 
                const req = typeof require !== 'undefined' ? require : undefined;
                if (req) {
                    const pkgPath = req.resolve('quanta-wasm/package.json');
                    wasmPath = join(dirname(pkgPath), 'quanta_wasm_bg.wasm');
                } else {
                    throw new Error("Not CJS");
                }
            } catch (e) {
                // If ESM or local, assume sibling dir (local dev)
                // We use process.cwd() as a very dumb fallback or hardcoded local path
                wasmPath = join(process.cwd(), '../quanta-wasm/pkg/quanta_wasm_bg.wasm');
            }
            
            try {
                buffer = fs.readFileSync(wasmPath);
            } catch (fsErr) {
                console.warn(`[Quanta SDK] Failed to load WASM from ${wasmPath}. Try passing the buffer directly to initQuanta().`);
                throw fsErr;
            }
        }
        await init(buffer);
    }
}

export interface WalletInfo {
    mnemonic: string;
    address: string;
    public_key: string;
    secret_key: string;
}

export class QuantaWallet {
    private secretKeyHex: string;
    public publicKeyHex: string;
    public address: string;

    constructor(secretKeyHex: string, publicKeyHex: string, address: string) {
        this.secretKeyHex = secretKeyHex;
        this.publicKeyHex = publicKeyHex;
        this.address = address;
    }

    /**
     * Generate a new HD wallet with a random 24-word seed phrase
     */
    static create(): WalletInfo {
        const info = wasm.generate_wallet() as WalletInfo;
        return info;
    }

    /**
     * Restore a wallet from a 24-word seed phrase
     */
    static fromMnemonic(mnemonic: string, passphrase: string = "", accountIndex: number = 0): QuantaWallet {
        if (!wasm.validate_mnemonic(mnemonic)) {
            throw new Error("Invalid mnemonic phrase");
        }
        
        const info = wasm.import_wallet(mnemonic, passphrase, accountIndex);
        return new QuantaWallet(info.secret_key, info.public_key, info.address);
    }

    signTransaction(txDataHex: string): string {
        return wasm.sign_transaction(txDataHex, this.secretKeyHex);
    }

    static verifySignature(hashHex: string, signedMsgHex: string, pubkeyHex: string): boolean {
        return wasm.verify_signature(hashHex, signedMsgHex, pubkeyHex);
    }
}
