'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase'

export default function AutopilotPage() {
  const router = useRouter()
  const supabase = createBrowserSupabase()
  const [enabling, setEnabling] = useState(false)
  const [threshold, setThreshold] = useState(75)
  const [dailyLimit, setDailyLimit] = useState(5)

  const handleEnable = async () => {
    setEnabling(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    await supabase.from('auto_apply_settings').upsert({
      user_id: user.id,
      enabled: true,
      match_threshold: threshold,
      daily_limit: dailyLimit,
      job_types: ['internship', 'fulltime'],
      blacklisted_companies: [],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    router.push('/dashboard')
  }

  const handleSkip = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    await supabase.from('auto_apply_settings').upsert({
      user_id: user.id,
      enabled: false,
      match_threshold: threshold,
      daily_limit: dailyLimit,
      job_types: ['internship', 'fulltime'],
      blacklisted_companies: [],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#F7F6F2] flex flex-col items-center justify-center px-4 py-12">

      {/* Steps */}
      <div className="flex items-center justify-center gap-2 mb-10">
        {['Resume', 'Details', 'Autopilot'].map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-medium ${
                i < 2 ? 'bg-[#2D5219] text-white' : 'bg-[#2D5219] text-white'
              }`}>
                {i < 2 ? '✓' : '3'}
              </div>
              <span className="text-[13px] text-[#0A0A0A]">{step}</span>
            </div>
            {i < 2 && <div className="w-8 h-px bg-[#E5E5E5]" />}
          </div>
        ))}
      </div>

      <div className="w-full max-w-[520px]">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-[#0A0A0A] rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-[28px] font-semibold text-[#0A0A0A] tracking-tight mb-3">
            Turn on Autopilot
          </h1>
          <p className="text-[14px] text-[#6B6B6B] leading-relaxed">
            GoWork finds matching jobs and applies for you automatically — no browser needed.
          </p>
        </div>

        {/* How it works */}
        <div className="space-y-3 mb-6">
          {[
            { icon: '🔍', title: 'Scans jobs every 30 minutes', desc: 'New postings from Greenhouse and Lever.' },
            { icon: '⚡', title: 'Applies within minutes of posting', desc: 'First in the pile before hundreds of other applicants.' },
            { icon: '📄', title: 'Fills the entire form', desc: 'Resume, cover letter, EEO, open questions — all handled by AI.' },
            { icon: '✉️', title: 'Emails you every time', desc: 'You\'ll know exactly what was applied to and when.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="flex gap-4 p-4 bg-white border border-[#E5E5E5] rounded-2xl">
              <span className="text-[20px] flex-shrink-0">{icon}</span>
              <div>
                <p className="text-[13px] font-medium text-[#0A0A0A]">{title}</p>
                <p className="text-[12px] text-[#6B6B6B] mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Settings */}
        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 mb-4 space-y-5">
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-[13px] font-medium text-[#0A0A0A]">Minimum match score</label>
              <span className="text-[13px] font-semibold text-[#2D5219]">{threshold}%</span>
            </div>
            <input
              type="range" min="60" max="95" value={threshold}
              onChange={e => setThreshold(parseInt(e.target.value))}
              className="w-full accent-[#2D5219]"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[11px] text-[#ADADAD]">60% — more applications</span>
              <span className="text-[11px] text-[#ADADAD]">95% — fewer, better</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-[13px] font-medium text-[#0A0A0A]">Max applications per day</label>
              <span className="text-[13px] font-semibold text-[#2D5219]">{dailyLimit}</span>
            </div>
            <input
              type="range" min="1" max="15" value={dailyLimit}
              onChange={e => setDailyLimit(parseInt(e.target.value))}
              className="w-full accent-[#2D5219]"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[11px] text-[#ADADAD]">1 — very selective</span>
              <span className="text-[11px] text-[#ADADAD]">15 — maximum</span>
            </div>
          </div>
        </div>

        {/* Note */}
        <div className="bg-[#F4F9F0] border border-[#C8E0BC] rounded-2xl p-4 mb-6">
          <p className="text-[12px] text-[#2D5219] leading-relaxed">
            <strong>You stay in control.</strong> Adjust your threshold, daily limit, and blacklisted companies anytime from your dashboard. Turn it off whenever you want.
          </p>
        </div>

        {/* Buttons */}
        <button
          onClick={handleEnable}
          disabled={enabling}
          className="w-full h-12 bg-[#2D5219] text-white rounded-xl text-[14px] font-medium hover:bg-[#3A6B22] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mb-3"
        >
          {enabling ? (
            <>
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.3"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              </svg>
              Turning on...
            </>
          ) : '⚡ Turn on Autopilot'}
        </button>

        <button
          onClick={handleSkip}
          className="w-full h-11 border border-[#E5E5E5] text-[#6B6B6B] rounded-xl text-[13px] hover:bg-white transition-colors"
        >
          Skip for now — I'll do it manually
        </button>

        <p className="text-center text-[11px] text-[#ADADAD] mt-4">
          You can always change this in Dashboard → Auto-pilot
        </p>

      </div>
    </div>
  )
}