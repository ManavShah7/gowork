// Shared matching logic used by BOTH run-matching (existing jobs) and
// classify-jobs → matchAndQueue (newly classified jobs), so the dashboard %
// and the apply decision always come from the same scoring (Bug 2).
//
// Pipeline (per brief §5): hard SQL filters → pgvector top 50 → DNA top 30 →
// GPT rerank top 20 → queue.
//
// IMPORTANT: user and job embeddings MUST be built from the symmetric clean
// schemes below. If you change one, re-embed both — otherwise cosine is invalid.

import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── Embedding inputs (brief §6) ─────────────────────────────────────────────
// Symmetric, clean role summaries. #1 lever for cosine quality.

export function buildUserEmbeddingText(profile) {
  return [
    `Role: ${profile.primary_role || ''}`,
    `Targeting: ${(profile.target_role_tags || []).join(', ')}`,
    `Seniority: ${profile.career_stage || ''}`,
    `Proven skills: ${(profile.proven_skills || []).join(', ')}`,
    `Achievements: ${(profile.experience_highlights || []).slice(0, 3).join('. ')}`,
    `Industries: ${(profile.industries || []).join(', ')}`,
  ].join('\n').trim()
}

export function buildJobEmbeddingText(job, classification) {
  return [
    `Role: ${job.title || ''} at ${job.company || ''}`,
    `Type: ${classification.job_type_clean || ''}`,
    `Seniority: ${classification.seniority_level || ''}`,
    `Required: ${(classification.required_skills || []).join(', ')}`,
    `Tags: ${(classification.role_tags || []).join(', ')}`,
    `Summary: ${(job.description || '').slice(0, 500)}`,
  ].join('\n').trim()
}

export async function embed(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return response.data[0].embedding
}

// ── Calibration (Bug 1) ─────────────────────────────────────────────────────
// Raw cosine for related text lands in a narrow ~0.38–0.65 band, so mapping
// (sim+1)/2 crushes everything to 65–77 and the threshold becomes meaningless.
// Normalize against the realistic [0.2, 0.7] band instead.
export function calibrateEmbeddingScore(similarity) {
  const min = 0.2, max = 0.7
  const norm = Math.max(0, Math.min(1, (similarity - min) / (max - min)))
  return Math.round(norm * 99)
}

// ── DNA score (brief §5.3 — keep existing weighting) ────────────────────────
// required∩proven (0–50), nice (0–20), role tags (0–20), industry (0–10).
// Returns { dnaScore, requiredMatches, requiredTotal, tagOverlap, eliminate }.
export function scoreDNA(profile, job) {
  const userTags = profile.target_role_tags || []
  const jobTags = job.role_tags || []
  const tagOverlap = jobTags.filter(t => userTags.includes(t))

  const requiredSkills = job.required_skills || []
  const niceSkills = job.nice_skills || []
  const provenSkills = (profile.proven_skills || []).map(s => s.toLowerCase())
  const learningSkills = (profile.learning_skills || []).map(s => s.toLowerCase())
  const allUserSkills = [...new Set([...provenSkills, ...learningSkills])]

  const matches = (skills) => skills.filter(skill =>
    allUserSkills.some(us => us.includes(skill) || skill.includes(us))
  ).length

  const requiredMatches = requiredSkills.length > 0 ? matches(requiredSkills) : 0
  const requiredScore = requiredSkills.length > 0
    ? Math.round((requiredMatches / requiredSkills.length) * 50)
    : 35

  const niceMatches = niceSkills.length > 0 ? matches(niceSkills) : 0
  const niceScore = niceSkills.length > 0
    ? Math.round((niceMatches / niceSkills.length) * 20)
    : 10

  const roleScore = Math.min(20, tagOverlap.length * 7)

  const userIndustries = (profile.industries || []).map(i => i.toLowerCase())
  const jobDesc = (job.description || '').toLowerCase()
  const industryScore = userIndustries.some(ind => ind && jobDesc.includes(ind)) ? 10 : 0

  const dnaScore = requiredScore + niceScore + roleScore + industryScore

  return {
    dnaScore,
    requiredMatches,
    requiredTotal: requiredSkills.length,
    tagOverlap,
    // Eliminate if DNA < 40, or no role-tag overlap, or required-skill coverage < 30%.
    eliminate:
      dnaScore < 40 ||
      tagOverlap.length === 0 ||
      (requiredSkills.length > 0 && requiredMatches / requiredSkills.length < 0.3),
  }
}

