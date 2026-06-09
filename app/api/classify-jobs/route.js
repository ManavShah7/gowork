import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const VALID_LOCATION_TYPES = ['us-remote', 'us-onsite', 'non-us', 'unknown']
const VALID_SENIORITY = ['intern', 'entry', 'junior', 'mid', 'senior', 'lead', 'unknown']
const VALID_TAGS = [
  'product-design', 'ux-design', 'ui-design', 'visual-design', 'interaction-design',
  'graphic-design', 'brand-design', 'motion-design', 'design-research',
  'software-engineering', 'frontend-engineering', 'backend-engineering',
  'full-stack-engineering', 'mobile-engineering', 'ios-engineering', 'android-engineering',
  'devops', 'platform-engineering', 'site-reliability', 'embedded-systems',
  'hardware-engineering', 'electrical-engineering', 'mechanical-engineering',
  'civil-engineering', 'chemical-engineering', 'biomedical-engineering',
  'machine-learning', 'ai-engineering', 'data-science', 'data-engineering',
  'data-analysis', 'business-intelligence', 'bioinformatics', 'computational-biology',
  'nlp', 'computer-vision', 'robotics',
  'product-management', 'program-management', 'project-management',
  'technical-program-management', 'product-operations',
  'investment-banking', 'financial-analysis', 'accounting', 'audit',
  'private-equity', 'venture-capital', 'equity-research', 'risk-analysis',
  'actuarial', 'corporate-finance', 'treasury', 'tax', 'quantitative-finance',
  'business-analysis', 'strategy', 'consulting', 'operations',
  'supply-chain', 'logistics', 'procurement', 'business-development', 'revenue-operations',
  'marketing', 'growth', 'content', 'brand', 'digital-marketing',
  'product-marketing', 'seo', 'performance-marketing', 'pr', 'communications',
  'social-media', 'email-marketing', 'demand-generation',
  'sales', 'sales-development', 'account-executive', 'account-management',
  'customer-success', 'partnerships',
  'clinical-research', 'healthcare', 'public-health', 'medical-devices',
  'pharmaceuticals', 'biotech', 'genomics', 'drug-discovery',
  'regulatory-affairs', 'quality-assurance',
  'legal', 'compliance', 'policy',
  'human-resources', 'talent-acquisition', 'people-operations',
  'learning-development', 'compensation-benefits',
  'cybersecurity', 'information-security', 'security-engineering',
  'sustainability', 'environmental', 'climate-tech', 'energy',
  'research', 'ux-research', 'market-research', 'policy-research',
  'journalism', 'editorial', 'video-production',
  'education-technology', 'curriculum-design', 'instructional-design',
  'real-estate', 'architecture', 'urban-planning',
  'nonprofit', 'government', 'public-administration',
  'other',
]

// ─── HELPERS ─────────────────────────────────────────────────

function safeJSON(text, fallback = {}) {
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try { return JSON.parse(match[0]) } catch {}
    }
    return fallback
  }
}

function parseEmbedding(embedding) {
  if (!embedding) return null
  if (Array.isArray(embedding)) return embedding
  if (typeof embedding === 'string') {
    try { return JSON.parse(embedding) } catch { return null }
  }
  return null
}

function deriveJobType(job) {
  const title = (job.title || '').toLowerCase()
  const desc = (job.description || '').toLowerCase()
  const type = (job.job_type || '').toLowerCase()

  if (title.includes('intern') || type.includes('intern') ||
    desc.includes('internship program') || desc.includes('summer intern')) return 'internship'
  if (title.includes('co-op') || title.includes('coop') ||
    desc.includes('co-op program') || desc.includes('cooperative education')) return 'coop'
  if (type.includes('contract') || title.includes('contract')) return 'contract'
  if (type.includes('part') || title.includes('part-time')) return 'parttime'
  if (type.includes('full') || type === 'permanent') return 'fulltime'
  if (job.source === 'themuse') return 'internship'
  return 'unknown'
}

function deriveIsDirectApply(job) {
  const url = (job.apply_url || '').toLowerCase()
  return (
    url.includes('greenhouse.io') || url.includes('lever.co') ||
    url.includes('ashbyhq.com') || job.source === 'greenhouse' ||
    job.source === 'lever' || job.source === 'ashby'
  )
}

// ─── CLASSIFY JOB WITH AI ─────────────────────────────────────

