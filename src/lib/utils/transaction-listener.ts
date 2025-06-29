import { NodeService } from "./node-service"
import { toast } from "sonner"
import { TOKEN_ADDRESS } from "@/lib/constants/token"

// Transaction state interface
export interface TransactionState {
    txHash: string
    timestamp: number
    actionType: string // 'fission', 'fusion', 'transmute-to-gold', 'transmute-from-gold'
    preTransactionState: WalletState
    expectedChanges: ExpectedChanges
    isConfirmed: boolean
    isWalletUpdated: boolean
    confirmationHeight?: number
    retryCount: number
}

// Wallet state snapshot
export interface WalletState {
    erg: string
    gau: string
    gauc: string
    timestamp: number
    blockHeight?: number
}

// Expected balance changes after transaction
export interface ExpectedChanges {
    erg: string // Can be positive or negative
    gau: string
    gauc: string
    fees: string // Always negative (ERG fees)
}

// Transaction listener configuration
const LISTENER_CONFIG = {
    MAX_CONFIRMATION_WAIT_TIME: 15 * 60 * 1000, // 15 minutes
    WALLET_UPDATE_BUFFER_TIME: 20 * 1000, // 20 seconds after confirmation
    POLLING_INTERVAL: 15 * 1000, // 15 seconds (reduced frequency to avoid rate limiting)
    MAX_WALLET_CHECK_ATTEMPTS: 10,
    MAX_RETRY_COUNT: 20, // Maximum retries before giving up
    RETRY_DELAY: 5 * 1000, // 5 seconds
    LOCALSTORAGE_KEY: 'gluon_pending_transactions'
}

export class TransactionListener {
    private nodeService: NodeService
    private pollingInterval: NodeJS.Timeout | null = null
    private isListening = false

    constructor(nodeService: NodeService) {
        this.nodeService = nodeService
    }

    /**
     * Save transaction data to localStorage after submission
     */
    saveUpTransaction(
        txHash: string,
        actionType: string,
        preTransactionState: WalletState,
        expectedChanges: ExpectedChanges
    ): void {
        try {
            const transactionState: TransactionState = {
                txHash,
                timestamp: Date.now(),
                actionType,
                preTransactionState,
                expectedChanges,
                isConfirmed: false,
                isWalletUpdated: false,
                retryCount: 0
            }

            const pendingTransactions = this.getPendingTransactions()
            pendingTransactions[txHash] = transactionState

            localStorage.setItem(LISTENER_CONFIG.LOCALSTORAGE_KEY, JSON.stringify(pendingTransactions))

            console.log("💾 Transaction saved to localStorage:", {
                txHash: txHash.slice(0, 8) + "...",
                actionType,
                expectedChanges
            })

            // Start listening if not already listening
            if (!this.isListening) {
                this.startListening()
            }

            // Show initial status
            toast.info(`${actionType.charAt(0).toUpperCase() + actionType.slice(1)} transaction submitted`, {
                description: "Waiting for blockchain confirmation...",
                duration: 8000
            })

        } catch (error) {
            console.error("Failed to save transaction:", error)
        }
    }

