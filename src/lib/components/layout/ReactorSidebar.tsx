import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Grip, ArrowDownUp } from 'lucide-react'

const ispoLinks = [
  { href: '/reactor', label: 'Dashboard', icon: Grip },
  { href: '/reactor/swap', label: 'Swap', icon: ArrowDownUp },
]

export function ReactorSidebar() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleMenu = () => setIsOpen(!isOpen)

  return (
    <>
      {/* Desktop Sidebar */}
      <nav className='bg-card border border-border rounded-lg px-6 py-4 font-semibold h-fit hidden md:block'>
        <ul className='flex flex-col space-y-2'>
          {ispoLinks.map((link, index) => (
            <motion.li
              key={link.href}
              initial={mounted ? { opacity: 0, x: -20 } : false}
              animate={mounted ? { opacity: 1, x: 0 } : false}
              transition={{ delay: index * 0.1 }}>
              <Link
                href={link.href}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-colors ${router.pathname === link.href ? 'text-primary bg-primary/10 ' : 'hover:bg-muted'
                  }`}>
                <link.icon size={18} />
                <span>{link.label}</span>
              </Link>
            </motion.li>
          ))}
        </ul>
      </nav>

      {/* Mobile FAB */}
      <motion.div
        className='fixed right-4 bottom-20 z-50 md:hidden'
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}>
        <motion.button
          className='bg-primary text-primary-foreground rounded-full p-3 shadow-lg'
          onClick={toggleMenu}
          whileTap={{ scale: 0.9 }}>
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </motion.button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              className='absolute right-0 bottom-16 bg-card border border-border rounded-lg shadow-lg gap-2'
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}>
              <ul className='p-4'>
                {ispoLinks.map(link => (
                  <motion.li key={link.href} whileTap={{ scale: 0.95 }}>
                    <Link
                      href={link.href}
                      className={`flex items-center space-x-2 px-4 py-2 rounded transition-colors ${router.pathname === link.href
                          ? 'text-primary bg-primary/10'
                          : 'hover:bg-muted'
                        }`}
                      onClick={toggleMenu}>
                      <link.icon size={18} />
                      <span>{link.label}</span>
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  )
}