import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const VALID_JOB_TYPES = ['internship', 'coop', 'fulltime', 'parttime', 'contract', 'unknown']
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

function deriveIsDirectApply(job) {
  const url = (job.apply_url || '').toLowerCase()
  return (
    url.includes('greenhouse.io') ||
    url.includes('lever.co') ||
    url.includes('ashbyhq.com') ||
    job.source === 'greenhouse' ||
    job.source === 'lever' ||
    job.source === 'ashby'
  )
}

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
  "job_type_clean": "internship|coop|fulltime|parttime|contract|unknown",
  "location_type": "us-remote|us-onsite|non-us|unknown",
  "role_tags": ["tags from allowed list"],
  "seniority_level": "intern|entry|junior|mid|senior|lead|unknown",
  "required_skills": ["skills explicitly required — lowercase"],
  "nice_skills": ["preferred skills — lowercase"]
}

JOB TYPE — be very precise:
- "internship": title explicitly says "Intern" or "Internship" as the ROLE TYPE
- "coop": title says "Co-op", "Coop", "Cooperative Education"
- "fulltime": permanent role, no internship/coop language
- "parttime": explicitly part-time
- "contract": contract, freelance, temporary
- "unknown": cannot determine
CRITICAL: "Internal Audit", "International Manager" are NOT internships.
Only internship if the POSITION ITSELF is an internship program.

LOCATION: us-remote (remote+US), us-onsite (US city/state), non-us (other country), unknown

SENIORITY:
- intern: internship/co-op role
- entry: 0-2yr, new grad, associate
- junior: 1-3yr explicitly
- mid: 3-6yr, no qualifier
- senior: senior/sr/staff/principal in title
- lead: manager/director/vp/head/chief/lead
- unknown: cannot determine

ROLE TAGS (pick ALL that apply):
product-design, ux-design, ui-design, visual-design, interaction-design,
graphic-design, brand-design, motion-design, design-research,
software-engineering, frontend-engineering, backend-engineering,
full-stack-engineering, mobile-engineering, ios-engineering, android-engineering,
devops, platform-engineering, site-reliability, embedded-systems,
hardware-engineering, electrical-engineering, mechanical-engineering,
civil-engineering, chemical-engineering, biomedical-engineering,
machine-learning, ai-engineering, data-science, data-engineering,
data-analysis, business-intelligence, bioinformatics, computational-biology,
nlp, computer-vision, robotics,
product-management, program-management, project-management,
technical-program-management, product-operations,
investment-banking, financial-analysis, accounting, audit,
private-equity, venture-capital, equity-research, risk-analysis,
actuarial, corporate-finance, treasury, tax, quantitative-finance,
business-analysis, strategy, consulting, operations,
supply-chain, logistics, procurement, business-development, revenue-operations,
marketing, growth, content, brand, digital-marketing,
product-marketing, seo, performance-marketing, pr, communications,
social-media, email-marketing, demand-generation,
sales, sales-development, account-executive, account-management,
customer-success, partnerships,
clinical-research, healthcare, public-health, medical-devices,
pharmaceuticals, biotech, genomics, drug-discovery,
regulatory-affairs, quality-assurance,
legal, compliance, policy,
human-resources, talent-acquisition, people-operations,
learning-development, compensation-benefits,
cybersecurity, information-security, security-engineering,
sustainability, environmental, climate-tech, energy,
research, ux-research, market-research, policy-research,
journalism, editorial, video-production,
education-technology, curriculum-design, instructional-design,
real-estate, architecture, urban-planning,
nonprofit, government, public-administration,
other

