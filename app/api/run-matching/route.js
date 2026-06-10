import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function safeJSON(text, fallback = {}) {
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) { try { return JSON.parse(match[0]) } catch {} }
    return fallback
  }
}

function parseEmbedding(embedding) {
  if (!embedding) return null
  if (Array.isArray(embedding)) return embedding
  if (typeof embedding === 'string') {
    try { return JSON.parse(embedding) } catch { return null } }
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
  return denom === 0 ? 0 : dot / denom
}

async function getAIMatchScore(profile, job) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      temperature: 0,
      messages: [{
        role: 'system',
        content: 'You are a senior recruiter. Is this candidate a genuine fit? Be strict. Return only valid JSON.'
      }, {
        role: 'user',
        content: `Evaluate. Return ONLY JSON:
{
  "final_score": 0-100,
  "verdict": "Strong Match|Good Match|Weak Match|Not a Match",
  "reason": "2 sentences max, specific",
  "green_flags": ["specific positives"],
  "red_flags": ["specific concerns"]
}

CANDIDATE:
Role: ${profile.primary_role}
Level: ${profile.career_stage}
Proven: ${(profile.proven_skills || []).join(', ')}
Skills: ${(profile.skill_groupings || []).slice(0, 10).join(', ')}

JOB:
${job.title} at ${job.company}
Required: ${(job.required_skills || []).join(', ')}
Description: ${(job.description || '').slice(0, 400)}`
      }]
    })
    const result = safeJSON(completion.choices[0].message.content)
    return {
      score: Math.min(99, Math.max(0, result.final_score || 0)),
      verdict: result.verdict || 'Unknown',
      reason: result.reason || '',
      green_flags: result.green_flags || [],
      red_flags: result.red_flags || [],
    }
  } catch {
    return { score: 0, verdict: 'Unknown', reason: '', green_flags: [], red_flags: [] }
  }
}

export async function GET(request) {
  const supabase = createServiceSupabase()
  const url = new URL(request.url)
  const limit = parseInt(url.searchParams.get('limit') || '100')
  const userId = url.searchParams.get('user_id') || null

  // Get autopilot users
  let settingsQuery = supabase
    .from('auto_apply_settings')
    .select('*')
    .eq('enabled', true)

  if (userId) settingsQuery = settingsQuery.eq('user_id', userId)

  const { data: allSettings } = await settingsQuery
  if (!allSettings?.length) return NextResponse.json({ error: 'No autopilot users' })

  let totalQueued = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const userSettings of allSettings) {
    const uid = userSettings.user_id
    const userJobTypes = userSettings.job_types || ['internship', 'coop']
    const threshold = userSettings.match_threshold || 72

    // Get user profile
    const { data: profile } = await supabase
      .from('intelligence_profiles')
      .select('*')
      .eq('user_id', uid)
      .single()

    if (!profile?.embedding || !profile?.target_role_tags?.length) continue

    const userEmb = parseEmbedding(profile.embedding)
    if (!userEmb) continue

    const userTags = profile.target_role_tags || []
    const blacklist = (userSettings.blacklisted_companies || []).map(c => c.toLowerCase())

    // Check daily limit
    const { count: appliedToday } = await supabase
      .from('apply_queue')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid)
      .in('status', ['applied', 'processing', 'queued'])
      .gte('queued_at', today.toISOString())

    if ((appliedToday || 0) >= (userSettings.daily_limit || 5)) continue

    const remainingSlots = (userSettings.daily_limit || 5) - (appliedToday || 0)

    // Get already queued job IDs for this user
    const { data: alreadyQueued } = await supabase
      .from('apply_queue')
      .select('job_id')
      .eq('user_id', uid)

    const queuedJobIds = new Set(alreadyQueued?.map(q => q.job_id) || [])

    // Get classified direct-apply internship jobs matching user's job types
    const { data: jobs } = await supabase
      .from('job_listings')
      .select('job_id, apply_url, company, title, description, location, job_type_clean, role_tags, required_skills, nice_skills, seniority_level, embedding')
      .eq('classified', true)
      .eq('is_direct_apply', true)
      .in('job_type_clean', userJobTypes)
      .not('embedding', 'is', null)
      .limit(limit)

    if (!jobs?.length) continue

    let userQueued = 0

    for (const job of jobs) {
      if (userQueued >= remainingSlots) break
      if (queuedJobIds.has(job.job_id)) continue

      // Stage 1: blacklist
      if (blacklist.some(b => (job.company || '').toLowerCase().includes(b))) continue

      // Stage 2: seniority filter
      const seniorTitles = ['senior', 'sr.', 'staff', 'principal',
        'manager', 'director', 'head of', 'vp ', 'chief']
      const isSenior = seniorTitles.some(t => (job.title || '').toLowerCase().includes(t))
      const isJunior = ['Student', 'New Grad', 'Junior'].includes(profile.career_stage || '')
      if (isSenior && isJunior) continue

      // Stage 3: role tag overlap
      const jobTags = job.role_tags || []
      const tagOverlap = jobTags.filter(t => userTags.includes(t))
      if (tagOverlap.length === 0) continue

      // Stage 4: embedding similarity
      const jobEmb = parseEmbedding(job.embedding)
      if (!jobEmb) continue

      const similarity = cosineSimilarity(userEmb, jobEmb)
      const embScore = Math.round(((similarity + 1) / 2) * 99)

      // Quick filter — don't waste AI calls on clearly bad matches
      if (embScore < 60) continue

      // Stage 5: AI judge
      const aiResult = await getAIMatchScore(profile, job)
      if (aiResult.score < threshold) continue

      // Queue it
      const { error } = await supabase.from('apply_queue').insert({
        user_id: uid,
        job_id: job.job_id,
        job_url: job.apply_url,
        company: job.company,
        role: job.title,
        location: job.location,
        match_score: aiResult.score,
        match_reason: aiResult.reason,
        match_breakdown: {
          embedding_score: embScore,
          ai_score: aiResult.score,
          verdict: aiResult.verdict,
          tag_overlap: tagOverlap,
          green_flags: aiResult.green_flags,
          red_flags: aiResult.red_flags,
        },
        status: 'queued',
      })

      if (!error) {
        queuedJobIds.add(job.job_id)
        userQueued++
        totalQueued++
      }
    }
  }

  return NextResponse.json({ success: true, total_queued: totalQueued })
}