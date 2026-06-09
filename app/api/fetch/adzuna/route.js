import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

const QUERIES = [
  // Design
  'product designer', 'ux designer', 'ui designer', 'graphic designer',
  'visual designer', 'brand designer',
  // Engineering
  'software engineer', 'frontend engineer', 'backend engineer',
  'full stack engineer', 'mobile engineer', 'devops engineer',
  'machine learning engineer', 'ai engineer', 'electrical engineer',
  'mechanical engineer', 'civil engineer', 'chemical engineer',
  'biomedical engineer', 'hardware engineer',
  // Product
  'product manager', 'program manager', 'project manager',
  // Data
  'data scientist', 'data analyst', 'data engineer',
  'business intelligence analyst', 'quantitative analyst',
  'research scientist',
  // Finance
  'investment banking analyst', 'financial analyst', 'accounting',
  'corporate finance', 'private equity', 'equity research',
  'risk analyst', 'actuary',
  // Business
  'business analyst', 'strategy analyst', 'management consultant',
  'operations analyst', 'supply chain analyst', 'business development',
  // Marketing
  'marketing analyst', 'digital marketing', 'growth marketing',
  'content marketing', 'product marketing', 'seo analyst',
  'communications', 'public relations',
  // Sales
  'sales development representative', 'account executive',
  'sales operations', 'revenue operations',
  // Healthcare
  'clinical research', 'healthcare analyst', 'public health',
  'medical device', 'pharmaceutical', 'biotech research',
  'health policy', 'hospital administration',
  // Life Sciences
  'biology research', 'biochemistry', 'neuroscience research',
  'genomics', 'computational biology', 'drug discovery',
  'regulatory affairs',
  // Legal
  'paralegal', 'compliance analyst', 'legal operations',
  // HR
  'human resources', 'talent acquisition', 'recruiting',
  'people operations',
  // Cybersecurity
  'cybersecurity analyst', 'information security', 'security engineer',
  // Sustainability
  'sustainability analyst', 'environmental analyst', 'energy analyst',
  'renewable energy',
]

export async function GET() {
  const supabase = createServiceSupabase()
  const jobs = []

  for (let i = 0; i < QUERIES.length; i += 10) {
    const batch = QUERIES.slice(i, i + 10)

    await Promise.allSettled(
      batch.map(async (query) => {
        try {
          const res = await fetch(
            `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${process.env.ADZUNA_APP_ID}&app_key=${process.env.ADZUNA_APP_KEY}&results_per_page=20&what=${encodeURIComponent(query)}&content-type=application/json`,
            { next: { revalidate: 0 } }
          )
          if (!res.ok) return
          const data = await res.json()
          if (!data.results?.length) return

          for (const job of data.results) {
            if (!job.redirect_url) continue
            jobs.push({
              apply_url: job.redirect_url,
              company: job.company?.display_name || '',
              title: job.title,
              description: (job.description || '').slice(0, 5000),
              location: job.location?.display_name || '',
              job_type: job.contract_time || 'fulltime',
              source: 'adzuna',
              ats_platform: null,
              posted_at: job.created || new Date().toISOString(),
              classified: false,
            })
          }
        } catch {}
      })
    )

    if (i + 10 < QUERIES.length) {
      await new Promise(r => setTimeout(r, 300))
    }
  }

  if (!jobs.length) return NextResponse.json({ count: 0, source: 'adzuna' })

  const { error } = await supabase
    .from('job_listings')
    .upsert(jobs, { onConflict: 'apply_url', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ count: jobs.length, source: 'adzuna' })
}