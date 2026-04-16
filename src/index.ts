export * from './client.js';
export * from './wallet.js';
export * from './transaction.js';

// Re-export specific WASM utilities if needed
import { generate_mnemonic, validate_mnemonic } from 'quanta-wasm';

export const utils = {
    generateMnemonic: generate_mnemonic,
    validateMnemonic: validate_mnemonic
};
