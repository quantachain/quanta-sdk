#!/usr/bin/env node
import { QuantaWallet, initQuanta } from '../wallet.js';
import { QuantaClient } from '../client.js';
import * as util from 'util';

const args = process.argv.slice(2);

async function main() {
    if (args.length === 0) {
        console.log(`
quanta-cli: Developer Toolkit for the Quanta Protocol

Usage:
  quanta-cli wallet generate            Create a new wallet with random 24-word seed phrase
  quanta-cli node status [url]          Check the status of a Quanta node (default: https://rpc.quantachain.org)
        `);
        process.exit(0);
    }

    const command = args[0];
    const subCommand = args[1];

    if (command === 'wallet' && subCommand === 'generate') {
        // Initialize WASM
        await initQuanta();
        
        const walletInfo = QuantaWallet.create();
        console.log('\n✅ New Quanta Wallet Generated\n');
        console.log('Address:     ', walletInfo.address);
        console.log('Mnemonic:    ', walletInfo.mnemonic);
        console.log('\n[!] Save your mnemonic securely. Your secret key is derived from it.');
        console.log('Secret Key:  ', walletInfo.secret_key);
        process.exit(0);
    }

    if (command === 'node' && subCommand === 'status') {
        const url = args[2] || 'https://rpc.quantachain.org';
        const client = new QuantaClient(url);
        try {
            console.log(`Pinging node at ${url}...`);
            const status = await client.getStatus();
            console.log('\nNode Status:', util.inspect(status, { colors: true }));
        } catch (error: any) {
            console.error('\n❌ Failed to connect to node:', error.message);
        }
        process.exit(0);
    }

    console.error(`Unknown command: ${args.join(' ')}`);
    process.exit(1);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