async function classifyWithAI(job) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 400,
    temperature: 0,
    messages: [{
      role: 'system',
      content: 'You are a precise job classifier. Return only valid JSON. No markdown.'
    }, {
      role: 'user',
      content: `Classify this job. Return ONLY a JSON object:
{
  "location_type": "us-remote|us-onsite|non-us|unknown",
  "role_tags": ["tags from allowed list"],
  "seniority_level": "intern|entry|junior|mid|senior|lead|unknown",
  "required_skills": ["specific skills explicitly required — lowercase, e.g. 'figma', 'python', 'sql'"],
  "nice_skills": ["preferred but not required skills — lowercase"]
}

LOCATION: us-remote (remote+US), us-onsite (US city), non-us (other country), unknown
SENIORITY: intern (internship), entry (0-2yr/new grad), junior (1-3yr), mid (3-6yr), senior (senior/staff/principal), lead (manager/director/vp)
ROLE TAGS (pick ALL that apply):
${VALID_TAGS.join(', ')}

REQUIRED SKILLS: extract only skills explicitly listed as requirements — be specific and lowercase
NICE SKILLS: extract preferred/bonus skills

Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'unknown'}
Description: ${(job.description || '').slice(0, 1000)}`
    }]
  })

  const result = safeJSON(completion.choices[0].message.content)

  return {
    location_type: VALID_LOCATION_TYPES.includes(result.location_type) ? result.location_type : 'unknown',
    role_tags: Array.isArray(result.role_tags) ? result.role_tags.filter(t => VALID_TAGS.includes(t)).slice(0, 8) : ['other'],
    seniority_level: VALID_SENIORITY.includes(result.seniority_level) ? result.seniority_level : 'unknown',
    required_skills: Array.isArray(result.required_skills) ? result.required_skills.map(s => s.toLowerCase()).slice(0, 20) : [],
    nice_skills: Array.isArray(result.nice_skills) ? result.nice_skills.map(s => s.toLowerCase()).slice(0, 10) : [],
  }
}

// ─── GENERATE EMBEDDING ──────────────────────────────────────

async function generateEmbedding(job, classification) {
  const text = `
    Job: ${job.title} at ${job.company}
    Location: ${job.location || ''}
    Type: ${classification.job_type_clean}
    Roles: ${(classification.role_tags || []).join(', ')}
    Level: ${classification.seniority_level}
    Required: ${(classification.required_skills || []).join(', ')}
    Description: ${(job.description || '').slice(0, 2000)}
  `.trim().replace(/\s+/g, ' ')

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return response.data[0].embedding
}

// ─── STAGE 4: AI CROSS CHECK ─────────────────────────────────

async function getAIMatchScore(profile, job, dnaScore, jdCoverageScore) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      temperature: 0,
      messages: [{
        role: 'system',
        content: 'You are a senior recruiter. Evaluate if this candidate is a genuine fit for this job. Be strict and realistic. Return only valid JSON.'
      }, {
        role: 'user',
        content: `Evaluate this match. Return ONLY a JSON object:
{
  "final_score": 0-100,
  "verdict": "Strong Match|Good Match|Weak Match|Not a Match",
  "reason": "2-3 specific sentences referencing actual skills and experience",
  "red_flags": ["any concerns or mismatches"],
  "green_flags": ["specific reasons this is a good match"]
}

SCORING GUIDE:
90-100: Perfect fit — all required skills, right level, right role
75-89: Strong fit — most required skills, minor gaps
60-74: Decent fit — some required skills, notable gaps
Below 60: Weak fit — missing key requirements

Preliminary DNA score: ${dnaScore}/100
JD Coverage score: ${jdCoverageScore}/100

CANDIDATE:
Role: ${profile.primary_role}
Level: ${profile.career_stage}
Proven skills: ${(profile.proven_skills || []).join(', ')}
All skills: ${(profile.skill_groupings || []).slice(0, 15).join(', ')}
Key achievements: ${(profile.experience_highlights || []).slice(0, 3).join(' | ')}
Industries: ${(profile.industries || []).join(', ')}

JOB:
Title: ${job.title} at ${job.company}
Level: ${job.seniority_level}
Required skills: ${(job.required_skills || []).join(', ')}
Description: ${(job.description || '').slice(0, 600)}`
      }]
    })

    const result = safeJSON(completion.choices[0].message.content)
    return {
      score: Math.min(99, Math.max(0, result.final_score || 0)),
      verdict: result.verdict || 'Unknown',
      reason: result.reason || '',
      red_flags: result.red_flags || [],
      green_flags: result.green_flags || [],
    }
  } catch {
    return { score: dnaScore, verdict: 'Unknown', reason: '', red_flags: [], green_flags: [] }
  }
}