    /**
 * Listen for transaction confirmation on blockchain
 */
    private async listenForTransaction(txHash: string): Promise<boolean> {
        try {
            console.log("🔍 Checking transaction status:", txHash.slice(0, 8) + "...")

            // First try to get the transaction directly (if it's confirmed, it won't be in unconfirmed)
            try {
                const confirmedTx = await this.nodeService.getTxsById(txHash)

                if (confirmedTx && confirmedTx.inclusionHeight) {
                    console.log("✅ Transaction confirmed on blockchain:", {
                        txHash: txHash.slice(0, 8) + "...",
                        height: confirmedTx.inclusionHeight
                    })

                    // Update transaction state
                    const pendingTransactions = this.getPendingTransactions()
                    if (pendingTransactions[txHash]) {
                        pendingTransactions[txHash].isConfirmed = true
                        pendingTransactions[txHash].confirmationHeight = confirmedTx.inclusionHeight
                        localStorage.setItem(LISTENER_CONFIG.LOCALSTORAGE_KEY, JSON.stringify(pendingTransactions))
                    }

                    return true
                }
            } catch (confirmedError) {
                // Transaction not confirmed yet, check if it's still in mempool
                console.log("Transaction not confirmed yet, checking mempool...")
            }

            // Check if transaction is still in unconfirmed mempool
            try {
                const txStatus = await this.nodeService.checkUnconfirmedTx(txHash)

                if (txStatus === 200) {
                    console.log("Transaction still in mempool, waiting...")
                    return false
                } else if (txStatus === 404) {
                    // Not in mempool and not confirmed - might be processing
                    console.log("Transaction not in mempool, might be confirming...")
                    return false
                }
            } catch (mempoolError) {
                console.log("Error checking mempool, will retry:", mempoolError)
            }

            return false
        } catch (error) {
            console.error("Error checking transaction status:", error)
            return false
        }
    }

    /**
     * Compare pre/post transaction wallet states
     */
    private async compareWithWallet(
        txHash: string,
        getBalance: () => Promise<Array<{ tokenId: string; balance: string }>>
    ): Promise<boolean> {
        try {
            const pendingTransactions = this.getPendingTransactions()
            const transactionState = pendingTransactions[txHash]

            if (!transactionState || !transactionState.isConfirmed) {
                return false
            }

            console.log("🔄 Comparing wallet state after confirmation:", txHash.slice(0, 8) + "...")

            // Get current wallet state
            const currentWalletState = await this.getCurrentWalletState(getBalance)

            // Calculate expected post-transaction state
            const expectedState = this.calculateExpectedState(
                transactionState.preTransactionState,
                transactionState.expectedChanges
            )

            // Compare with tolerance for blockchain precision
            const isWalletUpdated = this.compareStatesWithTolerance(currentWalletState, expectedState)

            if (isWalletUpdated) {
                console.log("✅ Wallet state updated successfully:", {
                    txHash: txHash.slice(0, 8) + "...",
                    actionType: transactionState.actionType,
                    changes: {
                        erg: `${transactionState.preTransactionState.erg} → ${currentWalletState.erg}`,
                        gau: `${transactionState.preTransactionState.gau} → ${currentWalletState.gau}`,
                        gauc: `${transactionState.preTransactionState.gauc} → ${currentWalletState.gauc}`
                    }
                })

                // Update transaction state
                transactionState.isWalletUpdated = true
                pendingTransactions[txHash] = transactionState
                localStorage.setItem(LISTENER_CONFIG.LOCALSTORAGE_KEY, JSON.stringify(pendingTransactions))

                // Show success notification
                toast.success(`${transactionState.actionType.charAt(0).toUpperCase() + transactionState.actionType.slice(1)} completed!`, {
                    description: "Your wallet balances have been updated.",
                    duration: 8000
                })

                return true
            } else {
                console.log("⏳ Wallet not yet updated, will retry...", {
                    current: currentWalletState,
                    expected: expectedState,
                    retryCount: transactionState.retryCount
                })

                // Increment retry count
                transactionState.retryCount += 1
                pendingTransactions[txHash] = transactionState
                localStorage.setItem(LISTENER_CONFIG.LOCALSTORAGE_KEY, JSON.stringify(pendingTransactions))

                return false
            }

        } catch (error) {
            console.error("Error comparing wallet state:", error)
            return false
        }
    }

