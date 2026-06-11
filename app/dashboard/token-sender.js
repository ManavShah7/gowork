'use client'
import { useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function TokenSender() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    const sendTokenToExtension = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      try {
        if (window.chrome?.runtime) {
          window.chrome.runtime.sendMessage(
            'lhedddbceajlaamnjcioapaihbdnmbbg',
            { type: 'SET_TOKEN', token: session.access_token },
            (response) => {
              if (chrome.runtime.lastError) return
              console.log('GoWork extension connected:', response)
            }
          )
        }
      } catch {}
    }
    sendTokenToExtension()
  }, [])

  return null
}