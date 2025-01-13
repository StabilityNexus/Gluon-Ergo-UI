import React from 'react'
import { ReactorSidebar } from '@/lib/components/layout/ReactorSidebar'


export default function ReactorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className='flex mt-20 gap-6'>
      <ReactorSidebar />
      <main className='flex-1'>{children}</main>
    </div>
  )
}