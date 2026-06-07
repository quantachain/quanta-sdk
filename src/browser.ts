export interface QuantaSignature {
    signatureHex: string;
    publicKeyHex: string;
}

export interface QuantaProvider {
    requestAccounts: () => Promise<string[]>;
    signMessage: (message: string) => Promise<QuantaSignature>;
}

declare global {
    interface Window {
        quanta?: QuantaProvider;
    }
}

export class BrowserProvider {
    /**
     * Checks if the Quanta Wallet extension is installed and injected into the page.
     */
    public isAvailable(): boolean {
        return typeof window !== 'undefined' && !!window.quanta;
    }

    /**
     * Requests the user to connect their Quanta Wallet.
     * @returns A promise that resolves to an array of connected addresses (currently just the active address).
     */
    public async connect(): Promise<string[]> {
        if (!this.isAvailable()) {
            throw new Error("Quanta Wallet extension not found. Please install the extension first.");
        }
        return await window.quanta!.requestAccounts();
    }

    /**
     * Requests the user to sign a message using their Quanta Wallet.
     * @param message The string message to be signed.
     * @returns A promise that resolves to the Falcon-512 signature and public key.
     */
    public async signMessage(message: string): Promise<QuantaSignature> {
        if (!this.isAvailable()) {
            throw new Error("Quanta Wallet extension not found. Please install the extension first.");
        }
        return await window.quanta!.signMessage(message);
    }
}
