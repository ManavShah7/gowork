import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

const COMPANIES = [
  // Big Tech
  'netflix', 'twitter', 'square', 'paypal', 'ebay', 'adobe',
  // Cloud
  'cloudflare', 'fastly', 'zscaler',
  // Data
  'databricks', 'dbt-labs', 'fivetran', 'airbyte',
  // AI
  'scale-ai', 'labelbox', 'weights-biases',
  // Fintech
  'affirm', 'klarna', 'marqeta', 'galileo',
  // Healthcare
  'oscar', 'devoted', 'cityblock', 'bright-health',
  // Biotech
  'recursion', 'insitro', 'benchling', 'ginkgo',
  'zymergen', 'twist-bioscience', 'caribou-biosciences',
  // Real Estate
  'opendoor', 'orchard', 'flyhomes',
  // Security
  'crowdstrike', 'sentinel-one', 'lacework', 'orca',
  // Dev Tools
  'hashicorp', 'confluent', 'cockroachdb',
  // Consumer
  'reddit', 'pinterest', 'medium',
  // Mobility
  'bird', 'lime', 'spin',
  // Logistics
  'flexport', 'project44', 'convoy',
  // Social Commerce
  'faire', 'yotpo', 'gorgias',
  // Climate
  'climeworks', 'twelve', 'charm',
  // Space
  'relativity', 'planet', 'spire',
  // Marketplace
  'toptal', 'andela', 'deel', 'remote',
  // Gaming
  'niantic', 'scopely', 'kabam',
  // Media
  'buzzfeed', 'vox', 'axios',
  // Retail
  'warby-parker', 'allbirds', 'glossier', 'away',
  // Construction Tech
  'procore', 'plangrid', 'fieldwire',
  // Insurance
  'lemonade', 'root', 'hippo', 'branch',
  // Legal Tech
  'clio', 'mycase', 'litify',
  // Restaurant Tech
  'toast', 'olo', 'lightspeed',
  // HR Tech
  'rippling', 'gusto', 'lattice', 'culture-amp',
  // EdTech
  'duolingo', 'coursera', 'masterclass', 'udemy',
  // Pharma/Biotech
  'moderna', 'pfizer', 'genentech', 'illumina',
  // Finance
  'robinhood', 'sofi', 'betterment', 'wealthfront',
  // Consulting
  'mckinsey', 'bcg', 'bain', 'deloitte', 'accenture',
]

export async function GET() {
  const supabase = createServiceSupabase()
  const jobs = []

  await Promise.allSettled(
    COMPANIES.map(async (company) => {
      try {
        const res = await fetch(
          `https://api.lever.co/v0/postings/${company}?mode=json`,
          { next: { revalidate: 0 } }
        )
        if (!res.ok) return
        const data = await res.json()
        if (!Array.isArray(data) || !data.length) return

        for (const job of data) {
          const applyUrl = job.hostedUrl || job.applyUrl
          if (!applyUrl) continue

          const description = [
            job.description,
            ...(job.lists || []).map(l => `${l.text}: ${l.content}`),
            job.additional,
          ].filter(Boolean).join('\n').replace(/<[^>]*>/g, '').slice(0, 5000)

          jobs.push({
            apply_url: applyUrl,
            company: job.company || company,
            title: job.text,
            description,
            location: job.categories?.location || job.workplaceType || '',
            job_type: job.categories?.commitment?.toLowerCase() || 'fulltime',
            source: 'lever',
            ats_platform: 'lever',
            posted_at: job.createdAt
              ? new Date(job.createdAt).toISOString()
              : new Date().toISOString(),
            classified: false,
          })
        }
      } catch {}
    })
  )

  if (!jobs.length) return NextResponse.json({ count: 0, source: 'lever' })

  const { error } = await supabase
    .from('job_listings')
    .upsert(jobs, { onConflict: 'apply_url', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ count: jobs.length, source: 'lever' })
}