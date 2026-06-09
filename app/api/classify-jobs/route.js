import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ─── VALID VALUES ─────────────────────────────────────────────
const VALID_JOB_TYPES = ['internship', 'coop', 'fulltime', 'parttime', 'contract', 'unknown']
const VALID_LOCATION_TYPES = ['us-remote', 'us-onsite', 'non-us', 'unknown']
const VALID_SENIORITY = ['intern', 'entry', 'junior', 'mid', 'senior', 'lead', 'unknown']
const VALID_TAGS = [
  // Design
  'product-design', 'ux-design', 'ui-design', 'visual-design', 'interaction-design',
  'graphic-design', 'brand-design', 'motion-design', 'design-research',
  // Engineering
  'software-engineering', 'frontend-engineering', 'backend-engineering',
  'full-stack-engineering', 'mobile-engineering', 'ios-engineering', 'android-engineering',
  'devops', 'platform-engineering', 'site-reliability', 'embedded-systems',
  'hardware-engineering', 'electrical-engineering', 'mechanical-engineering',
  'civil-engineering', 'chemical-engineering', 'biomedical-engineering',
  // AI/ML/Data
  'machine-learning', 'ai-engineering', 'data-science', 'data-engineering',
  'data-analysis', 'business-intelligence', 'bioinformatics', 'computational-biology',
  'nlp', 'computer-vision', 'robotics',
  // Product
  'product-management', 'program-management', 'project-management',
  'technical-program-management', 'product-operations',
  // Finance
  'investment-banking', 'financial-analysis', 'accounting', 'audit',
  'private-equity', 'venture-capital', 'equity-research', 'risk-analysis',
  'actuarial', 'corporate-finance', 'treasury', 'tax', 'quantitative-finance',
  // Business
  'business-analysis', 'strategy', 'consulting', 'operations',
  'supply-chain', 'logistics', 'procurement', 'business-development',
  'revenue-operations',
  // Marketing
  'marketing', 'growth', 'content', 'brand', 'digital-marketing',
  'product-marketing', 'seo', 'performance-marketing', 'pr', 'communications',
  'social-media', 'email-marketing', 'demand-generation',
  // Sales
  'sales', 'sales-development', 'account-executive', 'account-management',
  'customer-success', 'partnerships',
  // Healthcare/Science
  'clinical-research', 'healthcare', 'public-health', 'medical-devices',
  'pharmaceuticals', 'biotech', 'genomics', 'drug-discovery',
  'regulatory-affairs', 'quality-assurance',
  // Legal/Compliance
  'legal', 'compliance', 'policy',
  // HR
  'human-resources', 'talent-acquisition', 'people-operations',
  'learning-development', 'compensation-benefits',
  // Security
  'cybersecurity', 'information-security', 'security-engineering',
  'penetration-testing', 'grc',
  // Sustainability
  'sustainability', 'environmental', 'climate-tech', 'energy',
  // Research
  'research', 'ux-research', 'market-research', 'policy-research',
  // Media/Creative
  'journalism', 'editorial', 'video-production', 'photography',
  // Education
  'education-technology', 'curriculum-design', 'instructional-design',
  // Other
  'real-estate', 'architecture', 'urban-planning',
  'nonprofit', 'government', 'public-administration',
  'other',
]

// ─── RULE-BASED: JOB TYPE ─────────────────────────────────────
function deriveJobType(job) {
  const title = (job.title || '').toLowerCase()
  const desc = (job.description || '').toLowerCase()
  const type = (job.job_type || '').toLowerCase()

  // Internship signals
  if (
    title.includes('intern') ||
    title.includes('internship') ||
    type.includes('intern') ||
    type === 'internship' ||
    desc.includes('internship program') ||
    desc.includes('summer intern') ||
    desc.includes('intern cohort')
  ) return 'internship'

  // Co-op signals
  if (
    title.includes('co-op') ||
    title.includes('coop') ||
    title.includes('co op') ||
    desc.includes('co-op program') ||
    desc.includes('cooperative education') ||
    desc.includes('co-op student')
  ) return 'coop'

  // Contract signals
  if (
    type.includes('contract') ||
    type.includes('freelance') ||
    type.includes('temporary') ||
    title.includes('contract') ||
    title.includes('freelance') ||
    title.includes('temp ')
  ) return 'contract'

  // Part-time signals
  if (
    type.includes('part') ||
    type.includes('parttime') ||
    title.includes('part-time') ||
    title.includes('part time')
  ) return 'parttime'

  // Full-time signals
  if (
    type.includes('full') ||
    type === 'permanent' ||
    type === 'fulltime' ||
    title.includes('full-time') ||
    title.includes('full time')
  ) return 'fulltime'

  // Source-based defaults
  if (job.source === 'themuse') return 'internship'

  return 'unknown'
}

// ─── RULE-BASED: DIRECT APPLY ─────────────────────────────────
function deriveIsDirectApply(job) {
  const url = (job.apply_url || '').toLowerCase()
  return (
    url.includes('greenhouse.io') ||
    url.includes('lever.co') ||
    url.includes('ashbyhq.com') ||
    url.includes('jobs.ashby') ||
    job.source === 'greenhouse' ||
    job.source === 'lever' ||
    job.source === 'ashby'
  )
}

// ─── AI: LOCATION + ROLE TAGS + SENIORITY ────────────────────
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
  "role_tags": ["array of matching tags — pick ALL that apply"],
  "seniority_level": "intern|entry|junior|mid|senior|lead|unknown"
}

