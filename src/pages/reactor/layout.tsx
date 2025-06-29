import React from 'react'
import { ReactorSidebar } from '@/lib/components/layout/ReactorSidebar'


export default function ReactorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className='flex mt-20 gap-6 xl:gap-8'>
      <ReactorSidebar />
      <main className='flex-1 min-w-0'>{children}</main>
    </div>
  )
}