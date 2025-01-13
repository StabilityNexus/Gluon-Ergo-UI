import "@/styles/globals.css"
import type { AppProps } from "next/app"
import { TopNavbar } from "@/lib/components/layout/TopNavbar"
import { Providers } from "@/lib/providers/Providers"
import { Geist, Geist_Mono } from "next/font/google"

const geist = Geist({ 
  subsets: ['latin'],
  variable: '--font-geist',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Providers>
      <div className={`${geist.variable} ${geistMono.variable} min-h-screen font-sans antialiased`}>
        <TopNavbar />
        <div className="max-w-[84rem] mx-auto px-4 sm:px-6 lg:px-8">
          <main className="py-8">
            <Component {...pageProps} />
          </main>
        </div>
      </div>
    </Providers>
  )
}