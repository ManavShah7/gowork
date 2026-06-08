import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function GET() {
  const supabase = createServiceSupabase()

  const queries = [
    'product design intern',
    'ux design intern',
    'software engineer intern',
    'product manager intern',
    'data science intern',
    'frontend engineer intern',
    'ui designer intern',
  ]

  const jobs = []

  await Promise.allSettled(
    queries.map(async (query) => {
      try {
        const res = await fetch(
          `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query + ' USA')}&page=1&num_pages=1&date_posted=today`,
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

  if (!jobs.length) return NextResponse.json({ count: 0, source: 'jsearch' })

  const { error } = await supabase
    .from('job_listings')
    .upsert(jobs, { onConflict: 'apply_url', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ count: jobs.length, source: 'jsearch' })
}