REQUIRED SKILLS: specific skills listed as requirements — lowercase
NICE SKILLS: preferred/bonus skills — lowercase

Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'unknown'}
Job Type Field: ${job.job_type || 'not specified'}
Description: ${(job.description || '').slice(0, 1000)}`
    }]
  })

  const result = safeJSON(completion.choices[0].message.content)

  return {
    job_type_clean: VALID_JOB_TYPES.includes(result.job_type_clean)
      ? result.job_type_clean : 'fulltime',
    location_type: VALID_LOCATION_TYPES.includes(result.location_type)
      ? result.location_type : 'unknown',
    role_tags: Array.isArray(result.role_tags)
      ? result.role_tags.filter(t => VALID_TAGS.includes(t)).slice(0, 8)
      : ['other'],
    seniority_level: VALID_SENIORITY.includes(result.seniority_level)
      ? result.seniority_level : 'unknown',
    required_skills: Array.isArray(result.required_skills)
      ? result.required_skills.map(s => s.toLowerCase()).slice(0, 20)
      : [],
    nice_skills: Array.isArray(result.nice_skills)
      ? result.nice_skills.map(s => s.toLowerCase()).slice(0, 10)
      : [],
  }
}

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

async function getAIMatchScore(profile, job, dnaScore, jdCoverageScore) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      temperature: 0,
      messages: [{
        role: 'system',
        content: 'You are a senior recruiter. Evaluate if this candidate is a genuine fit. Be strict and realistic. Return only valid JSON.'
      }, {
        role: 'user',
        content: `Evaluate this match. Return ONLY a JSON object:
{
  "final_score": 0-100,
  "verdict": "Strong Match|Good Match|Weak Match|Not a Match",
  "reason": "2-3 specific sentences referencing actual skills and experience",
  "red_flags": ["any concerns"],
  "green_flags": ["specific reasons this is a good match"]
}

SCORING:
90-100: Perfect — all required skills, right level, right role
75-89: Strong — most required skills, minor gaps
60-74: Decent — some skills, notable gaps
Below 60: Weak — missing key requirements

DNA score: ${dnaScore}/100
JD Coverage: ${jdCoverageScore}/100

CANDIDATE:
Role: ${profile.primary_role}
Level: ${profile.career_stage}
Proven skills: ${(profile.proven_skills || []).join(', ')}
All skills: ${(profile.skill_groupings || []).slice(0, 15).join(', ')}
Highlights: ${(profile.experience_highlights || []).slice(0, 3).join(' | ')}
Industries: ${(profile.industries || []).join(', ')}

JOB:
Title: ${job.title} at ${job.company}
Level: ${job.seniority_level}
Required: ${(job.required_skills || []).join(', ')}
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

