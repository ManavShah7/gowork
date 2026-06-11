'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

// Canonical nav — single source of truth for the whole dashboard.
const NAV = [
  { label: 'Home', path: '/dashboard', icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
  { label: 'Tracker', path: '/dashboard/tracker', icon: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2' },
  { label: 'Auto-pilot', path: '/dashboard/auto-pilot', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { label: 'Profile', path: '/dashboard/profile', icon: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z' },
]

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null))
  }, [])

  const firstName = user?.user_metadata?.full_name?.split(' ')[0]
    || user?.email?.split('@')[0]
    || ''

  const isActive = (path) =>
    path === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(path)

  return (
    <div className="w-56 flex-shrink-0 bg-white border-r border-[#E5E5E5] flex flex-col py-5 px-3">
      <div className="flex items-center gap-2 px-3 mb-6">
        <div className="w-6 h-6 bg-[#0A0A0A] rounded-lg" />
        <span className="text-[15px] font-semibold text-[#0A0A0A] tracking-tight">GoWork</span>
      </div>

      <nav className="flex flex-col gap-0.5 flex-1">
        {NAV.map((item) => {
          const active = isActive(item.path)
          return (
            <button key={item.path} onClick={() => router.push(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                active ? 'bg-[#2D5219] text-white' : 'text-[#6B6B6B] hover:bg-[#F5F4F0] hover:text-[#0A0A0A]'
              }`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d={item.icon} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {item.label}
            </button>
          )
        })}
      </nav>

      {user && (
        <div className="flex items-center gap-2.5 px-3 pt-4 border-t border-[#E5E5E5] mt-4">
          <div className="w-7 h-7 rounded-full bg-[#2D5219] flex items-center justify-center text-[11px] font-semibold text-white">
            {firstName[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-[#0A0A0A] truncate">{firstName}</p>
            <p className="text-[11px] text-[#ADADAD] truncate">{user.email}</p>
          </div>
        </div>
      )}
    </div>
  )
}
