export interface AddressInfo {
    address: string;
    balance_microunits: number;
    balance_qua: number;
    total_balance_microunits: number;
    total_balance_qua: number;
    nonce: number;
    locked_balances: Array<{
        amount_microunits: number;
        amount_qua: number;
        unlock_height: number;
    }>;
}

export interface NodeStatus {
    status: string;
    chain_height: number;
    mempool_size: number;
    connected_peers: number;
    uptime_seconds: number;
}

export interface TransactionResponse {
    success: boolean;
    tx_hash?: string;
    error?: string;
}

export class QuantaClient {
    private baseUrl: string;

    constructor(baseUrl: string = 'https://rpc.quantachain.org') {
        this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    }

    /**
     * Get the current node status
     */
    async getStatus(): Promise<NodeStatus> {
        const response = await fetch(`${this.baseUrl}/api/health`);
        if (!response.ok) {
            throw new Error(`Failed to fetch node status: ${response.statusText}`);
        }
        return response.json();
    }

    /**
     * Get address information including balance and nonce
     * @param address The Quanta address to query
     */
    async getAddressInfo(address: string): Promise<AddressInfo> {
        const response = await fetch(`${this.baseUrl}/api/address/${address}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch address info: ${response.statusText}`);
        }
        return response.json();
    }

    /**
     * Submit a signed transaction to the network
     * @param transaction The fully constructed and signed transaction object
     */
    async submitTransaction(transaction: any): Promise<TransactionResponse> {
        const response = await fetch(`${this.baseUrl}/api/transactions/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(transaction),
        });
        
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(`Transaction submission failed: ${data.error || response.statusText}`);
        }
        
        return response.json();
    }
}
