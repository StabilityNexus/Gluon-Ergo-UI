'use client'
import { useEffect, useState } from 'react'
import { ErgoProvider } from './ErgoProvider'
import { ThemeProvider } from './theme-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => {
      console.log('🧹 Cleaning up BlockchainProviders')
    }
  }, [])

  if (!mounted) return null

  return (
    <ThemeProvider
    attribute="class"
    defaultTheme="system"
    enableSystem
    disableTransitionOnChange
  >
            <ErgoProvider>
             {children}
            </ErgoProvider>
    </ThemeProvider>
  )
}