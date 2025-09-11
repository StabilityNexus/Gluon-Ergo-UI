import "@/styles/globals.css"
import type { AppProps } from "next/app"
import { TopNavbar } from "@/lib/components/layout/TopNavbar"
import { Providers } from "@/lib/providers/Providers"
import { DM_Sans, Plus_Jakarta_Sans, Roboto_Mono } from "next/font/google"
import { Toaster } from "@/lib/components/ui/sonner"
import { BottomNavbar } from "@/lib/components/layout/BottomNavbar"

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
})

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-serif',
})

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Providers>
      <div className={`${dmSans.variable} ${plusJakartaSans.variable} ${robotoMono.variable} min-h-screen font-sans antialiased flex flex-col`}>
        <TopNavbar />
        <div className="flex-1 w-full max-w-[84rem] mx-auto px-4 sm:px-6 lg:px-8">
          <main className="py-8">
            <Component {...pageProps} />
            <Toaster />
          </main>
        </div>
        <BottomNavbar />
      </div>
    </Providers>
  )
}