// ── Seniority guard ─────────────────────────────────────────────────────────
const SENIOR_TITLE_TOKENS = ['senior', 'sr.', 'staff', 'principal',
  'manager', 'director', 'head of', 'vp ', 'vice president', 'chief', 'lead ']

export function isSeniorMismatch(profile, job) {
  const title = (job.title || '').toLowerCase()
  const isSeniorRole = SENIOR_TITLE_TOKENS.some(t => title.includes(t))
  const isJuniorUser = ['Student', 'New Grad', 'Junior'].includes(profile.career_stage || 'Student')
  return isSeniorRole && isJuniorUser
}

// ── GPT rerank (brief §5.4) ─────────────────────────────────────────────────
// One batched gpt-4o-mini call over the shortlist. Returns a map job_id → result.
export async function gptRerank(profile, jobs) {
  if (!jobs.length) return {}

  const candidateSummary = [
    `Role: ${profile.primary_role}`,
    `Level: ${profile.career_stage}`,
    `Targeting: ${(profile.target_role_tags || []).join(', ')}`,
    `Proven skills: ${(profile.proven_skills || []).join(', ')}`,
    `Other skills: ${(profile.skill_groupings || []).slice(0, 15).join(', ')}`,
    `Highlights: ${(profile.experience_highlights || []).slice(0, 3).join(' | ')}`,
    `Industries: ${(profile.industries || []).join(', ')}`,
  ].join('\n')

  const jobBlocks = jobs.map(j => (
    `[${j.job_id}] ${j.title} at ${j.company} (level: ${j.seniority_level || 'unknown'})
Required: ${(j.required_skills || []).join(', ')}
Summary: ${(j.description || '').slice(0, 400)}`
  )).join('\n\n')

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'system',
        content: 'You are a strict but fair recruiter. Score how well the candidate fits each job from 0-100, weighing seniority, required skills, and role alignment. A junior/new-grad candidate is NOT a fit for senior/lead roles — score those low. Return only JSON.'
      }, {
        role: 'user',
        content: `CANDIDATE:
${candidateSummary}

JOBS:
${jobBlocks}

For EACH job id above, return JSON:
{"results":[{"id":"<job_id>","score":0-100,"reason":"one specific sentence referencing skills/level","should_apply":true|false}]}

Scoring: 90-100 perfect, 75-89 strong, 60-74 decent with gaps, below 60 weak/mismatch.`
      }]
    })
    const parsed = JSON.parse(completion.choices[0].message.content)
    const map = {}
    for (const r of parsed.results || []) {
      map[String(r.id)] = {
        score: Math.min(99, Math.max(0, Math.round(r.score || 0))),
        reason: r.reason || '',
        should_apply: r.should_apply !== false,
      }
    }
    return map
  } catch (err) {
    console.error('gptRerank failed:', err.message)
    return {}
  }
}

