'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const JOB_TYPES = [
  { value: 'internship', label: 'Internship' },
  { value: 'fulltime', label: 'Full-time' },
  { value: 'coop', label: 'Co-op' },
  { value: 'contract', label: 'Contract' },
]

function timeAgo(iso) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function AutoPilotPage() {
  const router = useRouter()
  const [settings, setSettings] = useState({
    enabled: false,
    match_threshold: 80,
    daily_limit: 5,
    job_types: ['internship', 'fulltime'],
    blacklisted_companies: [],
  })
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [blacklistInput, setBlacklistInput] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const [settingsRes, queueRes] = await Promise.all([
        fetch('/api/auto-apply/settings'),
        supabase.from('apply_queue').select('*').eq('user_id', user.id).order('queued_at', { ascending: false }).limit(20)
      ])

      if (settingsRes.ok) {
        const data = await settingsRes.json()
        if (data && !data.error) setSettings(prev => ({ ...prev, ...data }))
      }

      setQueue(queueRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const toggle = async () => {
    setToggling(true)
    const next = { ...settings, enabled: !settings.enabled }
    const res = await fetch('/api/auto-apply/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next)
    })
    if (res.ok) setSettings(next)
    setToggling(false)
  }

  const save = async () => {
    setSaving(true)
    await fetch('/api/auto-apply/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })
    setSaving(false)
  }

  const addBlacklist = () => {
    const val = blacklistInput.trim()
    if (!val) return
    setSettings(s => ({ ...s, blacklisted_companies: [...(s.blacklisted_companies || []), val] }))
    setBlacklistInput('')
  }

  const removeBlacklist = (company) => {
    setSettings(s => ({ ...s, blacklisted_companies: s.blacklisted_companies.filter(c => c !== company) }))
  }

  const toggleJobType = (type) => {
    const current = settings.job_types || []
    const next = current.includes(type) ? current.filter(t => t !== type) : [...current, type]
    setSettings(s => ({ ...s, job_types: next }))
  }

  const queueStats = {
    queued: queue.filter(j => j.status === 'queued').length,
    applied: queue.filter(j => j.status === 'applied').length,
    failed: queue.filter(j => j.status === 'failed').length,
  }

  // Gap 6: jobs the worker couldn't auto-submit — surfaced for manual completion
  const fallbackItems = queue.filter(j => j.status === 'fallback_ready')

  // Gap 5: last worker run summary (written by the autopilot service)
  const lastRunAgo = timeAgo(settings.last_run_at)

  const statusColor = {
    queued: { bg: '#EFF6FF', color: '#2563EB' },
    applied: { bg: '#F4F9F0', color: '#2D5219' },
    failed: { bg: '#FEF2F2', color: '#DC2626' },
    processing: { bg: '#FFFBEB', color: '#B45309' },
    skipped: { bg: '#F5F4F0', color: '#9B9B9B' },
    fallback_ready: { bg: '#FFFBEB', color: '#B45309' },
  }

  const statusLabel = { fallback_ready: 'needs you' }

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#E5E5E5" strokeWidth="3"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke="#2D5219" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    </div>
  )

  return (
    <div className="px-8 py-7">
      <div className="max-w-[720px] mx-auto">

          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-[22px] font-semibold text-[#0A0A0A] tracking-tight">Auto-pilot</h1>
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${settings.enabled ? 'bg-[#F4F9F0] text-[#2D5219]' : 'bg-[#F5F4F0] text-[#9B9B9B]'}`}>
                  {settings.enabled ? '⚡ Active' : 'Off'}
                </span>
              </div>
              <p className="text-[13px] text-[#6B6B6B]">GoWork finds and applies to matching jobs while you sleep.</p>
            </div>
            <button onClick={toggle} disabled={toggling}
              className={`h-10 px-6 rounded-xl text-[13px] font-medium transition-all ${settings.enabled ? 'bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FEE2E2]' : 'bg-[#2D5219] text-white hover:bg-[#3A6B22]'} disabled:opacity-50`}>
              {toggling ? '...' : settings.enabled ? 'Turn off' : 'Turn on'}
            </button>
          </div>

          {/* How it works — only shown when off */}
          {!settings.enabled && (
            <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 mb-6">
              <h2 className="text-[14px] font-semibold text-[#0A0A0A] mb-4">How it works</h2>
              <div className="space-y-4">
                {[
                  { n: '1', title: 'We find matching jobs', desc: 'GoWork scans new job postings every 30 minutes and scores them against your profile.' },
                  { n: '2', title: 'High matches get queued', desc: 'Only jobs above your match threshold get queued for application.' },
                  { n: '3', title: 'We apply automatically', desc: 'Our server opens the job page, fills the form, attaches your resume, and submits — no browser needed.' },
                  { n: '4', title: 'You get notified', desc: 'Email confirmation for every application with match score and company details.' },
                ].map(({ n, title, desc }) => (
                  <div key={n} className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-[#F5F4F0] flex items-center justify-center text-[11px] font-semibold text-[#0A0A0A] flex-shrink-0 mt-0.5">{n}</div>
                    <div>
                      <p className="text-[13px] font-medium text-[#0A0A0A]">{title}</p>
                      <p className="text-[12px] text-[#6B6B6B] mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats — only shown when on */}
          {settings.enabled && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'In queue', value: queueStats.queued, color: '#2563EB' },
                { label: 'Applied', value: queueStats.applied, color: '#2D5219' },
                { label: 'Failed', value: queueStats.failed, color: '#DC2626' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white border border-[#E5E5E5] rounded-2xl p-5">
                  <p className="text-[11px] text-[#ADADAD] uppercase tracking-widest mb-2">{label}</p>
                  <p className="text-[28px] font-semibold tracking-tight" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Gap 5: worker status — last autopilot run */}
          {settings.enabled && (
            <div className="bg-white border border-[#E5E5E5] rounded-2xl px-6 py-4 mb-6 flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${lastRunAgo ? 'bg-[#2D5219]' : 'bg-[#D4A017]'}`} />
              <div className="flex-1 min-w-0">
                {lastRunAgo ? (
                  <>
                    <p className="text-[13px] font-medium text-[#0A0A0A]">
                      Last run {lastRunAgo}
                      {typeof settings.last_run_count === 'number' && ` · ${settings.last_run_count} application${settings.last_run_count === 1 ? '' : 's'} sent`}
                    </p>
                    {settings.last_run_summary && (
                      <p className="text-[12px] text-[#6B6B6B] mt-0.5 truncate">{settings.last_run_summary}</p>
                    )}
                  </>
                ) : (
                  <p className="text-[13px] text-[#6B6B6B]">Autopilot is on — it’ll run within the next 15 minutes and start queuing matches.</p>
                )}
              </div>
            </div>
          )}

          {/* Settings */}
          <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 mb-6">
            <h2 className="text-[14px] font-semibold text-[#0A0A0A] mb-5">Settings</h2>

            <div className="space-y-6">
              {/* Match threshold */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-[13px] font-medium text-[#0A0A0A]">Minimum match score</label>
                  <span className="text-[13px] font-semibold text-[#2D5219]">{settings.match_threshold}%</span>
                </div>
                <input type="range" min="60" max="99" value={settings.match_threshold}
                  onChange={e => setSettings(s => ({ ...s, match_threshold: parseInt(e.target.value) }))}
                  className="w-full accent-[#2D5219]" />
                <div className="flex justify-between mt-1">
                  <span className="text-[11px] text-[#ADADAD]">60% — more apps</span>
                  <span className="text-[11px] text-[#ADADAD]">99% — fewer, better</span>
                </div>
              </div>

              {/* Daily limit */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-[13px] font-medium text-[#0A0A0A]">Max applications per day</label>
                  <span className="text-[13px] font-semibold text-[#2D5219]">{settings.daily_limit}</span>
                </div>
                <input type="range" min="1" max="20" value={settings.daily_limit}
                  onChange={e => setSettings(s => ({ ...s, daily_limit: parseInt(e.target.value) }))}
                  className="w-full accent-[#2D5219]" />
                <div className="flex justify-between mt-1">
                  <span className="text-[11px] text-[#ADADAD]">1 — very selective</span>
                  <span className="text-[11px] text-[#ADADAD]">20 — maximum</span>
                </div>
              </div>

              {/* Job types */}
              <div>
                <label className="text-[13px] font-medium text-[#0A0A0A] block mb-2">Job types</label>
                <div className="flex gap-2 flex-wrap">
                  {JOB_TYPES.map(opt => (
                    <button key={opt.value} onClick={() => toggleJobType(opt.value)}
                      className={`h-8 px-4 rounded-xl text-[12px] font-medium border transition-all ${(settings.job_types || []).includes(opt.value) ? 'bg-[#2D5219] text-white border-[#2D5219]' : 'bg-white text-[#0A0A0A] border-[#E5E5E5] hover:border-[#ADADAD]'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Blacklist */}
              <div>
                <label className="text-[13px] font-medium text-[#0A0A0A] block mb-2">Never apply to</label>
                <div className="flex gap-2 mb-2">
                  <input value={blacklistInput} onChange={e => setBlacklistInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addBlacklist()}
                    placeholder="Company name..."
                    className="flex-1 h-9 px-3 text-[13px] border border-[#E5E5E5] rounded-xl outline-none focus:border-[#2D5219]" />
                  <button onClick={addBlacklist}
                    className="h-9 px-4 bg-[#F5F4F0] text-[#0A0A0A] text-[13px] rounded-xl hover:bg-[#EDEDEB] border border-[#E5E5E5]">
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(settings.blacklisted_companies || []).map(company => (
                    <span key={company} className="flex items-center gap-1.5 h-7 px-3 bg-[#FEF2F2] text-[#DC2626] text-[12px] rounded-full border border-[#FECACA]">
                      {company}
                      <button onClick={() => removeBlacklist(company)} className="hover:text-[#B91C1C]">✕</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={save} disabled={saving}
              className="mt-6 h-10 px-6 bg-[#2D5219] text-white text-[13px] font-medium rounded-xl hover:bg-[#3A6B22] disabled:opacity-50">
              {saving ? 'Saving...' : 'Save settings'}
            </button>
          </div>

          {/* Gap 6: fallback_ready — worker couldn't finish, needs manual completion */}
          {fallbackItems.length > 0 && (
            <div className="bg-white border border-[#FCD34D] rounded-2xl overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-[#FEF3C7] bg-[#FFFBEB]">
                <div className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="#B45309" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <h2 className="text-[14px] font-semibold text-[#92400E]">Needs your attention</h2>
                </div>
                <p className="text-[12px] text-[#B45309] mt-0.5">GoWork prepared these but couldn’t submit automatically — finish them in a click.</p>
              </div>
              <div className="divide-y divide-[#FEF3C7]">
                {fallbackItems.map(job => (
                  <div key={job.id} className="flex items-center gap-4 px-6 py-3">
                    <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] flex items-center justify-center text-[12px] font-semibold text-[#92400E] flex-shrink-0">
                      {job.company?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#0A0A0A] truncate">{job.role}</p>
                      <p className="text-[11px] text-[#ADADAD]">
                        {job.company}{typeof job.match_score === 'number' && ` · ${job.match_score}% match`}
                        {job.error && ` · ${job.error}`}
                      </p>
                    </div>
                    {job.job_url && (
                      <a href={job.job_url} target="_blank" rel="noopener noreferrer"
                        className="h-8 px-4 flex items-center bg-[#B45309] text-white text-[12px] font-medium rounded-xl hover:bg-[#92400E] flex-shrink-0">
                        Finish application
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Queue */}
          {queue.length > 0 && (
            <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#F0F0F0]">
                <h2 className="text-[14px] font-semibold text-[#0A0A0A]">Application queue</h2>
                <p className="text-[12px] text-[#ADADAD] mt-0.5">Jobs GoWork has queued or applied to</p>
              </div>
              <div className="divide-y divide-[#F5F5F5]">
                {queue.map(job => (
                  <div key={job.id} className="flex items-center gap-4 px-6 py-3">
                    <div className="w-8 h-8 rounded-lg bg-[#F5F4F0] flex items-center justify-center text-[12px] font-semibold text-[#0A0A0A] flex-shrink-0">
                      {job.company?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#0A0A0A] truncate">{job.role}</p>
                      <p className="text-[11px] text-[#ADADAD]">{job.company} · {job.match_score}% match</p>
                    </div>
                    <span className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                      style={{ background: statusColor[job.status]?.bg || '#F5F4F0', color: statusColor[job.status]?.color || '#9B9B9B' }}>
                      {statusLabel[job.status] || job.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
  )
}