'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase'

export default function SignOut() {
  const router = useRouter()
  const supabase = createBrowserSupabase()

  useEffect(() => {
    supabase.auth.signOut().then(() => router.push('/'))
  }, [])

  return (
    <div className="min-h-screen bg-[#F7F6F2] flex items-center justify-center">
      <p className="text-[14px] text-[#6B6B6B]">Signing out...</p>
    </div>
  )
}