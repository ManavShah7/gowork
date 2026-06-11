'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

// Statuses that count as "you actually applied" (vs. just saved / in progress).
const APPLIED_STATUSES = ['applied', 'oa', 'interview', 'final_round', 'offer', 'rejected', 'withdrawn']
const RESPONDED_STATUSES = ['oa', 'interview', 'final_round', 'offer']

function StatCard({ label, value, sub }) {
  return (
    <div className="flex-1 bg-white border border-[#E5E5E5] rounded-2xl p-4">
      <p className="text-[11px] text-[#ADADAD] font-medium uppercase tracking-widest mb-1">{label}</p>
      <p className="text-[28px] font-semibold text-[#0A0A0A] tracking-tight leading-none mb-1">{value}</p>
      {sub && <p className="text-[12px] text-[#6B6B6B]">{sub}</p>}
    </div>
  )
}

function postedLabel(iso, now) {
  if (!iso) return null
  const hrs = Math.floor((now - new Date(iso).getTime()) / 3600000)
  if (hrs < 1) return 'Just now'
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function JobCard({ job, now }) {
  const label = postedLabel(job.posted, now)
  return (
    <div
      onClick={() => job.url && window.open(job.url, '_blank')}
      className="flex items-center justify-between p-4 border border-[#E5E5E5] rounded-2xl hover:border-[#ADADAD] transition-colors cursor-pointer">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-[#F5F4F0] flex items-center justify-center text-[13px] font-semibold text-[#0A0A0A] flex-shrink-0">
          {job.company?.[0]?.toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[#0A0A0A] truncate">{job.title}</p>
          <p className="text-[12px] text-[#ADADAD] truncate">{job.company}{job.location ? ` · ${job.location}` : ''}</p>
          {job.reason && <p className="text-[11px] text-[#6B6B6B] truncate mt-0.5">{job.reason}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {typeof job.match === 'number' && (
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[#2D5219]" />
            <span className="text-[13px] font-semibold text-[#2D5219]">{job.match}%</span>
          </div>
        )}
        {label && <span className="text-[11px] text-[#ADADAD]">{label}</span>}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [profile, setProfile] = useState(null)
  const [user, setUser] = useState(null)
  const [apps, setApps] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(false)
  const [nowTs, setNowTs] = useState(0)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUser(user)
      setNowTs(Date.now())

      const [profileRes, appsRes, jobsRes] = await Promise.all([
        supabase.from('intelligence_profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('applications').select('status, applied_at').eq('user_id', user.id),
        // Ranked matches from the shared matching pipeline (fast: pgvector + DNA,
        // GPT scores reused from cache — no live GPT on load).
        fetch('/api/jobs').then(r => r.ok ? r.json() : { jobs: [] }).catch(() => ({ jobs: [] })),
      ])

      setProfile(profileRes.data || null)
      setApps(appsRes.data || [])
      setJobs((jobsRes.jobs || []).slice(0, 5))
      setLoading(false)
      setTimeout(() => setVisible(true), 80)
    }
    load()
  }, [])

  const firstName = user?.user_metadata?.full_name?.split(' ')[0]
    || user?.email?.split('@')[0]
    || 'there'

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const weekAgo = nowTs - 7 * 24 * 3600 * 1000
  const appliedThisWeek = apps.filter(a => a.applied_at && new Date(a.applied_at).getTime() > weekAgo).length
  const totalApplied = apps.filter(a => APPLIED_STATUSES.includes(a.status)).length
  const savedJobs = apps.filter(a => a.status === 'saved').length
  const responded = apps.filter(a => RESPONDED_STATUSES.includes(a.status)).length
  const responseRate = totalApplied > 0 ? `${Math.round((responded / totalApplied) * 100)}%` : '—'

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#E5E5E5" strokeWidth="3" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="#2D5219" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  )

  return (
    <>
      <style>{`
        .fade { opacity: 0; transform: translateY(12px); animation: fadeUp 0.4s ease forwards; }
        @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }
        .d1{animation-delay:.05s}.d2{animation-delay:.1s}.d3{animation-delay:.15s}
        .d4{animation-delay:.2s}.d5{animation-delay:.25s}
      `}</style>

      <div className="px-8 py-7">
        <div className="max-w-[900px] mx-auto space-y-4">

          {/* Weekly progress */}
          {visible && (
            <div className="fade d1 flex gap-3">
              <StatCard label="Applied this week" value={appliedThisWeek} sub={appliedThisWeek ? 'Keep the momentum going' : 'Start applying to track progress'} />
              <StatCard label="Total applied" value={totalApplied} sub="All-time applications" />
              <StatCard label="Saved jobs" value={savedJobs} sub="Roles you bookmarked" />
              <StatCard label="Response rate" value={responseRate} sub="Replies per application" />
            </div>
          )}

          {/* Greeting */}
          {visible && (
            <div className="fade d2 bg-white border border-[#E5E5E5] rounded-2xl p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-[22px] font-semibold text-[#0A0A0A] tracking-tight mb-1">
                    {greeting}, {firstName}.
                  </h1>
                  <p className="text-[14px] text-[#6B6B6B]">
                    {profile
                      ? `Your profile is set up as a ${profile.primary_role}. Here is what is new today.`
                      : 'Your dashboard is ready. Complete your profile to get personalized matches.'}
                  </p>
                </div>
                {profile?.primary_role && (
                  <div className="flex items-center gap-2 bg-[#F4F9F0] border border-[#C8E0BC] px-3 py-1.5 rounded-full flex-shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#2D5219]" />
                    <span className="text-[12px] font-medium text-[#2D5219]">{profile.primary_role}</span>
                  </div>
                )}
              </div>
              {profile?.industries?.length > 0 && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[#F0F0F0]">
                  <span className="text-[11px] text-[#ADADAD]">Top industries</span>
                  {profile.industries.slice(0, 3).map((ind, i) => (
                    <span key={i} className="text-[11px] text-[#6B6B6B] bg-[#F5F4F0] px-2.5 py-1 rounded-full">{ind}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Jobs posted in last 24h */}
          {visible && (
            <div className="fade d3 bg-white border border-[#E5E5E5] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[15px] font-semibold text-[#0A0A0A]">Top matches for you</h2>
                  <p className="text-[12px] text-[#ADADAD] mt-0.5">Roles scored against your profile</p>
                </div>
                <button onClick={() => router.push('/dashboard/opportunities')}
                  className="text-[12px] text-[#2D5219] font-medium hover:underline">
                  View all
                </button>
              </div>
              {jobs.length > 0 ? (
                <div className="space-y-2">
                  {jobs.map((job) => <JobCard key={job.id} job={job} now={nowTs} />)}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <p className="text-[13px] text-[#6B6B6B]">No matches yet.</p>
                  <p className="text-[12px] text-[#ADADAD] mt-1">Complete your profile and GoWork will score roles against it — check back soon.</p>
                </div>
              )}
            </div>
          )}

          {/* Bottom row */}
          <div className="grid grid-cols-2 gap-4">
            {visible && (
              <div className="fade d4 bg-white border border-[#E5E5E5] rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-xl bg-[#F4F9F0] flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="#2D5219" strokeWidth="1.5" />
                      <path d="M12 8v4l3 3" stroke="#2D5219" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="text-[13px] font-semibold text-[#0A0A0A]">Mentor advice</p>
                  <span className="text-[10px] font-medium text-[#ADADAD] bg-[#F5F4F0] px-2 py-0.5 rounded-full ml-auto">Coming soon</span>
                </div>
                <div className="flex flex-col items-center justify-center h-24 text-center">
                  <p className="text-[13px] text-[#ADADAD]">Personalized guidance from mentors in your field</p>
                  <p className="text-[12px] text-[#ADADAD] mt-1">Launching soon</p>
                </div>
              </div>
            )}

            {visible && (
              <div className="fade d5 bg-white border border-[#E5E5E5] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[13px] font-semibold text-[#0A0A0A]">Notes & reminders</p>
                  <span className="text-[10px] font-medium text-[#ADADAD] bg-[#F5F4F0] px-2 py-0.5 rounded-full">Coming soon</span>
                </div>
                <div className="flex flex-col items-center justify-center h-24 text-center">
                  <p className="text-[13px] text-[#ADADAD]">No notes yet</p>
                  <p className="text-[12px] text-[#ADADAD] mt-1">Add reminders, deadlines, or thoughts</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
