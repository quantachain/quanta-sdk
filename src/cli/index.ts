#!/usr/bin/env node
import { QuantaWallet, initQuanta } from '../wallet.js';
import { TransactionBuilder } from '../transaction.js';
import { QuantaClient } from '../client.js';
import * as util from 'util';
import * as readline from 'readline';

const args = process.argv.slice(2);
const isJson = args.includes('--json');
const cleanArgs = args.filter(a => a !== '--json');

const COLORS = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    fgGreen: "\x1b[32m",
    fgYellow: "\x1b[33m",
    fgRed: "\x1b[31m",
    fgCyan: "\x1b[36m"
};

function printJson(data: any) {
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
}

function printError(msg: string) {
    if (isJson) {
        printJson({ error: msg });
    } else {
        console.error(`\n${COLORS.fgRed}❌ ${msg}${COLORS.reset}`);
    }
    process.exit(1);
}

function printSuccess(msg: string) {
    if (!isJson) {
        console.log(`\n${COLORS.fgGreen}✅ ${msg}${COLORS.reset}\n`);
    }
}

function printField(label: string, value: any, color = COLORS.fgCyan) {
    if (!isJson) {
        console.log(`${label.padEnd(15)} ${color}${value}${COLORS.reset}`);
    }
}

async function promptConfirm(question: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => {
        rl.question(`${COLORS.fgYellow}${question} (y/n): ${COLORS.reset}`, answer => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}

function showHelp() {
    console.log(`
${COLORS.bright}quanta-cli: Developer Toolkit for the Quanta Protocol${COLORS.reset}

${COLORS.bright}USAGE:${COLORS.reset}
  quanta-cli <command> [subcommand] [args] [--json]

${COLORS.bright}COMMANDS:${COLORS.reset}
  ${COLORS.fgGreen}wallet generate${COLORS.reset}                        Create a new wallet with random 24-word seed phrase
  ${COLORS.fgGreen}wallet import <mnemonic>${COLORS.reset}               Restore wallet from seed phrase, show address
  ${COLORS.fgGreen}wallet balance <address>${COLORS.reset}               Fetch & display balance (available + locked)
  ${COLORS.fgGreen}send <from-mnemonic> <to-address> <amt>${COLORS.reset} Build, sign, submit a transfer (amt in QUA)
  ${COLORS.fgGreen}node status [url]${COLORS.reset}                      Check the status of a Quanta node
  ${COLORS.fgGreen}node stats [url]${COLORS.reset}                       Fetch chain stats (height, difficulty, mempool)
  ${COLORS.fgGreen}tx get <hash> [url]${COLORS.reset}                    Look up a transaction by hash
  ${COLORS.fgGreen}block get <height> [url]${COLORS.reset}               Fetch block details
  ${COLORS.fgGreen}address txs <address> [url]${COLORS.reset}            List recent transactions for an address
  ${COLORS.fgGreen}help${COLORS.reset}                                   Show this help message

${COLORS.dim}Global options:
  --json  Output results in raw JSON format${COLORS.reset}
`);
    process.exit(0);
}

async function main() {
    if (cleanArgs.length === 0 || cleanArgs[0] === 'help') {
        showHelp();
    }

    const command = cleanArgs[0];
    const subCommand = cleanArgs[1];

    if (command === 'wallet' && subCommand === 'generate') {
        await initQuanta();
        const walletInfo = QuantaWallet.create();
        if (isJson) return printJson(walletInfo);

        printSuccess('New Quanta Wallet Generated');
        printField('Address:', walletInfo.address);
        printField('Mnemonic:', walletInfo.mnemonic, COLORS.fgYellow);
        console.log(`\n${COLORS.dim}[!] Save your mnemonic securely. Your secret key is derived from it.${COLORS.reset}`);
        printField('Secret Key:', walletInfo.secret_key);
        process.exit(0);
    }

    if (command === 'wallet' && subCommand === 'import') {
        const mnemonic = cleanArgs[2];
        if (!mnemonic) printError('Missing mnemonic phrase');
        await initQuanta();
        try {
            const walletInfo = QuantaWallet.fromMnemonic(mnemonic);
            if (isJson) return printJson(walletInfo);

            printSuccess('Wallet Imported Successfully');
            printField('Address:', walletInfo.address);
            process.exit(0);
        } catch (e: any) {
            printError(`Failed to import wallet: ${e.message}`);
        }
    }

    if (command === 'wallet' && subCommand === 'balance') {
        const address = cleanArgs[2];
        if (!address) printError('Missing address');
        const url = cleanArgs[3] || 'https://rpc.quantachain.org';
        const client = new QuantaClient(url);

        try {
            const info = await client.getAddressInfo(address);
            if (isJson) return printJson(info);

            printSuccess(`Balance for ${address.substring(0, 8)}...`);
            printField('Spendable:', `${info.balance_qua} QUA`, COLORS.fgGreen);
            printField('Total:', `${info.total_balance_qua} QUA`);
            printField('Nonce:', info.nonce);
            if (info.locked_balances.length > 0) {
                printField('Locked:', `${info.locked_balances.length} vesting entries`, COLORS.fgYellow);
            }
        } catch (e: any) {
            printError(e.message);
        }
        process.exit(0);
    }

    if (command === 'send') {
        const mnemonic = cleanArgs[1];
        const toAddress = cleanArgs[2];
        const amountStr = cleanArgs[3];
        const url = cleanArgs[4] || 'https://rpc.quantachain.org';

        if (!mnemonic || !toAddress || !amountStr) {
            printError('Usage: send <mnemonic> <to-address> <amount>');
        }

        const amountQua = parseFloat(amountStr);
        if (isNaN(amountQua) || amountQua <= 0) printError('Invalid amount');

        const amountMicrounits = Math.floor(amountQua * 1_000_000);
        // Default fee is 0.01 QUA
        const feeMicrounits = 10_000;

        await initQuanta();
        let wallet;
        try {
            wallet = QuantaWallet.fromMnemonic(mnemonic);
        } catch (e: any) {
            printError(`Invalid mnemonic: ${e.message}`);
            return;
        }

        const client = new QuantaClient(url);
        let nonce = 0;
        try {
            const info = await client.getAddressInfo(wallet.address);
            nonce = info.nonce;
        } catch (e: any) {
            printError(`Failed to fetch nonce: ${e.message}`);
        }

        if (!isJson) {
            console.log(`\nTransaction Details:`);
            printField('From:', wallet.address);
            printField('To:', toAddress);
            printField('Amount:', `${amountQua} QUA`, COLORS.fgGreen);
            printField('Fee:', `0.01 QUA`, COLORS.fgYellow);
            const confirm = await promptConfirm(`Send ${amountQua} QUA to ${toAddress.substring(0, 8)}...?`);
            if (!confirm) {
                console.log('Transaction cancelled.');
                process.exit(0);
            }
        }

        try {
            const tx = TransactionBuilder.createTransfer(wallet.address, toAddress, amountMicrounits, nonce, feeMicrounits);
            const signedTx = TransactionBuilder.sign(tx, wallet);
            const result = await client.submitTransaction(signedTx);

            if (isJson) return printJson(result);

            printSuccess('Transaction Submitted');
            printField('Tx Hash:', result.tx_hash || 'Unknown');
        } catch (e: any) {
            printError(`Send failed: ${e.message}`);
        }
        process.exit(0);
    }

    if (command === 'node' && subCommand === 'status') {
        const url = cleanArgs[2] || 'https://rpc.quantachain.org';
        const client = new QuantaClient(url);
        try {
            if (!isJson) console.log(`Pinging node at ${url}...`);
            const status = await client.getStatus();
            if (isJson) return printJson(status);

            printSuccess('Node is Online');
            console.log(util.inspect(status, { colors: true }));
        } catch (e: any) {
            printError(`Failed to connect to node: ${e.message}`);
        }
        process.exit(0);
    }

    if (command === 'node' && subCommand === 'stats') {
        const url = cleanArgs[2] || 'https://rpc.quantachain.org';
        const client = new QuantaClient(url);
        try {
            const stats = await client.getStats();
            if (isJson) return printJson(stats);

            printSuccess('Network Statistics');
            printField('Chain Length:', stats.chain_length);
            printField('Difficulty:', stats.current_difficulty);
            printField('Mempool Size:', stats.pending_transactions);
            printField('Total Supply:', `${(stats.total_supply / 1_000_000).toLocaleString()} QUA`);
        } catch (e: any) {
            printError(`Failed to fetch stats: ${e.message}`);
        }
        process.exit(0);
    }

    if (command === 'tx' && subCommand === 'get') {
        const hash = cleanArgs[2];
        if (!hash) printError('Missing tx hash');
        const url = cleanArgs[3] || 'https://rpc.quantachain.org';
        const client = new QuantaClient(url);
        try {
            const tx = await client.getTx(hash);
            if (isJson) return printJson(tx);

            printSuccess(`Transaction: ${hash.substring(0, 16)}...`);
            console.log(util.inspect(tx, { colors: true, depth: null }));
        } catch (e: any) {
            printError(`Tx fetch failed: ${e.message}`);
        }
        process.exit(0);
    }

    if (command === 'block' && subCommand === 'get') {
        const height = parseInt(cleanArgs[2], 10);
        if (isNaN(height)) printError('Invalid block height');
        const url = cleanArgs[3] || 'https://rpc.quantachain.org';
        const client = new QuantaClient(url);
        try {
            const block = await client.getBlock(height);
            if (isJson) return printJson(block);

            printSuccess(`Block #${height}`);
            printField('Hash:', block.hash);
            printField('Tx Count:', block.transactions?.length || 0);
            printField('Miner:', block.transactions?.[0]?.recipient || 'Unknown');
        } catch (e: any) {
            printError(`Block fetch failed: ${e.message}`);
        }
        process.exit(0);
    }

    if (command === 'address' && subCommand === 'txs') {
        const address = cleanArgs[2];
        if (!address) printError('Missing address');
        const url = cleanArgs[3] || 'https://rpc.quantachain.org';
        const client = new QuantaClient(url);
        try {
            const txs = await client.getAddressTransactions(address);
            if (isJson) return printJson(txs);

            printSuccess(`Transactions for ${address.substring(0, 8)}...`);
            printField('Total Txs:', txs.transaction_count);
            for (const tx of txs.transactions || []) {
                const amt = (tx.amount_microunits / 1_000_000).toFixed(6);
                const dir = tx.recipient === address ? 'IN ' : 'OUT';
                console.log(`${COLORS.dim}[Block ${tx.block_height}]${COLORS.reset} ${dir} ${amt} QUA  ${COLORS.dim}(Tx: ${tx.tx_hash.substring(0, 10)}...)${COLORS.reset}`);
            }
        } catch (e: any) {
            printError(`Address txs failed: ${e.message}`);
        }
        process.exit(0);
    }

    printError(`Unknown command: ${cleanArgs.join(' ')}\nRun 'quanta-cli help' for usage.`);
}

main().catch(err => {
    printError(err.message || String(err));
});
