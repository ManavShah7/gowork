import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

const COMPANIES = [
  'moderna', 'genentech', 'illumina', 'pacific-biosciences',
  'benchling', 'insitro', 'recursion',
  'oscar-health', 'ro', 'hims', 'noom', 'calm', 'headspace',
  'flatiron', 'veeva', 'athenahealth',
  'duolingo', 'coursera', 'chegg', 'quizlet', 'masterclass',
  'roblox', 'unity', 'riot-games',
  'waymo', 'cruise', 'rivian', 'lucid',
  'crowdstrike', 'okta', 'snyk', 'lacework', 'wiz',
]

export async function GET() {
  const supabase = createServiceSupabase()
  const jobs = []

  await Promise.allSettled(
    COMPANIES.map(async (company) => {
      try {
        const res = await fetch(
          `https://boards-api.greenhouse.io/v1/boards/${company}/jobs?content=true`,
          { next: { revalidate: 0 } }
        )
        if (!res.ok) return
        const data = await res.json()
        if (!data.jobs?.length) return

        for (const job of data.jobs) {
          jobs.push({
            apply_url: job.absolute_url,
            company: job.company_name || company,
            title: job.title,
            description: job.content ? job.content.replace(/<[^>]*>/g, '').slice(0, 5000) : '',
            location: job.location?.name || '',
            job_type: 'fulltime',
            source: 'greenhouse',
            ats_platform: 'greenhouse',
            posted_at: job.updated_at || new Date().toISOString(),
            classified: false,
          })
        }
      } catch {}
    })
  )

  if (!jobs.length) return NextResponse.json({ count: 0, source: 'greenhouse-health' })

  const { error } = await supabase
    .from('job_listings')
    .upsert(jobs, { onConflict: 'apply_url', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ count: jobs.length, source: 'greenhouse-health' })
}