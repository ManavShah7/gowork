import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  if (denom === 0) return 0
  return dot / denom
}

export async function GET() {
  const supabase = createServiceSupabase()

  // Get user settings
  const { data: settings } = await supabase
    .from('auto_apply_settings')
    .select('*')
    .eq('enabled', true)

  if (!settings?.length) return NextResponse.json({ error: 'No autopilot users found' })

  const userSettings = settings[0]
  const userId = userSettings.user_id

  // Get user profile
  const { data: profile } = await supabase
    .from('intelligence_profiles')
    .select('embedding, primary_role')
    .eq('user_id', userId)
    .single()

  if (!profile?.embedding) return NextResponse.json({ error: 'No embedding found for user' })

  // Get top 5 classified direct-apply jobs with embeddings
  const { data: jobs } = await supabase
    .from('job_listings')
    .select('job_id, company, title, job_type_clean, is_direct_apply, embedding')
    .eq('classified', true)
    .eq('is_direct_apply', true)
    .not('embedding', 'is', null)
    .limit(20)

  if (!jobs?.length) return NextResponse.json({ error: 'No classified direct-apply jobs with embeddings' })

  const results = jobs.map(job => {
    const similarity = cosineSimilarity(profile.embedding, job.embedding)
    const score = Math.round(((similarity + 1) / 2) * 99)
    const jobTypeMatch = (userSettings.job_types || []).includes(job.job_type_clean)

    return {
      company: job.company,
      title: job.title,
      job_type_clean: job.job_type_clean,
      job_type_match: jobTypeMatch,
      similarity: similarity.toFixed(4),
      score,
      would_queue: score >= userSettings.match_threshold && jobTypeMatch,
    }
  }).sort((a, b) => b.score - a.score)

  return NextResponse.json({
    user_id: userId,
    primary_role: profile.primary_role,
    match_threshold: userSettings.match_threshold,
    job_types: userSettings.job_types,
    total_jobs_checked: jobs.length,
    top_matches: results.slice(0, 10),
  })
}