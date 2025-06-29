// @ts-nocheck
'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'

// Declare global window types for EIP-12
declare global {
  interface Window {
    ergoConnector?: {
      nautilus: {
        connect: () => Promise<boolean>
        isConnected: () => Promise<boolean>
      }
      // Add other wallets if needed
    }
    ergo?: {
      get_balance: (
        assetId?: string | 'ERG' | 'all'
      ) => Promise<string | Array<{ tokenId: string; balance: string }>>
      get_change_address: () => Promise<string>
      get_unused_addresses: () => Promise<string[]>
      get_used_addresses: () => Promise<string[]>
      get_utxos: (filter?: { tokens: Array<{ tokenId: string; amount?: string }> }) => Promise<
        any[]
      >
      get_current_height: () => Promise<number>
      sign_tx: (tx: any) => Promise<any>
      submit_tx: (tx: any) => Promise<string>
      sign_data: (address: string, message: string) => Promise<string>
    }
  }
}

interface WalletInfo {
  connectName: string
  icon: string
  name: string
}

interface ErgoContextType {
  walletList: WalletInfo[]
  isConnected: boolean
  connect: (walletName: string) => Promise<boolean>
  disconnect: () => void
  getChangeAddress: () => Promise<string>
  signMessage: (address: string, message: string) => Promise<string>
  getBalance: () => Promise<any>
  getUtxos: () => Promise<any>
  SignAndSubmitTx: (tx: any) => Promise<any>
  ergoWallet: typeof window.ergo | undefined
}

const ErgoContext = createContext<ErgoContextType | undefined>(undefined)

export function ErgoProvider({ children }: { children: React.ReactNode }) {
  const [walletList, setWalletList] = useState<WalletInfo[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [ergoWallet, setErgoWallet] = useState<typeof window.ergo>()

  // Initialize available wallets
  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const { ergoConnector } = window
    if (!ergoConnector) return

    const availableWallets: WalletInfo[] = Object.keys(ergoConnector).map((walletName) => ({
      connectName: walletName,
      icon:
        walletName.toLowerCase() === 'nautilus'
          ? 'https://user-images.githubusercontent.com/96133754/196057495-45bcca0f-a4de-4905-85ea-fbcdead01b42.svg'
          : 'https://example.com/default-wallet-icon.png',
      name: walletName.toLowerCase() === 'nautilus' ? 'Nautilus Wallet' : walletName,
    }))

    setWalletList(availableWallets)
  }, [])

  const connect = useCallback(async (walletName: string): Promise<boolean> => {
    try {
      const { ergoConnector } = window

      if (!ergoConnector?.[walletName]) {
        throw new Error('Wallet connector not found')
      }


      const connected = await ergoConnector[walletName].connect()

      if (!connected) {
        throw new Error('Failed to connect to wallet')
      }



      // Verify the connection
      const isWalletConnected = await ergoConnector[walletName].isConnected()


      setIsConnected(isWalletConnected)
      setErgoWallet(window.ergo)
      return isWalletConnected
    } catch (error) {
      console.error('Error connecting to wallet:', error)
      disconnect()
      return false
    }
  }, [])

  const disconnect = useCallback(() => {
    setIsConnected(false)
    setErgoWallet(undefined)
  }, [])


  const signMessage = useCallback(async (address: string, message: string): Promise<string> => {
    const { ergo } = window
    if (!ergo) throw new Error('Ergo object not found')

    try {
      return await ergo.sign_data(address, message)
    } catch (error) {
      console.error('Error signing message:', error)
      throw error
    }
  }, [])

  const getChangeAddress = useCallback(async (): Promise<string> => {
    const { ergo, ergoConnector } = window

    if (!ergo || !ergoConnector) {
      throw new Error('Ergo object not found')
    }

    // Double check connection before proceeding
    const isWalletConnected = await ergoConnector.nautilus.isConnected()
    if (!isWalletConnected) {
      throw new Error('Wallet not connected')
    }

    try {
      return await ergo.get_change_address()
    } catch (error) {
      console.error('Error getting change address:', error)
      throw error
    }
  }, [])

  const getBalance = useCallback(async (): Promise<Array<{ tokenId: string; balance: string }>> => {
    const { ergo, ergoConnector } = window

    if (!ergo || !ergoConnector) {
      throw new Error('Ergo object not found')
    }

    // Double check connection before proceeding
    const isWalletConnected = await ergoConnector.nautilus.isConnected()
    if (!isWalletConnected) {
      throw new Error('Wallet not connected')
    }

    try {
      // Get ERG balance
      const balance = await ergo.get_balance('all') as Array<{ tokenId: string; balance: string }>

      return balance
    } catch (error) {
      console.error('Error getting balance:', error)
      throw error
    }
  }, [])

  const getUtxos = useCallback(async (): Promise<any[]> => {
    const { ergo, ergoConnector } = window
    if (!ergo || !ergoConnector) {
      throw new Error('Ergo object not found')
    }
    try {
      return await ergo.get_utxos()
    } catch (error) {
      console.error('Error getting utxos:', error)
      throw error
    }
  }, [])

  const SignAndSubmitTx = useCallback(async (tx: any): Promise<any> => {
    // not tested yet, sdk not working on testnet
    const { ergo, ergoConnector } = window
    if (!ergo || !ergoConnector) {
      throw new Error('Ergo object not found')
    }
    try {
      const signedTx = await ergo.sign_tx(tx)
      console.log('signed tx', signedTx)
      const submittedTx = await ergo.submit_tx(signedTx)
      console.log('submitted tx', submittedTx)
      return submittedTx
    } catch (error) {
      console.error('Error signing and submitting transaction:', error)
      throw error
    }
  }, [])

  return (
    <ErgoContext.Provider
      value={{
        walletList,
        isConnected,
        connect,
        disconnect,
        getChangeAddress,
        getBalance,
        signMessage,
        getUtxos,
        SignAndSubmitTx,
        ergoWallet
      }}
    >
      {children}
    </ErgoContext.Provider>
  )
}

export function useErgo() {
  const context = useContext(ErgoContext)
  if (!context) {
    throw new Error('useErgo must be used within an ErgoProvider')
  }
  return context
}