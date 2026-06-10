import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function GET() {
  const supabase = createServiceSupabase()
  const jobs = []

  const roles = [
    'software-engineer', 'product-designer', 'product-manager',
    'data-scientist', 'marketing', 'sales', 'operations',
    'frontend-engineer', 'backend-engineer', 'full-stack-engineer',
    'devops', 'machine-learning', 'ux-designer', 'ui-designer',
  ]

  await Promise.allSettled(
    roles.map(async (role) => {
      try {
        const res = await fetch(
          `https://wellfound.com/jobs?role=${role}&job_listing_type=internship`,
          {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0',
            },
            next: { revalidate: 0 }
          }
        )
        if (!res.ok) return
        const text = await res.text()

        // Extract job data from page
        const matches = text.match(/"jobListings":\s*(\[.*?\])/s)
        if (!matches) return

        const listings = JSON.parse(matches[1])
        for (const job of listings) {
          if (!job.applyUrl && !job.id) continue
          const applyUrl = job.applyUrl || `https://wellfound.com/jobs/${job.id}`
          jobs.push({
            apply_url: applyUrl,
            company: job.startup?.name || job.companyName || '',
            title: job.title || '',
            description: (job.description || '').slice(0, 5000),
            location: job.locationNames?.join(', ') || job.remote ? 'Remote' : '',
            job_type: job.jobType?.toLowerCase() || 'fulltime',
            source: 'wellfound',
            ats_platform: null,
            posted_at: job.createdAt || new Date().toISOString(),
            classified: false,
          })
        }
      } catch {}
    })
  )

  if (!jobs.length) return NextResponse.json({ count: 0, source: 'wellfound' })

  const { error } = await supabase
    .from('job_listings')
    .upsert(jobs, { onConflict: 'apply_url', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ count: jobs.length, source: 'wellfound' })
}