import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

const QUERIES = [
  'investment banking analyst intern',
  'financial analyst intern',
  'accounting intern',
  'corporate finance intern',
  'private equity intern',
  'equity research intern',
  'risk analyst intern',
  'business analyst intern',
  'management consultant intern',
  'operations analyst intern',
  'supply chain analyst intern',
  'business development intern',
  'marketing intern',
  'digital marketing intern',
  'product marketing intern',
  'growth marketing intern',
  'sales development intern',
  'human resources intern',
  'talent acquisition intern',
  'strategy analyst intern',
]

export async function GET() {
  const supabase = createServiceSupabase()
  const jobs = []

  await Promise.allSettled(
    QUERIES.map(async (query) => {
      try {
        const res = await fetch(
          `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query + ' USA')}&page=1&num_pages=1&date_posted=week`,
          {
            headers: {
              'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
              'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
            },
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

  if (!jobs.length) return NextResponse.json({ count: 0, source: 'jsearch-business' })

  const { error } = await supabase
    .from('job_listings')
    .upsert(jobs, { onConflict: 'apply_url', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ count: jobs.length, source: 'jsearch-business' })
}