async function matchAndQueue(job, classification, supabase) {
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
      // STAGE 1A: Blacklist
      const blacklist = (userSettings.blacklisted_companies || []).map(c => c.toLowerCase())
      if (blacklist.some(b => (job.company || '').toLowerCase().includes(b))) continue

      // STAGE 1B: Job type
      const userJobTypes = userSettings.job_types || ['internship', 'coop']
      if (
        classification.job_type_clean !== 'unknown' &&
        !userJobTypes.includes(classification.job_type_clean)
      ) continue

      // STAGE 1C: Daily limit
      const { count: appliedToday } = await supabase
        .from('apply_queue')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['applied', 'processing', 'queued'])
        .gte('queued_at', today.toISOString())

      if ((appliedToday || 0) >= (userSettings.daily_limit || 5)) continue

      // STAGE 1D: Already queued
      const { data: existing } = await supabase
        .from('apply_queue')
        .select('id')
        .eq('user_id', userId)
        .eq('job_id', job.job_id)
        .maybeSingle()

      if (existing) continue

      // Get profile
      const { data: profile } = await supabase
        .from('intelligence_profiles')
        .select('embedding, primary_role, career_stage, suggested_roles, skill_groupings, experience_highlights, target_role_tags, proven_skills, learning_skills, industries')
        .eq('user_id', userId)
        .single()

      if (!profile) continue

      // STAGE 1E: Seniority filter
      const seniorTitles = ['senior', 'sr.', 'staff', 'principal',
        'manager', 'director', 'head of', 'vp ', 'vice president', 'chief', 'lead ']
      const jobTitleLower = (job.title || '').toLowerCase()
      const isSeniorRole = seniorTitles.some(t => jobTitleLower.includes(t))
      const isJuniorUser = ['Student', 'New Grad', 'Junior'].includes(profile.career_stage || 'Student')
      if (isSeniorRole && isJuniorUser) continue

      // STAGE 1F: Role tag overlap
      const userTags = profile.target_role_tags || []
      const jobTags = classification.role_tags || []
      const tagOverlap = jobTags.filter(tag => userTags.includes(tag))
      if (tagOverlap.length === 0) continue

      // STAGE 2: DNA score
      const requiredSkills = classification.required_skills || []
      const niceSkills = classification.nice_skills || []
      const provenSkills = (profile.proven_skills || []).map(s => s.toLowerCase())
      const learningSkills = (profile.learning_skills || []).map(s => s.toLowerCase())
      const allUserSkills = [...new Set([...provenSkills, ...learningSkills])]

      let requiredMatches = 0
      if (requiredSkills.length > 0) {
        requiredMatches = requiredSkills.filter(skill =>
          allUserSkills.some(us => us.includes(skill) || skill.includes(us))
        ).length
        if (requiredMatches / requiredSkills.length < 0.3) continue
      }

      const requiredScore = requiredSkills.length > 0
        ? Math.round((requiredMatches / requiredSkills.length) * 50)
        : 35

      const niceMatches = niceSkills.filter(skill =>
        allUserSkills.some(us => us.includes(skill) || skill.includes(us))
      ).length
      const niceScore = niceSkills.length > 0
        ? Math.round((niceMatches / niceSkills.length) * 20)
        : 10

      const roleScore = Math.min(20, tagOverlap.length * 7)

      const userIndustries = (profile.industries || []).map(i => i.toLowerCase())
      const jobDesc = (job.description || '').toLowerCase()
      const industryScore = userIndustries.some(ind => jobDesc.includes(ind)) ? 10 : 0

      const dnaScore = requiredScore + niceScore + roleScore + industryScore
      if (dnaScore < 40) continue

      // STAGE 3: JD coverage
      const allSkillsLower = (profile.skill_groupings || []).map(s => s.toLowerCase())
      const jobDescLower = (job.description || '').toLowerCase()
      const jobTitleStr = (job.title || '').toLowerCase()

      const skillMentions = allSkillsLower.filter(skill =>
        jobDescLower.includes(skill) || jobTitleStr.includes(skill)
      ).length

      const jdCoverageScore = Math.min(100, skillMentions * 10)
      if (jdCoverageScore === 0 && requiredSkills.length > 0) continue

      // STAGE 4: AI cross check
      const aiResult = await getAIMatchScore(
        profile,
        {
          ...job,
          seniority_level: classification.seniority_level,
          required_skills: classification.required_skills,
          nice_skills: classification.nice_skills,
        },
        dnaScore,
        jdCoverageScore
      )

      const finalScore = aiResult.score
      if (finalScore < (userSettings.match_threshold || 72)) continue

      // Queue it
      const { error } = await supabase.from('apply_queue').insert({
        user_id: userId,
        job_id: job.job_id,
        job_url: job.apply_url,
        company: job.company,
        role: job.title,
        location: job.location,
        match_score: finalScore,
        match_reason: aiResult.reason,
        match_breakdown: {
          dna_score: dnaScore,
          jd_coverage: jdCoverageScore,
          ai_score: finalScore,
          verdict: aiResult.verdict,
          green_flags: aiResult.green_flags,
          red_flags: aiResult.red_flags,
          required_skills_matched: requiredMatches,
          required_skills_total: requiredSkills.length,
          tag_overlap: tagOverlap,
        },
        status: 'queued',
      })

      if (!error) queued++

    } catch (err) {
      console.error(`Queue error for user ${userId}:`, err.message)
    }
  }

  return queued
}

export async function GET(request) {
  const supabase = createServiceSupabase()
  const url = new URL(request.url)
  const limit = parseInt(url.searchParams.get('limit') || '20')

  // Prioritize jobs with "intern" in title first
  let { data: jobs, error } = await supabase
    .from('job_listings')
    .select('job_id, apply_url, company, title, description, location, job_type, source')
    .eq('classified', false)
    .ilike('title', '%intern%')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fallback to any unclassified if no intern jobs left
  if (!jobs?.length) {
    const fallback = await supabase
      .from('job_listings')
      .select('job_id, apply_url, company, title, description, location, job_type, source')
      .eq('classified', false)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 })
    jobs = fallback.data
  }

  if (!jobs?.length) return NextResponse.json({ message: 'All classified', count: 0 })

  let classified = 0, queued = 0, failed = 0

  for (let i = 0; i < jobs.length; i += 5) {
    const batch = jobs.slice(i, i + 5)

    await Promise.allSettled(batch.map(async (job) => {
      try {
        const is_direct_apply = deriveIsDirectApply(job)
        const classification = await classifyWithAI(job)
        classification.is_direct_apply = is_direct_apply

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
          { ...job, is_direct_apply, job_id: job.job_id },
          classification,
          supabase
        )
        queued += q

      } catch (err) {
        console.error(`Classify failed for ${job.job_id}:`, err.message)
        await supabase
          .from('job_listings')
          .update({
            classified: true,
            job_type_clean: 'fulltime',
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