cat > app/page.js << 'EOF'
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createBrowserSupabase()

  const handleGoogle = async () => {
    setLoading(true)
    setError('')
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (mode === 'signup') {
      if (!name.trim()) { setError('Enter your name'); setLoading(false); return }
      const { error } = await supabase.auth.signUp({
        email, password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })
      if (error) setError(error.message)
      else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (!signInError) router.push('/onboarding/resume')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else router.push('/onboarding/resume')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#F7F6F2] flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-8 h-8 bg-[#0A0A0A] rounded-xl" />
          <span className="text-[18px] font-semibold text-[#0A0A0A] tracking-tight">GoWork</span>
        </div>
        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-8 shadow-sm">
          <h1 className="text-[20px] font-semibold text-[#0A0A0A] mb-1 tracking-tight">
            {mode === 'signin' ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="text-[13px] text-[#9B9B9B] mb-6">
            {mode === 'signin' ? 'Sign in to GoWork' : 'Start applying on autopilot'}
          </p>
          <button onClick={handleGoogle} disabled={loading}
            className="w-full h-11 border border-[#E5E5E5] rounded-xl flex items-center justify-center gap-3 text-[13px] font-medium hover:bg-[#F7F6F2] transition-colors mb-4 disabled:opacity-50">
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-[#E5E5E5]" />
            <span className="text-[11px] text-[#ADADAD]">or</span>
            <div className="flex-1 h-px bg-[#E5E5E5]" />
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Full name" required
                className="w-full h-10 px-3 text-[13px] text-[#0A0A0A] border border-[#E5E5E5] rounded-xl outline-none focus:border-[#2D5219] placeholder:text-[#DADADA]" />
            )}
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Email" required
              className="w-full h-10 px-3 text-[13px] text-[#0A0A0A] border border-[#E5E5E5] rounded-xl outline-none focus:border-[#2D5219] placeholder:text-[#DADADA]" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Password" required
              className="w-full h-10 px-3 text-[13px] text-[#0A0A0A] border border-[#E5E5E5] rounded-xl outline-none focus:border-[#2D5219] placeholder:text-[#DADADA]" />
            {error && <p className="text-[12px] text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            {success && <p className="text-[12px] text-[#2D5219] bg-[#F4F9F0] px-3 py-2 rounded-lg">{success}</p>}
            <button type="submit" disabled={loading}
              className="w-full h-11 bg-[#2D5219] text-white rounded-xl text-[13px] font-medium hover:bg-[#3A6B22] transition-colors disabled:opacity-50">
              {loading ? 'Loading...' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>
          <p className="text-center text-[12px] text-[#9B9B9B] mt-4">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setSuccess('') }}
              className="text-[#2D5219] font-medium hover:underline">
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
EOF