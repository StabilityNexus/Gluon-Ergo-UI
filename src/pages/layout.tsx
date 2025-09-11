import React from 'react'

export default function ReactorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className='flex mt-8 gap-6 xl:gap-8'>
      <main className='flex-1 min-w-0'>{children}</main>
    </div>
  )
}
