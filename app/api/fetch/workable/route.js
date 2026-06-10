import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

const COMPANIES = [
  // Companies using Workable ATS
  'spotify', 'transferwise', 'revolut', 'monzo', 'starling',
  'deliveroo', 'depop', 'farfetch', 'asos', 'net-a-porter',
  'skyscanner', 'trainline', 'gousto', 'oddbox', 'olio',
  'babylon', 'elvie', 'hinge-health', 'kry', 'numan',
  'typeform', 'landbot', 'tally', 'jotform', 'paperform',
  'pitch', 'prezly', 'storyblok', 'contentful', 'prismic',
  'algolia', 'meilisearch', 'typesense', 'elasticsearch',
  'lokalise', 'phrase', 'crowdin', 'transifex', 'smartcat',
  'maze', 'useberry', 'lookback', 'userzoom', 'usertesting',
  'uxtweak', 'hotjar', 'fullstory', 'mouseflow', 'clarity',
  'productboard', 'pendo', 'appcues', 'userguiding', 'chameleon',
  'mixpanel', 'amplitude', 'heap', 'june', 'posthog',
  'chargebee', 'recurly', 'paddle', 'stripe', 'zuora',
  'personio', 'bamboohr', 'hibob', 'factorial', 'kenjo',
  'remote', 'deel', 'rippling', 'justworks', 'gusto',
  'lattice', 'leapsome', 'betterworks', '15five', 'reflektive',
  'greenhouse', 'lever', 'ashby', 'workable', 'recruitee',
  'breezyhr', 'teamtailor', 'dover', 'gem', 'beamery',
]

export async function GET() {
  const supabase = createServiceSupabase()
  const jobs = []

  await Promise.allSettled(
    COMPANIES.map(async (company) => {
      try {
        const res = await fetch(
          `https://apply.workable.com/api/v1/widget/accounts/${company}/jobs`,
          { next: { revalidate: 0 } }
        )
        if (!res.ok) return
        const data = await res.json()
        if (!data.results?.length) return

        for (const job of data.results) {
          const applyUrl = `https://apply.workable.com/${company}/j/${job.shortcode}`
          jobs.push({
            apply_url: applyUrl,
            company: data.name || company,
            title: job.title,
            description: (job.description || '').replace(/<[^>]*>/g, '').slice(0, 5000),
            location: [job.city, job.state, job.country].filter(Boolean).join(', '),
            job_type: job.type?.toLowerCase() || 'fulltime',
            source: 'workable',
            ats_platform: 'workable',
            posted_at: job.published_on || new Date().toISOString(),
            classified: false,
          })
        }
      } catch {}
    })
  )

  if (!jobs.length) return NextResponse.json({ count: 0, source: 'workable' })

  const { error } = await supabase
    .from('job_listings')
    .upsert(jobs, { onConflict: 'apply_url', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ count: jobs.length, source: 'workable' })
}