import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

const COMPANIES = [
  // AI/ML
  'openai', 'anthropic', 'mistral', 'cohere', 'adept', 'inflection',
  'runway', 'jasper', 'harvey', 'typeface', 'writer',
  // Dev Tools
  'linear', 'retool', 'airplane', 'superblocks', 'baseten',
  'modal', 'replicate', 'temporal', 'inngest',
  // Fintech
  'mercury', 'arc', 'pipe', 'capchase', 'moderntreasury',
  'parafin', 'settle', 'slope',
  // Data
  'preset', 'lightdash', 'cube', 'metaplane', 'datafold',
  'hightouch', 'census', 'polytomic',
  // Security
  'huntress', 'abnormal', 'vanta', 'drata', 'laika', 'secureframe',
  // Healthcare
  'healthie', 'spruce', 'ribbon', 'particle', 'elation',
  // HR Tech
  'leapsome', 'betterworks',
  // Infrastructure
  'render', 'railway', 'neon', 'turso', 'upstash',
  // Climate
  'watershed', 'patch', 'cloverly',
  // Legal
  'ironclad', 'spellbook', 'lexion', 'evisort',
  // EdTech
  'synthesis', 'outschool', 'numerade',
  // Logistics
  'stord', 'shipbob', 'flexe',
]

const QUERY = `
query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) {
  jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) {
    jobPostings {
      id
      title
      locationName
      employmentType
      isRemote
      publishedDate
      descriptionPlain
    }
  }
}
`

export async function GET() {
  const supabase = createServiceSupabase()
  const jobs = []

  await Promise.allSettled(
    COMPANIES.map(async (company) => {
      try {
        const res = await fetch(
          'https://jobs.ashbyhq.com/api/non-user-graphql',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              operationName: 'ApiJobBoardWithTeams',
              variables: { organizationHostedJobsPageName: company },
              query: QUERY,
            }),
          }
        )
        if (!res.ok) return
        const data = await res.json()
        const postings = data?.data?.jobBoard?.jobPostings
        if (!postings?.length) return

        for (const job of postings) {
          // Correct Ashby URL format
          const applyUrl = `https://jobs.ashbyhq.com/${company}/${job.id}`

          jobs.push({
            apply_url: applyUrl,
            company,
            title: job.title,
            description: (job.descriptionPlain || '').slice(0, 5000),
            location: job.isRemote ? 'Remote' : (job.locationName || ''),
            job_type: (job.employmentType || 'fulltime').toLowerCase(),
            source: 'ashby',
            ats_platform: 'ashby',
            posted_at: job.publishedDate || new Date().toISOString(),
            classified: false,
          })
        }
      } catch {}
    })
  )

  if (!jobs.length) return NextResponse.json({ count: 0, source: 'ashby' })

  const { error } = await supabase
    .from('job_listings')
    .upsert(jobs, { onConflict: 'apply_url', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ count: jobs.length, source: 'ashby' })
}