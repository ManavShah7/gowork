import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

function parseEmbedding(embedding) {
  if (!embedding) return null
  if (Array.isArray(embedding)) return embedding
  if (typeof embedding === 'string') {
    try { return JSON.parse(embedding) } catch { return null }
  }
  return null
}

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
  const report = {}

  // ── CHECK 1: USERS ────────────────────────────────────────
  const { data: users } = await supabase.auth.admin.listUsers()
  report.users = {
    total: users?.users?.length || 0,
    list: users?.users?.map(u => ({ id: u.id, email: u.email })) || []
  }

  // ── CHECK 2: INTELLIGENCE PROFILES ───────────────────────
  const { data: profiles } = await supabase
    .from('intelligence_profiles')
    .select('user_id, primary_role, career_stage, target_role_tags, proven_skills, embedding')

  report.intelligence_profiles = {
    total: profiles?.length || 0,
    details: profiles?.map(p => ({
      user_id: p.user_id,
      primary_role: p.primary_role,
      career_stage: p.career_stage,
      has_embedding: !!p.embedding,
      embedding_type: typeof p.embedding,
      embedding_is_array: Array.isArray(p.embedding),
      embedding_parseable: !!parseEmbedding(p.embedding),
      target_role_tags: p.target_role_tags || 'MISSING',
      proven_skills_count: p.proven_skills?.length || 0,
      proven_skills: p.proven_skills || 'MISSING',
    })) || []
  }

  // ── CHECK 3: AUTO APPLY SETTINGS ─────────────────────────
  const { data: settings } = await supabase
    .from('auto_apply_settings')
    .select('*')

  report.auto_apply_settings = {
    total: settings?.length || 0,
    details: settings?.map(s => ({
      user_id: s.user_id,
      enabled: s.enabled,
      match_threshold: s.match_threshold,
      daily_limit: s.daily_limit,
      job_types: s.job_types,
    })) || []
  }

  // ── CHECK 4: JOB LISTINGS ─────────────────────────────────
  const { count: totalJobs } = await supabase
    .from('job_listings')
    .select('*', { count: 'exact', head: true })

  const { count: classifiedJobs } = await supabase
    .from('job_listings')
    .select('*', { count: 'exact', head: true })
    .eq('classified', true)

  const { count: directApplyJobs } = await supabase
    .from('job_listings')
    .select('*', { count: 'exact', head: true })
    .eq('classified', true)
    .eq('is_direct_apply', true)

  const { count: internshipJobs } = await supabase
    .from('job_listings')
    .select('*', { count: 'exact', head: true })
    .eq('classified', true)
    .eq('is_direct_apply', true)
    .in('job_type_clean', ['internship', 'coop'])

  const { count: internshipWithEmbedding } = await supabase
    .from('job_listings')
    .select('*', { count: 'exact', head: true })
    .eq('classified', true)
    .eq('is_direct_apply', true)
    .in('job_type_clean', ['internship', 'coop'])
    .not('embedding', 'is', null)

  report.job_listings = {
    total: totalJobs,
    classified: classifiedJobs,
    unclassified: (totalJobs || 0) - (classifiedJobs || 0),
    direct_apply: directApplyJobs,
    internship_or_coop: internshipJobs,
    internship_with_embedding: internshipWithEmbedding,
  }

  // ── CHECK 5: SAMPLE INTERNSHIP JOBS ──────────────────────
  const { data: sampleJobs } = await supabase
    .from('job_listings')
    .select('job_id, company, title, job_type_clean, is_direct_apply, role_tags, required_skills, embedding')
    .eq('classified', true)
    .eq('is_direct_apply', true)
    .in('job_type_clean', ['internship', 'coop'])
    .not('embedding', 'is', null)
    .limit(5)

  report.sample_internship_jobs = sampleJobs?.map(j => ({
    company: j.company,
    title: j.title,
    job_type_clean: j.job_type_clean,
    role_tags: j.role_tags,
    required_skills: j.required_skills,
    has_embedding: !!j.embedding,
  })) || []

  // ── CHECK 6: MATCHING SIMULATION ─────────────────────────
  if (profiles?.length && sampleJobs?.length) {
    const profile = profiles[0]
    const userSettings = settings?.[0]
    const userEmb = parseEmbedding(profile.embedding)
    const userTags = profile.target_role_tags || []
    const userJobTypes = userSettings?.job_types || ['internship', 'coop']

    report.matching_simulation = sampleJobs.map(job => {
      const jobEmb = parseEmbedding(job.embedding)
      const similarity = userEmb && jobEmb ? cosineSimilarity(userEmb, jobEmb) : null
      const score = similarity !== null ? Math.round(((similarity + 1) / 2) * 99) : null
      const jobTags = job.role_tags || []
      const tagOverlap = jobTags.filter(t => userTags.includes(t))

      const seniorTitles = ['senior', 'sr.', 'staff', 'principal',
        'manager', 'director', 'head of', 'vp ', 'chief', 'lead ']
      const isSenior = seniorTitles.some(t => (job.title || '').toLowerCase().includes(t))
      const isJunior = ['Student', 'New Grad', 'Junior'].includes(profile.career_stage || '')

      return {
        company: job.company,
        title: job.title,
        job_type_match: userJobTypes.includes(job.job_type_clean),
        role_tag_overlap: tagOverlap,
        has_tag_overlap: tagOverlap.length > 0,
        is_senior_role: isSenior,
        seniority_filtered: isSenior && isJunior,
        similarity: similarity?.toFixed(4),
        score,
        above_threshold: score >= (userSettings?.match_threshold || 72),
        would_queue: (
          userJobTypes.includes(job.job_type_clean) &&
          tagOverlap.length > 0 &&
          !(isSenior && isJunior) &&
          score >= (userSettings?.match_threshold || 72)
        ),
        fail_reason: !userJobTypes.includes(job.job_type_clean) ? 'job_type_mismatch'
          : tagOverlap.length === 0 ? 'no_tag_overlap'
          : (isSenior && isJunior) ? 'seniority_filtered'
          : score < (userSettings?.match_threshold || 72) ? 'score_too_low'
          : 'would_queue'
      }
    })
  }

  // ── CHECK 7: APPLY QUEUE ──────────────────────────────────
  const { count: queueCount } = await supabase
    .from('apply_queue')
    .select('*', { count: 'exact', head: true })

  const { data: recentQueue } = await supabase
    .from('apply_queue')
    .select('company, role, match_score, status, queued_at')
    .order('queued_at', { ascending: false })
    .limit(5)

  report.apply_queue = {
    total: queueCount,
    recent: recentQueue || []
  }

  // ── SUMMARY ───────────────────────────────────────────────
  report.summary = {
    has_user_profile: (profiles?.length || 0) > 0,
    has_dna_fields: profiles?.[0]?.target_role_tags?.length > 0,
    has_embedding: !!parseEmbedding(profiles?.[0]?.embedding),
    autopilot_enabled: settings?.[0]?.enabled || false,
    internship_jobs_ready: (internshipWithEmbedding || 0) > 0,
    queue_has_jobs: (queueCount || 0) > 0,
    pipeline_status: 
      !profiles?.length ? 'NO_PROFILE' :
      !parseEmbedding(profiles?.[0]?.embedding) ? 'NO_EMBEDDING' :
      !(profiles?.[0]?.target_role_tags?.length > 0) ? 'NO_DNA_FIELDS' :
      !settings?.[0]?.enabled ? 'AUTOPILOT_OFF' :
      !(internshipWithEmbedding > 0) ? 'NO_INTERNSHIP_JOBS_CLASSIFIED' :
      (queueCount || 0) > 0 ? 'PIPELINE_WORKING' :
      'MATCHING_NOT_FINDING_MATCHES'
  }

  return NextResponse.json(report, { status: 200 })
}