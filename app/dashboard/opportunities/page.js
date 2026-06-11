'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

function HorizontalJobCard({ job, saved, onSave }) {
  const posted = job.posted
    ? Math.floor((Date.now() - new Date(job.posted)) / (1000 * 60 * 60))
    : null
  const postedLabel = posted === null ? '' : posted < 1 ? 'Just now' : posted < 24 ? `${posted}h ago` : `${Math.floor(posted / 24)}d ago`

  return (
    <div
      onClick={() => job.url && window.open(job.url, '_blank')}
      className="flex-shrink-0 w-72 bg-white border border-[#E5E5E5] rounded-2xl p-5 hover:border-[#ADADAD] hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
    >
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#F5F4F0] flex items-center justify-center overflow-hidden flex-shrink-0">
            {job.logo
              ? <img src={job.logo} alt="" className="w-full h-full object-contain p-1" onError={e => e.target.style.display = 'none'}/>
              : <span className="text-[14px] font-semibold text-[#0A0A0A]">{job.company?.[0]}</span>
            }
          </div>
          <button
            onClick={e => { e.stopPropagation(); onSave(job) }}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              saved ? 'bg-[#F4F9F0] text-[#2D5219]' : 'bg-[#F5F4F0] text-[#ADADAD] hover:text-[#2D5219]'
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'}>
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <p className="text-[14px] font-semibold text-[#0A0A0A] group-hover:text-[#2D5219] transition-colors leading-tight mb-1">{job.title}</p>
        <p className="text-[12px] text-[#6B6B6B] mb-1.5">{job.company}</p>
        {job.reason && <p className="text-[11px] text-[#6B6B6B] leading-snug mb-3 line-clamp-2">{job.reason}</p>}

        <div className="flex flex-wrap gap-1.5">
          <span className="text-[11px] text-[#6B6B6B] bg-[#F5F4F0] px-2 py-0.5 rounded-full">{job.location}</span>
          {job.remote && <span className="text-[11px] text-[#2D5219] bg-[#F4F9F0] border border-[#C8E0BC] px-2 py-0.5 rounded-full">Remote</span>}
          {job.isDirect && <span className="text-[11px] text-[#2D5219] bg-[#F4F9F0] border border-[#C8E0BC] px-2 py-0.5 rounded-full">Direct apply</span>}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#F0F0F0]">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#2D5219]" />
          <span className="text-[13px] font-semibold text-[#2D5219]">{job.match}% match</span>
        </div>
        {postedLabel && <span className="text-[11px] text-[#ADADAD]">{postedLabel}</span>}
      </div>
    </div>
  )
}