// ── Orchestrator ────────────────────────────────────────────────────────────
// Hard SQL filters (via match_jobs RPC) → DNA top 30 → GPT rerank top 20 → queue.
// Shared by both entry points. Returns number of rows queued for this user.
//
//   supabase     – service-role client
//   userSettings – row from auto_apply_settings
//   opts.candidateJobs – optional pre-filtered jobs (classify-jobs passes the
//                        single just-classified job to avoid a full re-scan)
export async function runMatchForUser(supabase, userSettings, opts = {}) {
  const uid = userSettings.user_id
  const userJobTypes = userSettings.job_types || ['internship', 'coop']
  const threshold = userSettings.match_threshold || 72
  const dailyLimit = userSettings.daily_limit || 5
  const blacklist = (userSettings.blacklisted_companies || []).map(c => c.toLowerCase())

  // Profile + embedding
  const { data: profile } = await supabase
    .from('intelligence_profiles')
    .select('user_id, primary_role, career_stage, suggested_roles, skill_groupings, experience_highlights, target_role_tags, proven_skills, learning_skills, industries, embedding')
    .eq('user_id', uid)
    .single()

  if (!profile?.embedding || !(profile.target_role_tags?.length)) return 0
  const userEmb = parseEmbedding(profile.embedding)
  if (!userEmb) return 0

  // Daily limit
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const { count: appliedToday } = await supabase
    .from('apply_queue')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', uid)
    .in('status', ['applied', 'processing', 'queued'])
    .gte('queued_at', today.toISOString())

  let remainingSlots = dailyLimit - (appliedToday || 0)
  if (remainingSlots <= 0) return 0

  // Already-queued job ids (avoid duplicates)
  const { data: alreadyQueued } = await supabase
    .from('apply_queue')
    .select('job_id')
    .eq('user_id', uid)
  const queuedJobIds = new Set((alreadyQueued || []).map(q => q.job_id))

  // ── Stage 1: retrieval ──
  let candidates
  if (opts.candidateJobs) {
    // classify-jobs path: score only the just-classified job(s).
    candidates = opts.candidateJobs
  } else {
    // run-matching path: hard filters + pgvector top 50 in Postgres (Bug 3).
    const { data: retrieved, error } = await supabase.rpc('match_jobs', {
      query_embedding: JSON.stringify(userEmb),
      user_job_types: userJobTypes,
      blacklist,
      match_count: 50,
    })
    if (error) {
      console.error('match_jobs RPC failed:', error.message)
      return 0
    }
    candidates = retrieved || []
  }

  // ── Stage 2: DNA score + seniority guard, keep top 30 by DNA ──
  const scored = []
  for (const job of candidates) {
    if (queuedJobIds.has(job.job_id)) continue
    // The RPC already enforces job_type for the run-matching path; the
    // classify-jobs path passes raw jobs, so gate job_type here too.
    if (opts.candidateJobs && !userJobTypes.includes(job.job_type_clean)) continue
    if (blacklist.some(b => b && (job.company || '').toLowerCase().includes(b))) continue
    if (isSeniorMismatch(profile, job)) continue

    const dna = scoreDNA(profile, job)
    if (dna.eliminate) continue

    const similarity = typeof job.similarity === 'number' ? job.similarity : null
    scored.push({ job, dna, similarity })
  }

  scored.sort((a, b) => b.dna.dnaScore - a.dna.dnaScore)
  const shortlist = scored.slice(0, 30)
  if (!shortlist.length) return 0

  // ── Stage 3: GPT rerank top 20 ──
  const rerankInput = shortlist.slice(0, 20).map(s => s.job)
  const rerank = await gptRerank(profile, rerankInput)

  // ── Stage 4: queue ──
  let queued = 0
  // Highest GPT score first so we spend daily slots on the best matches.
  const ranked = shortlist
    .map(s => ({ ...s, ai: rerank[String(s.job.job_id)] }))
    .filter(s => s.ai)
    .sort((a, b) => b.ai.score - a.ai.score)

  for (const { job, dna, similarity, ai } of ranked) {
    if (queued >= remainingSlots) break
    if (ai.score < threshold || ai.should_apply === false) continue

    const embeddingScore = similarity !== null ? calibrateEmbeddingScore(similarity) : null

    const { error } = await supabase.from('apply_queue').insert({
      user_id: uid,
      job_id: job.job_id,
      job_url: job.apply_url,
      company: job.company,
      role: job.title,
      location: job.location,
      match_score: ai.score,
      match_reason: ai.reason,
      match_breakdown: {
        dna_score: dna.dnaScore,
        embedding_score: embeddingScore,
        ai_score: ai.score,
        tag_overlap: dna.tagOverlap,
        required_skills_matched: dna.requiredMatches,
        required_skills_total: dna.requiredTotal,
        similarity: similarity !== null ? Number(similarity.toFixed(4)) : null,
      },
      status: 'queued',
    })

    if (!error) {
      queuedJobIds.add(job.job_id)
      queued++
    }
  }

  return queued
}

// ── helpers ─────────────────────────────────────────────────────────────────
export function parseEmbedding(embedding) {
  if (!embedding) return null
  if (Array.isArray(embedding)) return embedding
  if (typeof embedding === 'string') {
    try { return JSON.parse(embedding) } catch { return null }
  }
  return null
}