    /**
     * Clean up completed transactions from localStorage
     */
    cleanUpTransaction(txHash?: string): void {
        try {
            const pendingTransactions = this.getPendingTransactions()

            if (txHash) {
                // Clean specific transaction
                delete pendingTransactions[txHash]
                console.log("🧹 Cleaned up transaction:", txHash.slice(0, 8) + "...")
            } else {
                // Clean up old completed transactions (older than 1 hour)
                const oneHourAgo = Date.now() - (60 * 60 * 1000)

                Object.keys(pendingTransactions).forEach(hash => {
                    const tx = pendingTransactions[hash]
                    if (tx.isWalletUpdated || tx.timestamp < oneHourAgo) {
                        delete pendingTransactions[hash]
                        console.log("🧹 Cleaned up old transaction:", hash.slice(0, 8) + "...")
                    }
                })
            }

            localStorage.setItem(LISTENER_CONFIG.LOCALSTORAGE_KEY, JSON.stringify(pendingTransactions))

            // Stop listening if no pending transactions
            if (Object.keys(pendingTransactions).length === 0) {
                this.stopListening()
            }

        } catch (error) {
            console.error("Error cleaning up transactions:", error)
        }
    }

    /**
     * Start the transaction monitoring loop
     */
    private startListening(): void {
        if (this.isListening) return

        this.isListening = true
        console.log("🎧 Starting transaction listener...")

        this.pollingInterval = setInterval(async () => {
            await this.processAllPendingTransactions()
        }, LISTENER_CONFIG.POLLING_INTERVAL)
    }