LOCATION TYPE:
- "us-remote": remote + US context ("remote", "work from anywhere in US", "US only remote")
- "us-onsite": specific US city/state, not remote (e.g. "San Francisco, CA", "New York")  
- "non-us": non-US country (Canada, UK, India, Germany, etc.)
- "unknown": truly cannot determine

ROLE TAGS — pick ALL that apply from this exact list only:
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

ROLE TAG EXAMPLES:
"Product Designer" → ["product-design", "ux-design", "ui-design"]
"UX Researcher" → ["ux-research", "design-research", "product-design"]
"Frontend Engineer" → ["frontend-engineering", "software-engineering"]
"Full Stack Engineer" → ["full-stack-engineering", "frontend-engineering", "backend-engineering"]
"Data Scientist" → ["data-science", "machine-learning", "data-analysis"]
"Product Manager" → ["product-management"]
"Investment Banking Analyst" → ["investment-banking", "financial-analysis"]
"Marketing Intern" → ["marketing", "growth"]
"ML Engineer" → ["machine-learning", "ai-engineering", "software-engineering"]
"Clinical Research Associate" → ["clinical-research", "healthcare"]
"DevOps Engineer" → ["devops", "platform-engineering", "software-engineering"]
"Business Analyst" → ["business-analysis", "operations"]
"Biomedical Engineer" → ["biomedical-engineering", "healthcare"]
"Cybersecurity Analyst" → ["cybersecurity", "information-security"]
"Supply Chain Analyst" → ["supply-chain", "operations", "logistics"]

SENIORITY:
- "intern": internship/co-op role
- "entry": 0-2 years, new grad, associate, junior title
- "junior": explicitly junior level, 1-3 years
- "mid": 3-6 years, no senior/junior qualifier
- "senior": "senior", "sr.", "staff", "principal", "lead" in title
- "lead": "lead", "manager", "director", "head of", "vp"
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
      ? result.location_type
      : 'unknown',
    role_tags: Array.isArray(result.role_tags)
      ? result.role_tags.filter(t => VALID_TAGS.includes(t)).slice(0, 8)
      : ['other'],
    seniority_level: VALID_SENIORITY.includes(result.seniority_level)
      ? result.seniority_level
      : 'unknown',
  }
}

// ─── EMBEDDING ───────────────────────────────────────────────
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

// ─── MATCH AND QUEUE ─────────────────────────────────────────
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
      // Check blacklist
      const blacklist = (userSettings.blacklisted_companies || [])
        .map(c => c.toLowerCase())
      if (blacklist.some(b => (job.company || '').toLowerCase().includes(b))) continue

      // Check job type match
      const userJobTypes = userSettings.job_types || ['internship', 'fulltime']
      if (
        classification.job_type_clean !== 'unknown' &&
        !userJobTypes.includes(classification.job_type_clean)
      ) continue

      // Check daily limit
      const { count: appliedToday } = await supabase
        .from('apply_queue')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['applied', 'processing', 'queued'])
        .gte('queued_at', today.toISOString())

      if ((appliedToday || 0) >= (userSettings.daily_limit || 5)) continue

      // Check not already queued or applied
      const { data: existing } = await supabase
        .from('apply_queue')
        .select('id')
        .eq('user_id', userId)
        .eq('job_id', job.job_id)
        .maybeSingle()

      if (existing) continue

      // Get user profile + embedding
      const { data: profile } = await supabase
        .from('intelligence_profiles')
        .select('embedding, primary_role, skill_groupings, suggested_roles')
        .eq('user_id', userId)
        .single()

      if (!profile?.embedding) continue

      // Cosine similarity
      const similarity = cosineSimilarity(profile.embedding, jobEmbedding)

      // Convert to 0-99 score
      // similarity range is typically 0.3-0.9 for relevant matches
      // normalize: anything above 0.5 is a decent match
      // cosine similarity ranges -1 to 1
// convert to 0-99 scale
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

// ─── COSINE SIMILARITY ───────────────────────────────────────
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

// ─── MAIN ─────────────────────────────────────────────────────
export async function GET(request) {
  const supabase = createServiceSupabase()
  const url = new URL(request.url)
  const limit = parseInt(url.searchParams.get('limit') || '20')

  // Get unclassified jobs
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

  // Process in batches of 5
  for (let i = 0; i < jobs.length; i += 5) {
    const batch = jobs.slice(i, i + 5)

    await Promise.allSettled(batch.map(async (job) => {
      try {
        // Step 1 — rules (free, instant)
        const job_type_clean = deriveJobType(job)
        const is_direct_apply = deriveIsDirectApply(job)

        // Step 2 — AI (location, role_tags, seniority)
        const aiResult = await classifyWithAI(job)

        // Step 3 — full classification object
        const classification = {
          job_type_clean,
          is_direct_apply,
          ...aiResult,
        }

        // Step 4 — embedding
        const embedding = await generateEmbedding(job, classification)

        // Step 5 — save to DB
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

        // Step 6 — match and queue for autopilot users
        const q = await matchAndQueue(
          { ...job, is_direct_apply },
          classification,
          embedding,
          supabase
        )
        queued += q

      } catch (err) {
        console.error(`Classify failed for ${job.job_id}:`, err.message)
        // Mark classified anyway to avoid infinite retry
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