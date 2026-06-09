import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

const COMPANIES = [
  // Fintech
  'stripe', 'plaid', 'brex', 'ramp', 'chime', 'robinhood',
  'coinbase', 'mercury', 'rippling', 'gusto', 'justworks',
  'lattice', 'deel', 'affirm', 'klarna', 'afterpay',
  'marqeta', 'galileo', 'synapse', 'unit', 'column',
  'treasury-prime', 'bond', 'lithic', 'highnote',
  // Insurance
  'lemonade', 'root', 'hippo', 'branch', 'metromile',
  'oscar-health', 'clover', 'devoted', 'bright-health',
  // Real estate
  'opendoor', 'compass', 'redfin', 'zillow', 'divvy',
  'knock', 'ribbon', 'homeward', 'orchard',
  // Investing
  'sofi', 'betterment', 'wealthfront', 'acorns', 'stash',
  'public', 'moomoo', 'webull',
  // B2B Finance
  'bill', 'tipalti', 'coupa', 'procurify', 'zip',
  'airbase', 'spendesk', 'pleo',
  // Crypto
  'coinbase', 'kraken', 'gemini', 'blockchain',
  'alchemy', 'moralis', 'quicknode',
  // Payments
  'checkout', 'adyen', 'worldpay', 'nuvei',
  'payoneer', 'wise', 'remitly', 'sendwave',
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

  if (!jobs.length) return NextResponse.json({ count: 0, source: 'greenhouse-finance' })

  const { error } = await supabase
    .from('job_listings')
    .upsert(jobs, { onConflict: 'apply_url', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ count: jobs.length, source: 'greenhouse-finance' })
}