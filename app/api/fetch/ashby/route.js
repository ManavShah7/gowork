import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

const COMPANIES = [
  // AI/ML
  'openai', 'anthropic', 'mistral', 'cohere', 'adept', 'inflection',
  'character', 'runway', 'stability', 'midjourney', 'jasper',
  'harvey', 'casetext', 'typeface', 'writer', 'copy-ai',
  // Fintech
  'mercury', 'brex', 'ramp', 'arc', 'pipe', 'capchase',
  'moderntreasury', 'parafin', 'settle', 'slope',
  // Dev Tools
  'linear', 'retool', 'airplane', 'superblocks', 'baseten',
  'modal', 'replicate', 'banana', 'beam',
  'temporal', 'inngest', 'trigger',
  // Data/Analytics
  'preset', 'lightdash', 'cube', 'metaplane', 'datafold',
  'hightouch', 'census', 'polytomic',
  // Security
  'huntress', 'abnormal', 'sublime', 'material',
  'vanta', 'drata', 'laika', 'secureframe',
  // Healthcare
  'healthie', 'spruce', 'ribbon', 'particle',
  'elation', 'hint', 'canvas',
  // HR Tech
  'rippling', 'deel', 'remote', 'oyster', 'papaya',
  'leapsome', 'culture-amp', 'betterworks',
  // Infrastructure
  'render', 'railway', 'fly', 'planetscale',
  'neon', 'turso', 'upstash',
  // Consumer
  'lunchclub', 'stir', 'supergreat', 'whatnot',
  // Climate
  'watershed', 'patch', 'cloverly', 'terrapass',
  // Real Estate
  'knock', 'orchard', 'flyhomes', 'homeward',
  // Legal
  'ironclad', 'spellbook', 'lexion', 'evisort',
  // EdTech
  'synthesis', 'outschool', 'primer', 'numerade',
  // Logistics
  'stord', 'shipbob', 'ware2go', 'flexe',
]

export async function GET() {
  const supabase = createServiceSupabase()
  const jobs = []

  await Promise.allSettled(
    COMPANIES.map(async (company) => {
      try {
        const res = await fetch(
          `https://jobs.ashbyhq.com/api/non-user-graphql`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              operationName: 'ApiJobBoardWithTeams',
              variables: { organizationHostedJobsPageName: company },
              query: `query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) {
                jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) {
                  jobPostings {
                    id title locationName employmentType isRemote
                    externalLink publishedDate
                    jobRequisition { compensationTiers { title } }
                  }
                }
              }`
            })
          }
        )
        if (!res.ok) return
        const data = await res.json()
        const postings = data?.data?.jobBoard?.jobPostings
        if (!postings?.length) return

        for (const job of postings) {
          const applyUrl = job.externalLink || `https://jobs.ashbyhq.com/${company}/${job.id}`
          jobs.push({
            apply_url: applyUrl,
            company,
            title: job.title,
            description: '',
            location: job.locationName || (job.isRemote ? 'Remote' : ''),
            job_type: job.employmentType?.toLowerCase() || 'fulltime',
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