    /**
     * Stop the monitoring loop
     */
    private stopListening(): void {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval)
            this.pollingInterval = null
        }
        this.isListening = false
        console.log("⏹️ Stopped transaction listener")
    }

    /**
     * Process all pending transactions
     */
    private async processAllPendingTransactions(): Promise<void> {
        const pendingTransactions = this.getPendingTransactions()
        const currentTime = Date.now()

        for (const [txHash, transactionState] of Object.entries(pendingTransactions)) {
            try {
                // Skip if transaction is too old
                if (currentTime - transactionState.timestamp > LISTENER_CONFIG.MAX_CONFIRMATION_WAIT_TIME) {
                    console.warn("⚠️ Transaction timeout, cleaning up:", txHash.slice(0, 8) + "...")
                    toast.error("Transaction timeout", {
                        description: "Transaction took too long to confirm. Please check manually.",
                        duration: 8000
                    })
                    this.cleanUpTransaction(txHash)
                    continue
                }

                // Skip if too many retries
                if (transactionState.retryCount >= LISTENER_CONFIG.MAX_RETRY_COUNT) {
                    console.warn("⚠️ Max retries reached, cleaning up:", txHash.slice(0, 8) + "...")
                    toast.error("Transaction monitoring stopped", {
                        description: "Please check transaction status manually.",
                        duration: 8000
                    })
                    this.cleanUpTransaction(txHash)
                    continue
                }

                // Skip if already completed
                if (transactionState.isWalletUpdated) {
                    this.cleanUpTransaction(txHash)
                    continue
                }

                // Check for blockchain confirmation
                if (!transactionState.isConfirmed) {
                    const isConfirmed = await this.listenForTransaction(txHash)

                    if (isConfirmed) {
                        toast.success("Transaction confirmed!", {
                            description: "Waiting for wallet to update...",
                            duration: 5000
                        })
                    } else {
                        // Increment retry count for failed checks
                        const pendingTxs = this.getPendingTransactions()
                        if (pendingTxs[txHash]) {
                            pendingTxs[txHash].retryCount += 1
                            localStorage.setItem(LISTENER_CONFIG.LOCALSTORAGE_KEY, JSON.stringify(pendingTxs))
                        }
                    }
                }

                // Check wallet update (with buffer time after confirmation)
                if (transactionState.isConfirmed) {
                    const timeSinceConfirmation = currentTime - (transactionState.timestamp + 30000) // Rough estimate

                    if (timeSinceConfirmation >= LISTENER_CONFIG.WALLET_UPDATE_BUFFER_TIME) {
                        // We need getBalance function - will be passed from ReactorSwap
                        // For now, we'll handle this in the main component
                        console.log("⏳ Ready to check wallet update for:", txHash.slice(0, 8) + "...")
                    }
                }

            } catch (error) {
                console.error("Error processing transaction:", txHash.slice(0, 8) + "...", error)
            }
        }
    }

    /**
     * Get pending transactions from localStorage
     */
    private getPendingTransactions(): Record<string, TransactionState> {
        try {
            const stored = localStorage.getItem(LISTENER_CONFIG.LOCALSTORAGE_KEY)
            return stored ? JSON.parse(stored) : {}
        } catch (error) {
            console.error("Error reading pending transactions:", error)
            return {}
        }
    }

    /**
 * Get current wallet state
 */
    private async getCurrentWalletState(
        getBalance: () => Promise<Array<{ tokenId: string; balance: string }>>
    ): Promise<WalletState> {
        try {
            const balances = await getBalance()

            const ergBalance = balances.find(b => b.tokenId === 'ERG' || !b.tokenId)?.balance || "0"
            const gauBalance = balances.find(b => b.tokenId === TOKEN_ADDRESS.gau)?.balance || "0"
            const gaucBalance = balances.find(b => b.tokenId === TOKEN_ADDRESS.gauc)?.balance || "0"

            return {
                erg: ergBalance,
                gau: gauBalance,
                gauc: gaucBalance,
                timestamp: Date.now()
            }
        } catch (error) {
            console.error("Error getting current wallet state:", error)
            throw error
        }
    }

    /**
     * Calculate expected wallet state after transaction
     */
    private calculateExpectedState(preState: WalletState, changes: ExpectedChanges): WalletState {
        return {
            erg: (BigInt(preState.erg) + BigInt(changes.erg) + BigInt(changes.fees)).toString(),
            gau: (BigInt(preState.gau) + BigInt(changes.gau)).toString(),
            gauc: (BigInt(preState.gauc) + BigInt(changes.gauc)).toString(),
            timestamp: Date.now()
        }
    }

    /**
     * Compare wallet states with tolerance for precision differences
     */
    private compareStatesWithTolerance(current: WalletState, expected: WalletState): boolean {
        const tolerance = BigInt("1000000") // 0.001 ERG tolerance for fees/precision

        try {
            const ergDiff = BigInt(current.erg) - BigInt(expected.erg)
            const gauDiff = BigInt(current.gau) - BigInt(expected.gau)
            const gaucDiff = BigInt(current.gauc) - BigInt(expected.gauc)

            return (
                Math.abs(Number(ergDiff)) <= Number(tolerance) &&
                gauDiff === BigInt(0) &&
                gaucDiff === BigInt(0)
            )
        } catch (error) {
            console.error("Error comparing states:", error)
            return false
        }
    }

    /**
     * Check if there are any pending transactions
     */
    hasPendingTransactions(): boolean {
        const pending = this.getPendingTransactions()
        return Object.keys(pending).length > 0
    }

    /**
     * Get all pending transactions (for UI display)
     */
    getPendingTransactionsList(): TransactionState[] {
        const pending = this.getPendingTransactions()
        return Object.values(pending)
    }

    /**
     * Manual wallet check (called from ReactorSwap)
     */
    async checkWalletUpdates(
        getBalance: () => Promise<Array<{ tokenId: string; balance: string }>>
    ): Promise<void> {
        const pendingTransactions = this.getPendingTransactions()

        for (const [txHash, transactionState] of Object.entries(pendingTransactions)) {
            if (transactionState.isConfirmed && !transactionState.isWalletUpdated) {
                await this.compareWithWallet(txHash, getBalance)
            }
        }
    }

    /**
     * Initialize listener on app start (check for any existing pending transactions)  
     */
    initialize(): void {
        const pendingTransactions = this.getPendingTransactions()

        if (Object.keys(pendingTransactions).length > 0) {
            console.log("🔄 Found pending transactions on startup, resuming listener...")
            this.startListening()
        }

        // Clean up old transactions
        this.cleanUpTransaction()
    }
}

// Export singleton instance creator
export const createTransactionListener = (nodeService: NodeService): TransactionListener => {
    return new TransactionListener(nodeService)
}
