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
  'penetration-testing', 'grc',
  'sustainability', 'environmental', 'climate-tech', 'energy',
  'research', 'ux-research', 'market-research', 'policy-research',
  'journalism', 'editorial', 'video-production', 'photography',
  'education-technology', 'curriculum-design', 'instructional-design',
  'real-estate', 'architecture', 'urban-planning',
  'nonprofit', 'government', 'public-administration',
  'other',
]

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

function deriveJobType(job) {
  const title = (job.title || '').toLowerCase()
  const desc = (job.description || '').toLowerCase()
  const type = (job.job_type || '').toLowerCase()

  if (
    title.includes('intern') || title.includes('internship') ||
    type.includes('intern') || type === 'internship' ||
    desc.includes('internship program') || desc.includes('summer intern')
  ) return 'internship'

  if (
    title.includes('co-op') || title.includes('coop') || title.includes('co op') ||
    desc.includes('co-op program') || desc.includes('cooperative education')
  ) return 'coop'

  if (
    type.includes('contract') || type.includes('freelance') ||
    title.includes('contract') || title.includes('freelance')
  ) return 'contract'

  if (
    type.includes('part') || title.includes('part-time') || title.includes('part time')
  ) return 'parttime'

  if (
    type.includes('full') || type === 'permanent' || type === 'fulltime' ||
    title.includes('full-time') || title.includes('full time')
  ) return 'fulltime'

  if (job.source === 'themuse') return 'internship'

  return 'unknown'
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
    max_tokens: 250,
    temperature: 0,
    messages: [{
      role: 'system',
      content: 'You are a precise job classifier. Return only valid JSON. No markdown, no explanation.'
    }, {
      role: 'user',
      content: `Classify this job posting. Return ONLY a JSON object.

{
  "location_type": "us-remote|us-onsite|non-us|unknown",
  "role_tags": ["array of matching tags"],
  "seniority_level": "intern|entry|junior|mid|senior|lead|unknown"
}

LOCATION TYPE:
- "us-remote": remote + US context
- "us-onsite": specific US city/state, not remote
- "non-us": non-US country mentioned
- "unknown": cannot determine

ROLE TAGS — pick ALL that apply from this list only:
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
penetration-testing, grc,
sustainability, environmental, climate-tech, energy,
research, ux-research, market-research, policy-research,
journalism, editorial, video-production, photography,
education-technology, curriculum-design, instructional-design,
real-estate, architecture, urban-planning,
nonprofit, government, public-administration,
other

SENIORITY:
- "intern": internship/co-op role
- "entry": 0-2 years, new grad, associate
- "junior": 1-3 years explicitly
- "mid": 3-6 years
- "senior": senior/staff/principal in title
- "lead": lead/manager/director/head
- "unknown": cannot determine

Job Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'not specified'}
Description: ${(job.description || '').slice(0, 600)}`
    }]
  })

  const raw = completion.choices[0].message.content.replace(/```json|```/g, '').trim()
  const result = JSON.parse(raw)

  return {
    location_type: VALID_LOCATION_TYPES.includes(result.location_type)
      ? result.location_type : 'unknown',
    role_tags: Array.isArray(result.role_tags)
      ? result.role_tags.filter(t => VALID_TAGS.includes(t)).slice(0, 8)
      : ['other'],
    seniority_level: VALID_SENIORITY.includes(result.seniority_level)
      ? result.seniority_level : 'unknown',
  }
}

async function generateEmbedding(job, classification) {
  const text = `
    Job Title: ${job.title}
    Company: ${job.company}
    Location: ${job.location || ''}
    Job Type: ${classification.job_type_clean}
    Role Categories: ${(classification.role_tags || []).join(', ')}
    Seniority: ${classification.seniority_level}
    Description: ${(job.description || '').slice(0, 2000)}
  `.trim().replace(/\s+/g, ' ')

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return response.data[0].embedding
}

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
      const blacklist = (userSettings.blacklisted_companies || [])
        .map(c => c.toLowerCase())
      if (blacklist.some(b => (job.company || '').toLowerCase().includes(b))) continue

      const userJobTypes = userSettings.job_types || ['internship', 'fulltime']
      if (
        classification.job_type_clean !== 'unknown' &&
        !userJobTypes.includes(classification.job_type_clean)
      ) continue

      const { count: appliedToday } = await supabase
        .from('apply_queue')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['applied', 'processing', 'queued'])
        .gte('queued_at', today.toISOString())

      if ((appliedToday || 0) >= (userSettings.daily_limit || 5)) continue

      const { data: existing } = await supabase
        .from('apply_queue')
        .select('id')
        .eq('user_id', userId)
        .eq('job_id', job.job_id)
        .maybeSingle()

      if (existing) continue

      const { data: profile } = await supabase
        .from('intelligence_profiles')
        .select('embedding, primary_role')
        .eq('user_id', userId)
        .single()

      if (!profile?.embedding) continue

      const userEmb = parseEmbedding(profile.embedding)
      const jobEmb = parseEmbedding(jobEmbedding)

      if (!userEmb || !jobEmb) continue

      const similarity = cosineSimilarity(userEmb, jobEmb)
      const score = Math.round(((similarity + 1) / 2) * 99)

      if (score >= (userSettings.match_threshold || 75)) {
        const { error } = await supabase.from('apply_queue').insert({
          user_id: userId,
          job_id: job.job_id,
          job_url: job.apply_url,
          company: job.company,
          role: job.title,
          location: job.location,
          match_score: score,
          status: 'queued',
        })

        if (!error) queued++
      }
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

  const { data: jobs, error } = await supabase
    .from('job_listings')
    .select('job_id, apply_url, company, title, description, location, job_type, source')
    .eq('classified', false)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!jobs?.length) return NextResponse.json({ message: 'All classified', count: 0 })

  let classified = 0
  let queued = 0
  let failed = 0

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

  return NextResponse.json({
    success: true,
    classified,
    queued,
    failed,
    total: jobs.length,
  })
}