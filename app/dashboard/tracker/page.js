'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const STATUS_CONFIG = {
  in_progress:  { label: 'In Progress', bg: '#F0F9FF', color: '#0369A1', border: '#BAE6FD' },
  saved:        { label: 'Saved',        bg: '#F5F4F0', color: '#6B6B6B', border: '#E5E5E5' },
  applied:      { label: 'Applied',      bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
  oa:           { label: 'OA',           bg: '#F5F3FF', color: '#7C3AED', border: '#DDD6FE' },
  interview:    { label: 'Interview',    bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' },
  final_round:  { label: 'Final Round',  bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
  offer:        { label: 'Offer',        bg: '#F4F9F0', color: '#2D5219', border: '#C8E0BC' },
  rejected:     { label: 'Rejected',     bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
  withdrawn:    { label: 'Withdrawn',    bg: '#F5F4F0', color: '#9B9B9B', border: '#E5E5E5' },
}

const STATUSES = Object.keys(STATUS_CONFIG)
const SOURCE_OPTIONS = ['LinkedIn', 'Handshake', 'Company Site', 'Referral', 'GoWork', 'Indeed', 'Other']

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.applied
  return (
    <span className="inline-flex items-center rounded-full font-medium border px-2.5 py-0.5 text-[11px]"
      style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
      {cfg.label}
    </span>
  )
}

function InsightCard({ title, value, sub, trend, icon, color = '#2D5219', loading }) {
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 flex flex-col justify-between min-h-[120px]">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-semibold text-[#ADADAD] uppercase tracking-widest">{title}</p>
        <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: color + '18' }}>
          <span style={{ color }}>{icon}</span>
        </div>
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-6 bg-[#F5F4F0] rounded-lg w-16 animate-pulse" />
          <div className="h-3 bg-[#F5F4F0] rounded-full w-32 animate-pulse" />
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <p className="text-[26px] font-semibold text-[#0A0A0A] tracking-tight leading-none">{value}</p>
            {trend !== undefined && trend !== 0 && (
              <span className={`text-[12px] font-medium ${trend > 0 ? 'text-[#2D5219]' : 'text-red-500'}`}>
                {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
              </span>
            )}
          </div>
          <p className="text-[12px] text-[#6B6B6B] mt-1 leading-relaxed">{sub}</p>
        </>
      )}
    </div>
  )
}

function computeInsights(apps) {
  if (!apps.length) return null
  const now = new Date()
  const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000)
  const thisWeek = apps.filter(a => new Date(a.applied_at) > oneWeekAgo).length
  const lastWeek = apps.filter(a => new Date(a.applied_at) > twoWeeksAgo && new Date(a.applied_at) <= oneWeekAgo).length
  const momentumTrend = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : 0
  const strongFit = apps.filter(a => (a.match_score || 0) >= 80).length
  const qualityPct = apps.length > 0 ? Math.round((strongFit / apps.length) * 100) : 0
  const responded = apps.filter(a => ['interview', 'final_round', 'offer', 'oa'].includes(a.status))
  const responseTimes = responded.map(a => a.applied_at ? Math.round((now - new Date(a.applied_at)) / (1000 * 60 * 60 * 24)) : null).filter(Boolean)
  const avgResponseDays = responseTimes.length > 0 ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : null
  const rejectedEarly = apps.filter(a => a.status === 'rejected').length
  const rejectedAfterInterview = apps.filter(a => a.status === 'rejected' && a.notes?.toLowerCase().includes('interview')).length
  const rejectionStage = rejectedEarly > 0 ? (rejectedAfterInterview > rejectedEarly / 2 ? 'Post-interview' : 'Pre-interview') : 'None yet'
  return {
    momentum: { value: thisWeek, sub: `${thisWeek} apps this week${lastWeek ? ', ' + lastWeek + ' last week' : ''}`, trend: momentumTrend },
    quality: { value: qualityPct + '%', sub: `${strongFit} of ${apps.length} are strong fits` },
    timing: { value: avgResponseDays ? avgResponseDays + 'd' : '—', sub: avgResponseDays ? 'Average days to hear back' : 'No responses yet' },
    resume: { value: apps.filter(a => !['saved', 'in_progress'].includes(a.status)).length, sub: 'Active applications submitted' },
    rejection: { value: rejectedEarly, sub: `${rejectionStage} · ${apps.filter(a => a.status === 'offer').length} offers received` },
  }
}

function AddModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    company: '', role: '', location: '', status: 'applied',
    applied_at: new Date().toISOString().split('T')[0],
    source: 'LinkedIn', job_url: '', notes: ''
  })
  const [saving, setSaving] = useState(false)
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const handleSave = async () => {
    if (!form.company || !form.role) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-[480px] mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[16px] font-semibold text-[#0A0A0A]">Add application</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-[#F5F4F0] flex items-center justify-center text-[#6B6B6B] hover:bg-[#EDEDEB]">✕</button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[#6B6B6B] mb-1 block">Company *</label>
              <input value={form.company} onChange={e => update('company', e.target.value)} placeholder="Figma" className="w-full h-10 px-3 text-[13px] border border-[#E5E5E5] rounded-xl outline-none focus:border-[#2D5219]" />
            </div>
            <div>
              <label className="text-[11px] text-[#6B6B6B] mb-1 block">Role *</label>
              <input value={form.role} onChange={e => update('role', e.target.value)} placeholder="Product Design Intern" className="w-full h-10 px-3 text-[13px] border border-[#E5E5E5] rounded-xl outline-none focus:border-[#2D5219]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[#6B6B6B] mb-1 block">Location</label>
              <input value={form.location} onChange={e => update('location', e.target.value)} placeholder="San Francisco, CA" className="w-full h-10 px-3 text-[13px] border border-[#E5E5E5] rounded-xl outline-none focus:border-[#2D5219]" />
            </div>
            <div>
              <label className="text-[11px] text-[#6B6B6B] mb-1 block">Status</label>
              <select value={form.status} onChange={e => update('status', e.target.value)} className="w-full h-10 px-3 text-[13px] border border-[#E5E5E5] rounded-xl outline-none focus:border-[#2D5219] bg-white">
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[#6B6B6B] mb-1 block">Date applied</label>
              <input type="date" value={form.applied_at} onChange={e => update('applied_at', e.target.value)} className="w-full h-10 px-3 text-[13px] border border-[#E5E5E5] rounded-xl outline-none focus:border-[#2D5219]" />
            </div>
            <div>
              <label className="text-[11px] text-[#6B6B6B] mb-1 block">Source</label>
              <select value={form.source} onChange={e => update('source', e.target.value)} className="w-full h-10 px-3 text-[13px] border border-[#E5E5E5] rounded-xl outline-none focus:border-[#2D5219] bg-white">
                {SOURCE_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] text-[#6B6B6B] mb-1 block">Job URL</label>
            <input value={form.job_url} onChange={e => update('job_url', e.target.value)} placeholder="https://..." className="w-full h-10 px-3 text-[13px] border border-[#E5E5E5] rounded-xl outline-none focus:border-[#2D5219]" />
          </div>
          <div>
            <label className="text-[11px] text-[#6B6B6B] mb-1 block">Notes</label>
            <textarea value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Recruiter mentioned strong portfolio..." rows={2} className="w-full px-3 py-2 text-[13px] border border-[#E5E5E5] rounded-xl outline-none focus:border-[#2D5219] resize-none" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 h-10 border border-[#E5E5E5] rounded-xl text-[13px] text-[#6B6B6B] hover:bg-[#F5F4F0]">Cancel</button>
          <button onClick={handleSave} disabled={!form.company || !form.role || saving}
            className="flex-1 h-10 bg-[#2D5219] text-white rounded-xl text-[13px] font-medium hover:bg-[#3A6B22] disabled:bg-[#E5E5E5] disabled:text-[#ADADAD]">
            {saving ? 'Saving...' : 'Add application'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailDrawer({ app, onClose, onStatusChange, onDelete }) {
  const [status, setStatus] = useState(app.status)
  const [notes, setNotes] = useState(app.notes || '')
  const [saving, setSaving] = useState(false)

  const handleStatusChange = async (newStatus) => {
    setStatus(newStatus)
    setSaving(true)
    await onStatusChange(app.id, newStatus, notes)
    setSaving(false)
  }

  const handleNotesSave = async () => {
    setSaving(true)
    await onStatusChange(app.id, status, notes)
    setSaving(false)
  }

  const timelineStages = ['applied', 'oa', 'interview', 'final_round', 'offer']
  const currentIdx = timelineStages.indexOf(status)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/10" onClick={onClose} />
      <div className="relative bg-white w-full max-w-[420px] h-full overflow-y-auto shadow-2xl border-l border-[#E5E5E5]">
        <div className="sticky top-0 bg-white border-b border-[#F0F0F0] px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-[15px] font-semibold text-[#0A0A0A]">{app.company}</h2>
            <p className="text-[12px] text-[#6B6B6B]">{app.role}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-[#F5F4F0] flex items-center justify-center text-[#6B6B6B] hover:bg-[#EDEDEB]">✕</button>
        </div>
        <div className="p-6 space-y-6">

          {app.status === 'in_progress' && app.job_url && (
            <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-[#0369A1]">Application in progress</p>
                <p className="text-[11px] text-[#0369A1] opacity-70 mt-0.5">You started this but haven&apos;t submitted yet</p>
              </div>
              <a href={app.job_url} target="_blank" rel="noopener noreferrer"
                className="text-[12px] font-medium text-white bg-[#0369A1] px-3 py-1.5 rounded-lg hover:bg-[#0284C7] whitespace-nowrap">
                Continue ↗
              </a>
            </div>
          )}

          <div>
            <p className="text-[11px] font-semibold text-[#ADADAD] uppercase tracking-widest mb-3">Status</p>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map(s => (
                <button key={s} onClick={() => handleStatusChange(s)}
                  className={`px-3 py-1.5 rounded-xl text-[12px] font-medium border transition-all ${status === s ? 'ring-2 ring-offset-1 ring-[#2D5219]' : 'opacity-60 hover:opacity-100'}`}
                  style={{ background: STATUS_CONFIG[s].bg, color: STATUS_CONFIG[s].color, borderColor: STATUS_CONFIG[s].border }}>
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>

          {!['saved', 'rejected', 'withdrawn', 'in_progress'].includes(status) && (
            <div>
              <p className="text-[11px] font-semibold text-[#ADADAD] uppercase tracking-widest mb-3">Progress</p>
              <div className="flex items-center">
                {timelineStages.map((stage, i) => (
                  <div key={stage} className="flex items-center flex-1 last:flex-none">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold border-2 transition-all ${i <= currentIdx ? 'bg-[#2D5219] border-[#2D5219] text-white' : 'bg-white border-[#E5E5E5] text-[#ADADAD]'}`}>
                      {i < currentIdx ? '✓' : i + 1}
                    </div>
                    {i < timelineStages.length - 1 && (
                      <div className={`flex-1 h-0.5 ${i < currentIdx ? 'bg-[#2D5219]' : 'bg-[#E5E5E5]'}`} />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1">
                {timelineStages.map(s => (
                  <p key={s} className="text-[9px] text-[#ADADAD] text-center" style={{ flex: s !== 'offer' ? '1' : 'none' }}>
                    {STATUS_CONFIG[s].label}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-[11px] font-semibold text-[#ADADAD] uppercase tracking-widest mb-3">Job info</p>
            <div className="space-y-2">
              {[
                { label: 'Location', value: app.location || '—' },
                { label: 'Source', value: app.source || '—' },
                { label: 'Applied', value: app.applied_at ? new Date(app.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-[#F5F5F5]">
                  <span className="text-[12px] text-[#ADADAD]">{label}</span>
                  <span className="text-[12px] text-[#0A0A0A] font-medium">{value}</span>
                </div>
              ))}
              {app.job_url && (
                <a href={app.job_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[12px] text-[#2D5219] hover:underline pt-1">
                  View job posting ↗
                </a>
              )}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-[#ADADAD] uppercase tracking-widest mb-3">Notes</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
              placeholder="Add notes — recruiter name, interview feedback, next steps..."
              className="w-full px-3 py-2.5 text-[13px] border border-[#E5E5E5] rounded-xl outline-none focus:border-[#2D5219] resize-none leading-relaxed" />
            <button onClick={handleNotesSave} disabled={saving}
              className="mt-2 w-full h-9 bg-[#2D5219] text-white rounded-xl text-[12px] font-medium hover:bg-[#3A6B22] disabled:bg-[#E5E5E5]">
              {saving ? 'Saving...' : 'Save notes'}
            </button>
          </div>

          <button onClick={() => onDelete(app.id)}
            className="w-full h-9 border border-[#FECACA] text-[#DC2626] rounded-xl text-[12px] hover:bg-[#FEF2F2]">
            Delete application
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TrackerPage() {
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedApp, setSelectedApp] = useState(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [openMenu, setOpenMenu] = useState(null)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const fetchApps = async (uid) => {
    const { data } = await supabase
      .from('applications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
    setApps(data || [])
    setLoading(false)
  }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUser(user)
      await fetchApps(user.id)
    }
    load()
  }, [])

  const addApp = async (form) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('applications').insert({
      user_id: user.id,
      company: form.company,
      role: form.role,
      location: form.location,
      status: form.status,
      applied_at: form.applied_at ? new Date(form.applied_at).toISOString() : new Date().toISOString(),
      source: form.source,
      job_url: form.job_url,
      notes: form.notes,
    }).select().single()
    if (data) setApps(prev => [data, ...prev])
  }

  const updateApp = async (id, status, notes) => {
    await supabase.from('applications').update({
      status,
      notes,
      ...(status === 'applied' ? { applied_at: new Date().toISOString() } : {}),
    }).eq('id', id)
    setApps(prev => prev.map(a => a.id === id ? { ...a, status, notes } : a))
    if (selectedApp?.id === id) setSelectedApp(prev => ({ ...prev, status, notes }))
  }

  const deleteApp = async (id) => {
    await supabase.from('applications').delete().eq('id', id)
    setApps(prev => prev.filter(a => a.id !== id))
    setSelectedApp(null)
  }

  const filtered = apps
    .filter(a => {
      const matchSearch = !search || a.company?.toLowerCase().includes(search.toLowerCase()) || a.role?.toLowerCase().includes(search.toLowerCase())
      const matchStatus = filterStatus === 'all' || a.status === filterStatus
      const matchSource = filterSource === 'all' || a.source === filterSource
      return matchSearch && matchStatus && matchSource
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at)
      if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at)
      if (sortBy === 'company') return (a.company || '').localeCompare(b.company || '')
      return 0
    })

  const stats = {
    total: apps.length,
    active: apps.filter(a => ['applied', 'oa', 'interview', 'final_round', 'in_progress'].includes(a.status)).length,
    interviews: apps.filter(a => ['interview', 'final_round'].includes(a.status)).length,
    offers: apps.filter(a => a.status === 'offer').length,
    rejected: apps.filter(a => a.status === 'rejected').length,
  }

  const insights = computeInsights(apps)

  const nextStep = (status) => {
    if (status === 'in_progress') return null
    if (status === 'applied') return 'Await response'
    if (status === 'oa') return 'Complete OA'
    if (status === 'interview') return 'Interview prep'
    if (status === 'final_round') return 'Final prep'
    if (status === 'offer') return 'Review offer'
    return '—'
  }

  return (
    <>
      <style>{`
        .tracking-table th { position: sticky; top: 0; background: white; z-index: 2; }
        .tracking-row:hover td { background: #FAFAF8; }
        .tracking-row { cursor: pointer; }
        @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }
        .animate-ping { animation: ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite; }
      `}</style>

      <div className="px-8 py-7">

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-semibold text-[#0A0A0A] tracking-tight">Application Tracker</h1>
            <p className="text-[13px] text-[#6B6B6B] mt-0.5">Track every application, interview, and next step in one place.</p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="h-9 px-4 bg-[#2D5219] text-white text-[13px] font-medium rounded-xl hover:bg-[#3A6B22] flex items-center gap-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Add application
          </button>
        </div>

        <div className="grid grid-cols-5 gap-3 mb-6">
          <InsightCard title="Momentum" value={insights?.momentum.value ?? stats.total} sub={insights?.momentum.sub ?? 'Total applications'} trend={insights?.momentum.trend} icon="⚡" color="#2D5219" loading={loading} />
          <InsightCard title="Company Quality" value={insights?.quality.value ?? '—'} sub={insights?.quality.sub ?? 'Strong fit rate'} icon="🎯" color="#2563EB" loading={loading} />
          <InsightCard title="Timing" value={insights?.timing.value ?? '—'} sub={insights?.timing.sub ?? 'Avg response time'} icon="⏱" color="#B45309" loading={loading} />
          <InsightCard title="Active" value={insights?.resume.value ?? stats.active} sub={insights?.resume.sub ?? 'Applications submitted'} icon="📄" color="#7C3AED" loading={loading} />
          <InsightCard title="Rejections" value={insights?.rejection.value ?? stats.rejected} sub={insights?.rejection.sub ?? 'Rejections tracked'} icon="📊" color="#DC2626" loading={loading} />
        </div>

        <div className="flex items-center gap-4 mb-5">
          {[
            { label: 'Total', value: stats.total, color: '#0A0A0A' },
            { label: 'In Progress', value: apps.filter(a => a.status === 'in_progress').length, color: '#0369A1' },
            { label: 'Active', value: stats.active, color: '#2563EB' },
            { label: 'Interviews', value: stats.interviews, color: '#B45309' },
            { label: 'Offers', value: stats.offers, color: '#2D5219' },
            { label: 'Rejected', value: stats.rejected, color: '#DC2626' },
          ].map(({ label, value, color }, i) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[20px] font-semibold" style={{ color }}>{value}</span>
              <span className="text-[12px] text-[#ADADAD]">{label}</span>
              {i < 5 && <div className="w-px h-4 bg-[#E5E5E5] ml-2" />}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 max-w-[280px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#ADADAD]" width="13" height="13" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input type="text" placeholder="Search company or role..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full h-9 pl-8 pr-4 text-[13px] bg-white border border-[#E5E5E5] rounded-xl outline-none focus:border-[#2D5219] placeholder:text-[#ADADAD]" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="h-9 px-3 text-[12px] bg-white border border-[#E5E5E5] rounded-xl outline-none focus:border-[#2D5219]">
            <option value="all">All status</option>
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
          </select>
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
            className="h-9 px-3 text-[12px] bg-white border border-[#E5E5E5] rounded-xl outline-none focus:border-[#2D5219]">
            <option value="all">All sources</option>
            {SOURCE_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="h-9 px-3 text-[12px] bg-white border border-[#E5E5E5] rounded-xl outline-none focus:border-[#2D5219]">
            <option value="newest">Most recent</option>
            <option value="oldest">Oldest first</option>
            <option value="company">Company A-Z</option>
          </select>
          {(search || filterStatus !== 'all' || filterSource !== 'all') && (
            <button onClick={() => { setSearch(''); setFilterStatus('all'); setFilterSource('all') }}
              className="h-9 px-3 text-[12px] text-[#6B6B6B] border border-[#E5E5E5] bg-white rounded-xl hover:bg-[#F5F4F0]">
              Clear
            </button>
          )}
          <span className="text-[12px] text-[#ADADAD] ml-auto">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#E5E5E5" strokeWidth="3"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="#2D5219" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 bg-[#F5F4F0] rounded-2xl flex items-center justify-center mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2" stroke="#ADADAD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-[15px] font-medium text-[#0A0A0A] mb-1">
                {search || filterStatus !== 'all' ? 'No results found' : 'No applications yet'}
              </p>
              <p className="text-[13px] text-[#ADADAD] mb-5">
                {search || filterStatus !== 'all' ? 'Try adjusting your filters' : 'Track your applications in one place.'}
              </p>
              {!search && filterStatus === 'all' && (
                <button onClick={() => setShowAdd(true)}
                  className="h-9 px-4 bg-[#2D5219] text-white text-[13px] font-medium rounded-xl hover:bg-[#3A6B22]">
                  Add first application
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="tracking-table w-full">
                <thead>
                  <tr className="border-b border-[#F0F0F0]">
                    {['Company', 'Role', 'Location', 'Status', 'Date', 'Source', 'Next step', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#ADADAD] uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(app => (
                    <tr key={app.id} className="tracking-row border-b border-[#F5F5F5] last:border-none" onClick={() => setSelectedApp(app)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="relative">
                            <div className="w-7 h-7 rounded-lg bg-[#F5F4F0] flex items-center justify-center text-[11px] font-semibold text-[#0A0A0A] flex-shrink-0">
                              {app.company?.[0]?.toUpperCase()}
                            </div>
                            {app.status === 'in_progress' && (
                              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5">
                                <div className="absolute inset-0 rounded-full bg-[#0369A1] animate-ping opacity-75" />
                                <div className="absolute inset-0 rounded-full bg-[#0369A1] border-2 border-white" />
                              </div>
                            )}
                          </div>
                          <span className="text-[13px] font-medium text-[#0A0A0A] whitespace-nowrap">{app.company}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[180px]">
                        <span className="text-[13px] text-[#0A0A0A] truncate block">{app.role}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] text-[#6B6B6B] whitespace-nowrap">{app.location || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={app.status} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] text-[#6B6B6B] whitespace-nowrap">
                          {app.applied_at ? new Date(app.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] text-[#6B6B6B]">{app.source || '—'}</span>
                      </td>
                      <td className="px-4 py-3" onClick={e => app.status === 'in_progress' && e.stopPropagation()}>
                        {app.status === 'in_progress' && app.job_url ? (
                          <a href={app.job_url} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-[12px] text-[#0369A1] font-medium hover:underline whitespace-nowrap flex items-center gap-1">
                            Continue applying ↗
                          </a>
                        ) : (
                          <span className="text-[12px] text-[#ADADAD] italic">{nextStep(app.status)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="relative">
                          <button onClick={() => setOpenMenu(openMenu === app.id ? null : app.id)}
                            className="w-7 h-7 rounded-lg hover:bg-[#F5F4F0] flex items-center justify-center text-[#ADADAD] text-[16px]">
                            ···
                          </button>
                          {openMenu === app.id && (
                            <div className="absolute right-0 top-8 bg-white border border-[#E5E5E5] rounded-xl shadow-lg z-20 w-36 py-1">
                              <button onClick={() => { setSelectedApp(app); setOpenMenu(null) }}
                                className="w-full text-left px-3 py-2 text-[13px] text-[#0A0A0A] hover:bg-[#F5F4F0]">Edit</button>
                              <button onClick={() => { deleteApp(app.id); setOpenMenu(null) }}
                                className="w-full text-left px-3 py-2 text-[13px] text-[#DC2626] hover:bg-[#FEF2F2]">Delete</button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {showAdd && <AddModal onClose={() => setShowAdd(false)} onSave={addApp} />}
      {selectedApp && <DetailDrawer app={selectedApp} onClose={() => setSelectedApp(null)} onStatusChange={updateApp} onDelete={deleteApp} />}
      {openMenu && <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />}
    </>
  )
}
