import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

const COMPANIES = [
  // Biotech
  'moderna', 'genentech', 'illumina', 'pacific-biosciences',
  'benchling', 'insitro', 'recursion', 'exscientia',
  'insilico', 'atomwise', 'schrodinger', 'relay',
  'pattern', 'phenome-health',
  // Digital health
  'oscar-health', 'ro', 'hims', 'noom', 'calm', 'headspace',
  'flatiron', 'veeva', 'athenahealth', 'allscripts',
  'epic', 'cerner', 'meditech',
  // Healthcare services
  'cityblock', 'iora', 'one-medical', 'carbon-health',
  'forward', 'crossover', 'parsley',
  // Mental health
  'cerebral', 'brightside', 'lyra', 'spring-health',
  'talkspace', 'betterhelp', 'modern-health',
  // EdTech
  'duolingo', 'coursera', 'chegg', 'quizlet',
  'masterclass', 'udemy', 'pluralsight', 'linkedin-learning',
  'outschool', 'synthesis', 'khan-academy',
  // Mobility
  'waymo', 'cruise', 'aurora', 'zoox',
  'rivian', 'lucid', 'fisker', 'canoo',
  // Security
  'crowdstrike', 'okta', 'auth0', 'snyk',
  'lacework', 'wiz', 'orca', 'aqua',
  'sentinel-one', 'cylance', 'cybereason',
  // Climate
  'climeworks', 'twelve', 'heirloom', 'charm',
  'watershed', 'patch', 'cloverly',
  // Space
  'spacex', 'relativity', 'planet', 'spire',
  'rocket-lab', 'astra', 'sierra-space',
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