import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

const QUERIES = [
  // Design
  'product designer intern',
  'ux designer intern',
  'ui designer intern',
  'graphic designer intern',
  'visual designer intern',
  'brand designer intern',
  'motion designer intern',
  'design researcher intern',
  // Engineering
  'software engineer intern',
  'frontend engineer intern',
  'backend engineer intern',
  'full stack engineer intern',
  'mobile engineer intern',
  'ios engineer intern',
  'android engineer intern',
  'devops engineer intern',
  'machine learning engineer intern',
  'ai engineer intern',
  'embedded systems engineer intern',
  'hardware engineer intern',
  'electrical engineer intern',
  'mechanical engineer intern',
  'civil engineer intern',
  'chemical engineer intern',
  'biomedical engineer intern',
  // Product
  'product manager intern',
  'associate product manager intern',
  'technical program manager intern',
  'program manager intern',
  'project manager intern',
  // Data
  'data scientist intern',
  'data analyst intern',
  'data engineer intern',
  'business intelligence analyst intern',
  'quantitative analyst intern',
  'research scientist intern',
  'bioinformatics intern',
  // Finance
  'investment banking analyst intern',
  'financial analyst intern',
  'accounting intern',
  'audit intern',
  'corporate finance intern',
  'private equity intern',
  'venture capital intern',
  'equity research intern',
  'risk analyst intern',
  'actuary intern',
  'treasury analyst intern',
  // Business
  'business analyst intern',
  'strategy analyst intern',
  'management consultant intern',
  'operations analyst intern',
  'supply chain analyst intern',
  'logistics analyst intern',
  'business development intern',
  // Marketing
  'marketing intern',
  'digital marketing intern',
  'growth marketing intern',
  'content marketing intern',
  'social media marketing intern',
  'brand marketing intern',
  'product marketing intern',
  'seo analyst intern',
  'performance marketing intern',
  'communications intern',
  'public relations intern',
  // Sales
  'sales development intern',
  'account executive intern',
  'sales operations intern',
  'revenue operations intern',
  // Healthcare
  'clinical research intern',
  'healthcare analyst intern',
  'public health intern',
  'health data analyst intern',
  'medical device intern',
  'pharmaceutical intern',
  'biotech research intern',
  'clinical data analyst intern',
  'health policy intern',
  'hospital administration intern',
  // Life Sciences
  'biology research intern',
  'chemistry intern',
  'biochemistry intern',
  'neuroscience research intern',
  'genomics intern',
  'computational biology intern',
  'laboratory research intern',
  'drug discovery intern',
  'regulatory affairs intern',
  'quality assurance biotech intern',
  // Legal
  'legal intern',
  'paralegal intern',
  'compliance analyst intern',
  'policy analyst intern',
  // HR
  'human resources intern',
  'people operations intern',
  'talent acquisition intern',
  'recruiting intern',
  'hr analyst intern',
  // Consulting
  'management consulting intern',
  'technology consulting intern',
  'strategy consulting intern',
  // Research
  'research analyst intern',
  'policy research intern',
  'economic research intern',
  'market research analyst intern',
  // Real Estate
  'real estate analyst intern',
  'construction management intern',
  'urban planning intern',
  'architecture intern',
  // Media
  'journalism intern',
  'editorial intern',
  'content writer intern',
  'video production intern',
  // Cybersecurity
  'cybersecurity analyst intern',
  'information security intern',
  'security engineer intern',
  // Sustainability
  'sustainability analyst intern',
  'environmental analyst intern',
  'climate tech intern',
  'energy analyst intern',
  'renewable energy intern',
  // New Grad
  'new grad software engineer',
  'new grad data scientist',
  'new grad product manager',
  'new grad financial analyst',
  'new grad business analyst',
  'new grad marketing analyst',
  'associate software engineer',
  'junior product designer',
  'associate data analyst',
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
            `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query + ' USA')}&page=1&num_pages=1&date_posted=week`,
            {
              headers: {
                'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
              },
              next: { revalidate: 0 }
            }
          )
          if (!res.ok) return
          const data = await res.json()
          if (!data.data?.length) return

          for (const job of data.data) {
            if (!job.job_apply_link) continue
            jobs.push({
              apply_url: job.job_apply_link,
              company: job.employer_name,
              title: job.job_title,
              description: (job.job_description || '').slice(0, 5000),
              location: `${job.job_city || ''}, ${job.job_state || ''}`.trim().replace(/^,\s*/, ''),
              job_type: job.job_employment_type?.toLowerCase() || 'fulltime',
              source: 'jsearch',
              ats_platform: null,
              posted_at: job.job_posted_at_datetime_utc || new Date().toISOString(),
              classified: false,
            })
          }
        } catch {}
      })
    )

    if (i + 10 < QUERIES.length) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  if (!jobs.length) return NextResponse.json({ count: 0, source: 'jsearch' })

  const { error } = await supabase
    .from('job_listings')
    .upsert(jobs, { onConflict: 'apply_url', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ count: jobs.length, source: 'jsearch' })
}