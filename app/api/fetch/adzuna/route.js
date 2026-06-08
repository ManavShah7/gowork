import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function GET() {
  const supabase = createServiceSupabase()

  const searches = [
    'product designer intern',
    'ux designer intern',
    'software engineer intern',
    'product manager intern',
    'data analyst intern',
  ]

  const jobs = []

  await Promise.allSettled(
    searches.map(async (query) => {
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

  if (!jobs.length) return NextResponse.json({ count: 0, source: 'adzuna' })

  const { error } = await supabase
    .from('job_listings')
    .upsert(jobs, { onConflict: 'apply_url', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ count: jobs.length, source: 'adzuna' })
}