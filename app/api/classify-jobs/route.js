import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { buildJobEmbeddingText, embed, runMatchForUser } from '@/lib/matching'
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

// Use the shared clean embedding scheme (lib/matching.js §6) so job vectors are
// symmetric with the user vectors — the only valid basis for cosine comparison.
async function generateEmbedding(job, classification) {
  return embed(buildJobEmbeddingText(job, classification))
}

// Match a freshly classified job to every enabled autopilot user using the SAME
// shared pipeline as run-matching (Bug 2). We pass the one just-classified job as
// a pre-filtered candidate so we don't re-scan the whole table.
async function matchAndQueue(job, classification, supabase) {
  if (!job.is_direct_apply) return 0

  const { data: settings } = await supabase
    .from('auto_apply_settings')
    .select('*')
    .eq('enabled', true)

  if (!settings?.length) return 0

  const candidateJob = {
    job_id: job.job_id,
    apply_url: job.apply_url,
    company: job.company,
    title: job.title,
    description: job.description,
    location: job.location,
    job_type_clean: classification.job_type_clean,
    role_tags: classification.role_tags,
    required_skills: classification.required_skills,
    nice_skills: classification.nice_skills,
    seniority_level: classification.seniority_level,
  }

  let queued = 0
  for (const userSettings of settings) {
    try {
      queued += await runMatchForUser(supabase, userSettings, { candidateJobs: [candidateJob] })
    } catch (err) {
      console.error(`Queue error for user ${userSettings.user_id}:`, err.message)
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
        // Bug 5: do NOT write fake-valid metadata on failure. Previously this
        // wrote classified=true with job_type_clean='fulltime', role_tags=['other'],
        // which permanently buried real matches (e.g. the Blockchain.com design
        // intern). Leave classified=false so the job is retried on the next run.
        console.error(`Classify failed for ${job.job_id} (left unclassified for retry):`, err.message)
        failed++
      }
    }))
  }

  return NextResponse.json({ success: true, classified, queued, failed, total: jobs.length })
}