// ─── 4-STAGE MATCH AND QUEUE ─────────────────────────────────

async function matchAndQueue(job, classification, jobEmbedding, supabase) {
  if (!job.is_direct_apply) return 0

  const { data: settings } = await supabase
    .from('auto_apply_settings')
    .select('*')
    .eq('enabled', true)

  if (!settings?.length) return 0

  let queued = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const userSettings of settings) {
    const userId = userSettings.user_id

    try {
      // ── STAGE 1A: BLACKLIST ───────────────────────────
      const blacklist = (userSettings.blacklisted_companies || []).map(c => c.toLowerCase())
      if (blacklist.some(b => (job.company || '').toLowerCase().includes(b))) continue

      // ── STAGE 1B: JOB TYPE ───────────────────────────
      const userJobTypes = userSettings.job_types || ['internship', 'coop']
      if (classification.job_type_clean !== 'unknown' &&
        !userJobTypes.includes(classification.job_type_clean)) continue

      // ── STAGE 1C: DAILY LIMIT ────────────────────────
      const { count: appliedToday } = await supabase
        .from('apply_queue')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['applied', 'processing', 'queued'])
        .gte('queued_at', today.toISOString())

      if ((appliedToday || 0) >= (userSettings.daily_limit || 5)) continue

      // ── STAGE 1D: ALREADY QUEUED ─────────────────────
      const { data: existing } = await supabase
        .from('apply_queue')
        .select('id')
        .eq('user_id', userId)
        .eq('job_id', job.job_id)
        .maybeSingle()

      if (existing) continue

      // ── GET PROFILE ──────────────────────────────────
      const { data: profile } = await supabase
        .from('intelligence_profiles')
        .select('embedding, primary_role, career_stage, suggested_roles, skill_groupings, experience_highlights, target_role_tags, proven_skills, learning_skills, industries')
        .eq('user_id', userId)
        .single()

      if (!profile) continue

      // ── STAGE 1E: SENIORITY FILTER ───────────────────
      const seniorTitles = ['senior', 'sr.', 'staff', 'principal',
        'manager', 'director', 'head of', 'vp ', 'vice president', 'chief', 'lead ']
      const jobTitleLower = (job.title || '').toLowerCase()
      const isSeniorRole = seniorTitles.some(t => jobTitleLower.includes(t))
      const isJuniorUser = ['Student', 'New Grad', 'Junior'].includes(profile.career_stage || 'Student')
      if (isSeniorRole && isJuniorUser) continue

      // ── STAGE 1F: ROLE TAG OVERLAP ───────────────────
      const userTags = profile.target_role_tags || []
      const jobTags = classification.role_tags || []
      const hasRoleOverlap = jobTags.some(tag => userTags.includes(tag))
      if (!hasRoleOverlap) continue

      // ── STAGE 2: DNA SCORE ───────────────────────────
      const requiredSkills = classification.required_skills || []
      const niceSkills = classification.nice_skills || []
      const provenSkills = (profile.proven_skills || []).map(s => s.toLowerCase())
      const learningSkills = (profile.learning_skills || []).map(s => s.toLowerCase())
      const allUserSkills = [...provenSkills, ...learningSkills]

      // Required skills coverage (0-50 points)
      let requiredMatches = 0
      if (requiredSkills.length > 0) {
        requiredMatches = requiredSkills.filter(skill =>
          allUserSkills.some(us => us.includes(skill) || skill.includes(us))
        ).length
        const requiredCoverage = requiredMatches / requiredSkills.length
        // Must cover at least 30% of required skills
        if (requiredCoverage < 0.3) continue
      }

      const requiredScore = requiredSkills.length > 0
        ? Math.round((requiredMatches / requiredSkills.length) * 50)
        : 35 // default if no required skills listed

      // Nice-to-have skills (0-20 points)
      const niceMatches = niceSkills.filter(skill =>
        allUserSkills.some(us => us.includes(skill) || skill.includes(us))
      ).length
      const niceScore = niceSkills.length > 0
        ? Math.round((niceMatches / niceSkills.length) * 20)
        : 10

      // Role tag overlap depth (0-20 points)
      const overlapCount = jobTags.filter(tag => userTags.includes(tag)).length
      const roleScore = Math.min(20, overlapCount * 7)

      // Industry match (0-10 points)
      const userIndustries = (profile.industries || []).map(i => i.toLowerCase())
      const jobDesc = (job.description || '').toLowerCase()
      const industryMatch = userIndustries.some(ind => jobDesc.includes(ind))
      const industryScore = industryMatch ? 10 : 0

      const dnaScore = requiredScore + niceScore + roleScore + industryScore

      // Must score at least 40 DNA points
      if (dnaScore < 40) continue

      // ── STAGE 3: JD vs RESUME COVERAGE ───────────────
      const allSkillsStr = (profile.skill_groupings || []).map(s => s.toLowerCase()).join(' ')
      const jobDescLower = (job.description || '').toLowerCase()
      const jobTitleStr = (job.title || '').toLowerCase()

      // Count how many user skills appear in the JD
      const skillMentions = (profile.skill_groupings || []).filter(skill => {
        const s = skill.toLowerCase()
        return jobDescLower.includes(s) || jobTitleStr.includes(s)
      }).length

      const jdCoverageScore = Math.min(100, skillMentions * 10)

      // Need at least 1 skill mentioned in JD
      if (jdCoverageScore === 0 && requiredSkills.length > 0) continue

      // ── STAGE 4: AI CROSS CHECK ───────────────────────
      const aiResult = await getAIMatchScore(profile, {
        ...job,
        seniority_level: classification.seniority_level,
        required_skills: classification.required_skills,
        nice_skills: classification.nice_skills,
      }, dnaScore, jdCoverageScore)

      const finalScore = aiResult.score
      if (finalScore < (userSettings.match_threshold || 72)) continue

      // ── QUEUE IT ──────────────────────────────────────
      const matchBreakdown = {
        dna_score: dnaScore,
        jd_coverage: jdCoverageScore,
        ai_score: finalScore,
        verdict: aiResult.verdict,
        green_flags: aiResult.green_flags,
        red_flags: aiResult.red_flags,
        required_skills_matched: requiredMatches,
        required_skills_total: requiredSkills.length,
      }

      const { error } = await supabase.from('apply_queue').insert({
        user_id: userId,
        job_id: job.job_id,
        job_url: job.apply_url,
        company: job.company,
        role: job.title,
        location: job.location,
        match_score: finalScore,
        match_reason: aiResult.reason,
        match_breakdown: matchBreakdown,
        status: 'queued',
      })

      if (!error) queued++

    } catch (err) {
      console.error(`Queue error for user ${userId}:`, err.message)
    }
  }

  return queued
}