function VerticalJobCard({ job, saved, onSave }) {
  const posted = job.posted
    ? Math.floor((Date.now() - new Date(job.posted)) / (1000 * 60 * 60))
    : null
  const postedLabel = posted === null ? '' : posted < 1 ? 'Just now' : posted < 24 ? `${posted}h ago` : `${Math.floor(posted / 24)}d ago`

  return (
    <div
      onClick={() => job.url && window.open(job.url, '_blank')}
      className="flex items-center justify-between p-4 bg-white border border-[#E5E5E5] rounded-2xl hover:border-[#ADADAD] hover:shadow-sm transition-all cursor-pointer group"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#F5F4F0] flex items-center justify-center flex-shrink-0 overflow-hidden">
          {job.logo
            ? <img src={job.logo} alt="" className="w-full h-full object-contain p-1" onError={e => e.target.style.display = 'none'}/>
            : <span className="text-[14px] font-semibold text-[#0A0A0A]">{job.company?.[0]}</span>
          }
        </div>
        <div>
          <p className="text-[13px] font-semibold text-[#0A0A0A] group-hover:text-[#2D5219] transition-colors">{job.title}</p>
          <p className="text-[12px] text-[#ADADAD]">{job.company} · {job.location}</p>
          {job.reason && <p className="text-[11px] text-[#6B6B6B] mt-1 leading-snug truncate max-w-[460px]">{job.reason}</p>}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {job.remote && <span className="text-[11px] text-[#2D5219] bg-[#F4F9F0] border border-[#C8E0BC] px-2 py-0.5 rounded-full">Remote</span>}
            {job.isDirect && <span className="text-[11px] text-[#2D5219] bg-[#F4F9F0] border border-[#C8E0BC] px-2 py-0.5 rounded-full">Direct apply</span>}
            <span className="text-[11px] text-[#6B6B6B] bg-[#F5F4F0] px-2 py-0.5 rounded-full">{job.type}</span>
            {postedLabel && <span className="text-[11px] text-[#ADADAD]">{postedLabel}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
        <div className="text-right">
          <div className="flex items-center gap-1 justify-end">
            <div className="w-1.5 h-1.5 rounded-full bg-[#2D5219]" />
            <span className="text-[13px] font-semibold text-[#2D5219]">{job.match}%</span>
          </div>
          <span className="text-[11px] text-[#ADADAD]">match</span>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onSave(job) }}
          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
            saved ? 'bg-[#F4F9F0] text-[#2D5219]' : 'bg-[#F5F4F0] text-[#ADADAD] hover:text-[#2D5219]'
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'}>
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

function SectionHeader({ title, count }) {
  return (
    <div className="flex items-baseline gap-2 mb-3">
      <h2 className="text-[15px] font-semibold text-[#0A0A0A]">{title}</h2>
      {count !== undefined && <span className="text-[12px] text-[#ADADAD]">{count} jobs</span>}
    </div>
  )
}

function SkeletonHCard() {
  return (
    <div className="flex-shrink-0 w-72 h-44 bg-white border border-[#E5E5E5] rounded-2xl p-5 animate-pulse">
      <div className="flex justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#F5F4F0]" />
        <div className="w-7 h-7 rounded-lg bg-[#F5F4F0]" />
      </div>
      <div className="space-y-2">
        <div className="h-3.5 bg-[#F5F4F0] rounded-full w-40" />
        <div className="h-3 bg-[#F5F4F0] rounded-full w-24" />
      </div>
    </div>
  )
}

export default function OpportunitiesPage() {
 const [jobs, setJobs] = useState([])
const [recentJobs, setRecentJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [saved, setSaved] = useState([])
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      try {
        const res = await fetch('/api/jobs')
const data = await res.json()
setJobs(data.jobs || [])
setRecentJobs(data.recent || [])
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  const toggleSave = (job) => {
    setSaved(prev =>
      prev.find(j => j.id === job.id)
        ? prev.filter(j => j.id !== job.id)
        : [...prev, job]
    )
  }

  const isSaved = (job) => saved.some(j => j.id === job.id)

  const topMatches = jobs.filter(j => j.match >= 80).slice(0, 8)
  

  const FILTERS = ['All', 'Remote', 'Internship', 'Full-time', 'Direct apply', 'High match']
  const INDUSTRY_FILTERS = ['Design', 'SaaS', 'Healthcare', 'Fintech', 'Education']

  const explored = jobs.filter(job => {
    const matchesSearch = !search ||
      job.title?.toLowerCase().includes(search.toLowerCase()) ||
      job.company?.toLowerCase().includes(search.toLowerCase())
    const matchesFilter =
      filter === 'All' ? true :
      filter === 'Remote' ? job.remote :
      filter === 'Internship' ? job.type?.includes('INTERN') :
      filter === 'Full-time' ? job.type?.includes('FULLTIME') :
      filter === 'Direct apply' ? job.isDirect :
      filter === 'High match' ? job.match >= 80 :
      job.title?.toLowerCase().includes(filter.toLowerCase()) ||
      job.company?.toLowerCase().includes(filter.toLowerCase())
    return matchesSearch && matchesFilter
  })

  return (
    <div className="px-8 py-7">
      <div className="max-w-[920px] mx-auto space-y-8">

          <div>
            <h1 className="text-[22px] font-semibold text-[#0A0A0A] tracking-tight">Opportunities</h1>
            <p className="text-[13px] text-[#6B6B6B] mt-1">
              {loading ? 'Finding jobs matched to your profile...' : `${jobs.length} jobs curated for you`}
            </p>
          </div>

          {/* Top Matches */}
          <div>
            <SectionHeader title="Top matches" count={loading ? undefined : topMatches.length} />
            <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
              {loading
                ? Array(4).fill(0).map((_, i) => <SkeletonHCard key={i} />)
                : topMatches.length > 0
                  ? topMatches.map(job => <HorizontalJobCard key={job.id} job={job} saved={isSaved(job)} onSave={toggleSave} />)
                  : <p className="text-[13px] text-[#ADADAD] py-4">No high-match jobs found right now.</p>
              }
            </div>
          </div>

          {/* Recently Posted */}
          <div>
            <SectionHeader title="Recently posted" count={loading ? undefined : recentJobs.length} />
            <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
              {loading
                ? Array(4).fill(0).map((_, i) => <SkeletonHCard key={i} />)
                : recentJobs.length > 0
                  ? recentJobs.map(job => <HorizontalJobCard key={job.id} job={job} saved={isSaved(job)} onSave={toggleSave} />)
                  : <p className="text-[13px] text-[#ADADAD] py-4">No jobs posted in the last 48 hours.</p>
              }
            </div>
          </div>

          {/* Saved for Later */}
          <div>
            <SectionHeader title="Saved for later" count={saved.length} />
            <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
              {saved.length === 0 ? (
                <div className="w-full h-20 border border-dashed border-[#E5E5E5] rounded-2xl flex items-center justify-center">
                  <p className="text-[13px] text-[#ADADAD]">Bookmark jobs to save them here</p>
                </div>
              ) : (
                saved.map(job => <HorizontalJobCard key={job.id} job={job} saved={true} onSave={toggleSave} />)
              )}
            </div>
          </div>

          {/* Explore All */}
          <div>
            <SectionHeader title="Explore all" count={loading ? undefined : explored.length} />

            <div className="relative mb-3">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#ADADAD]" width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                placeholder="Search by role or company..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-11 pl-9 pr-4 bg-white border border-[#E5E5E5] rounded-xl text-[13px] text-[#0A0A0A] outline-none focus:border-[#2D5219] transition-colors placeholder:text-[#ADADAD]"
              />
            </div>

            <div className="flex gap-2 flex-wrap mb-4">
              {FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`h-8 px-3.5 rounded-xl text-[12px] font-medium border transition-all ${
                    filter === f
                      ? 'bg-[#2D5219] text-white border-[#2D5219]'
                      : 'bg-white text-[#6B6B6B] border-[#E5E5E5] hover:border-[#ADADAD]'
                  }`}
                >
                  {f}
                </button>
              ))}
              <div className="w-px bg-[#E5E5E5] mx-1" />
              {INDUSTRY_FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(filter === f ? 'All' : f)}
                  className={`h-8 px-3.5 rounded-xl text-[12px] font-medium border transition-all ${
                    filter === f
                      ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                      : 'bg-white text-[#6B6B6B] border-[#E5E5E5] hover:border-[#ADADAD]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {loading
                ? Array(5).fill(0).map((_, i) => (
                    <div key={i} className="h-16 bg-white border border-[#E5E5E5] rounded-2xl animate-pulse" />
                  ))
                : explored.length === 0
                  ? <div className="text-center py-12">
                      <p className="text-[13px] text-[#ADADAD]">No jobs match your search.</p>
                    </div>
                  : explored.map(job => (
                      <VerticalJobCard key={job.id} job={job} saved={isSaved(job)} onSave={toggleSave} />
                    ))
              }
            </div>
          </div>

        </div>
      </div>
  )
}