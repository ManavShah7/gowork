import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { scoreDNA, calibrateEmbeddingScore, parseEmbedding } from '@/lib/matching'

// GET /api/jobs — the logged-in user's ranked matches for the browse feed.
//
// PERFORMANCE: this is a read endpoint hit on every page load, so it does NOT
// run the GPT reranker (that's reserved for the autopilot apply decision in
// run-matching). It uses fast pgvector retrieval (match_jobs RPC) + the DNA
// score only. Where the autopilot has ALREADY produced a GPT score for a job
// (cached in apply_queue), we surface that higher-quality score/reason instead
// of recomputing it.
//
// Works for any logged-in user, autopilot-enabled or not.

const DEFAULT_JOB_TYPES = ['internship', 'coop', 'fulltime']
const RECENT_WINDOW_MS = 48 * 60 * 60 * 1000

// Fast, GPT-free display score: blend calibrated vector similarity with the DNA
// score so results vary instead of clustering.
function fastScore(embScore, dnaScore) {
  return Math.max(0, Math.min(99, Math.round(0.45 * embScore + 0.55 * dnaScore)))
}

// One-line reason derived from DNA signals (no LLM).
function templatedReason(profile, dna) {
  const tags = (dna.tagOverlap || []).slice(0, 2).join(', ')
  if (dna.requiredTotal > 0 && dna.requiredMatches > 0) {
    return `Matches ${dna.requiredMatches}/${dna.requiredTotal} required skills${tags ? ` · ${tags}` : ''}`
  }
  if (tags) return `Aligned with your target roles: ${tags}`
  return `Relevant to your ${profile.primary_role || 'profile'}`
}

function toCard(job, match, reason) {
  return {
    id: job.job_id,
    title: job.title,
    company: job.company,
    location: job.location,
    url: job.apply_url,
    logo: null, // job_listings has no logo; card falls back to the company initial
    match,
    reason,
    posted: job.posted_at || null,
    remote: job.location_type === 'us-remote',
    isDirect: !!job.is_direct_apply,
    type: (job.job_type_clean || '').toUpperCase(),
    jobType: job.job_type_clean || '',
  }
}

export async function GET() {
  const auth = await createServerSupabase()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const supabase = createServiceSupabase()

  // Profile (embedding + DNA fields). No matches without it.
  const { data: profile } = await supabase
    .from('intelligence_profiles')
    .select('user_id, primary_role, career_stage, target_role_tags, proven_skills, learning_skills, industries, embedding')
    .eq('user_id', user.id)
    .single()

  const userEmb = parseEmbedding(profile?.embedding)
  if (!profile || !userEmb || !(profile.target_role_tags?.length)) {
    return NextResponse.json({ jobs: [], recent: [] })
  }

  // Optional autopilot settings → preferred job types / blacklist. Defaults let
  // non-autopilot users still get a feed.
  const { data: settings } = await supabase
    .from('auto_apply_settings')
    .select('job_types, blacklisted_companies')
    .eq('user_id', user.id)
    .maybeSingle()

  const jobTypes = settings?.job_types?.length ? settings.job_types : DEFAULT_JOB_TYPES
  const blacklist = (settings?.blacklisted_companies || []).map(c => c.toLowerCase())

  // Fast pgvector retrieval (HNSW) — no GPT, no live embedding.
  const { data: retrieved, error } = await supabase.rpc('match_jobs', {
    query_embedding: JSON.stringify(userEmb),
    user_job_types: jobTypes,
    blacklist,
    match_count: 60,
  })
  if (error) {
    console.error('match_jobs RPC failed in /api/jobs:', error.message)
    return NextResponse.json({ jobs: [], recent: [] })
  }

  // Cached GPT scores from the autopilot queue (job_id → { score, reason }).
  const { data: queued } = await supabase
    .from('apply_queue')
    .select('job_id, match_score, match_reason')
    .eq('user_id', user.id)
  const cache = new Map((queued || []).map(q => [q.job_id, q]))

  // posted_at isn't returned by the RPC; fetch it for the retrieved ids so the
  // cards can show "Xh ago" and the recent feed can sort.
  const ids = (retrieved || []).map(j => j.job_id)
  const postedMap = new Map()
  if (ids.length) {
    const { data: meta } = await supabase
      .from('job_listings')
      .select('job_id, posted_at')
      .in('job_id', ids)
    for (const m of meta || []) postedMap.set(m.job_id, m.posted_at)
  }

  const cards = (retrieved || []).map(job => {
    job.posted_at = postedMap.get(job.job_id) || null
    const cached = cache.get(job.job_id)
    if (cached) {
      // Prefer the autopilot's GPT-quality score/reason (computed offline).
      return toCard(job, cached.match_score, cached.match_reason || '')
    }
    const dna = scoreDNA(profile, job)
    const embScore = typeof job.similarity === 'number' ? calibrateEmbeddingScore(job.similarity) : 0
    return toCard(job, fastScore(embScore, dna.dnaScore), templatedReason(profile, dna))
  })

  const jobs = cards.sort((a, b) => b.match - a.match)

  const cutoff = Date.now() - RECENT_WINDOW_MS
  const recent = cards
    .filter(c => c.posted && new Date(c.posted).getTime() >= cutoff)
    .sort((a, b) => new Date(b.posted) - new Date(a.posted))
    .slice(0, 8)

  return NextResponse.json({ jobs, recent })
}