// ─── MAIN ─────────────────────────────────────────────────────

export async function GET(request) {
  const supabase = createServiceSupabase()
  const url = new URL(request.url)
  const limit = parseInt(url.searchParams.get('limit') || '20')

  const { data: jobs, error } = await supabase
    .from('job_listings')
    .select('job_id, apply_url, company, title, description, location, job_type, source')
    .eq('classified', false)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!jobs?.length) return NextResponse.json({ message: 'All classified', count: 0 })

  let classified = 0, queued = 0, failed = 0

  for (let i = 0; i < jobs.length; i += 5) {
    const batch = jobs.slice(i, i + 5)

    await Promise.allSettled(batch.map(async (job) => {
      try {
        const job_type_clean = deriveJobType(job)
        const is_direct_apply = deriveIsDirectApply(job)
        const aiResult = await classifyWithAI(job)

        const classification = {
          job_type_clean,
          is_direct_apply,
          ...aiResult,
        }

        const embedding = await generateEmbedding(job, classification)

        const { error: updateError } = await supabase
          .from('job_listings')
          .update({
            job_type_clean: classification.job_type_clean,
            location_type: classification.location_type,
            role_tags: classification.role_tags,
            seniority_level: classification.seniority_level,
            is_direct_apply: classification.is_direct_apply,
            required_skills: classification.required_skills,
            nice_skills: classification.nice_skills,
            embedding,
            classified: true,
          })
          .eq('job_id', job.job_id)

        if (updateError) throw updateError
        classified++

        const q = await matchAndQueue(
          { ...job, is_direct_apply },
          classification,
          embedding,
          supabase
        )
        queued += q

      } catch (err) {
        console.error(`Classify failed for ${job.job_id}:`, err.message)
        await supabase
          .from('job_listings')
          .update({
            classified: true,
            job_type_clean: deriveJobType(job),
            is_direct_apply: deriveIsDirectApply(job),
            role_tags: ['other'],
            location_type: 'unknown',
            seniority_level: 'unknown',
          })
          .eq('job_id', job.job_id)
        failed++
      }
    }))
  }

  return NextResponse.json({ success: true, classified, queued, failed, total: jobs.length })
}