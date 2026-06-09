import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

const COMPANIES = [
  // Big Tech
  'google', 'meta', 'apple', 'microsoft', 'amazon', 'netflix', 'uber', 'lyft',
  // Design
  'figma', 'notion', 'linear', 'vercel', 'framer', 'webflow', 'canva', 'miro',
  'loom', 'coda', 'airtable', 'retool', 'amplitude', 'mixpanel', 'segment',
  // Fintech
  'stripe', 'plaid', 'brex', 'ramp', 'chime', 'robinhood', 'coinbase',
  'mercury', 'rippling', 'gusto', 'justworks', 'lattice', 'deel',
  // AI/ML
  'openai', 'anthropic', 'cohere', 'scale-ai', 'databricks', 'snowflake',
  'datarobot', 'c3-ai', 'palantir', 'weights-biases',
  // Social/Consumer
  'pinterest', 'reddit', 'twitch', 'discord', 'airbnb', 'doordash', 'instacart',
  // Enterprise SaaS
  'hubspot', 'zendesk', 'intercom', 'asana', 'monday', 'clickup',
  'contentful', 'algolia', 'twilio', 'cloudflare', 'datadog',
  'newrelic', 'splunk', 'elastic', 'hashicorp',
  // Healthcare
  'oscar-health', 'ro', 'hims', 'noom', 'calm', 'headspace',
  'flatiron', 'veeva', 'athenahealth',
  // EdTech
  'duolingo', 'coursera', 'chegg', 'quizlet', 'masterclass',
  // E-commerce
  'shopify', 'affirm', 'klarna', 'faire',
  // Security
  'crowdstrike', 'okta', 'snyk', 'lacework', 'wiz',
  // Infrastructure
  'digitalocean', 'netlify', 'supabase', 'planetscale',
  // Gaming
  'roblox', 'unity', 'riot-games',
  // HR Tech
  'bamboohr', 'greenhouse', 'lever', 'ashby',
  // Marketing Tech
  'klaviyo', 'braze', 'iterable', 'attentive',
  // Real Estate
  'opendoor', 'compass', 'redfin',
  // Dev Tools
  'github', 'gitlab', 'postman',
  // Analytics
  'looker', 'dbt-labs', 'fivetran', 'airbyte',
  // Communication
  'zoom', 'dropbox', 'box',
  // Travel
  'airbnb', 'expedia', 'hopper',
  // Mobility
  'waymo', 'cruise', 'rivian', 'lucid',
  // Climate
  'climeworks', 'twelve', 'heirloom',
  // Space
  'spacex', 'relativity', 'planet',
  // Biotech/Pharma
  'moderna', 'genentech', 'illumina', 'pacific-biosciences',
  'benchling', 'insitro', 'recursion',
  // Finance
  'robinhood', 'chime', 'sofi', 'betterment', 'wealthfront',
  // Insurance
  'lemonade', 'root', 'hippo',
  // Food
  'doordash', 'instacart', 'gopuff',
  // Legal Tech
  'clio', 'ironclad',
  // Restaurant Tech
  'toast', 'olo',
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
            description: job.content
              ? job.content.replace(/<[^>]*>/g, '').slice(0, 5000)
              : '',
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

  if (!jobs.length) return NextResponse.json({ count: 0, source: 'greenhouse' })

  const { error } = await supabase
    .from('job_listings')
    .upsert(jobs, { onConflict: 'apply_url', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ count: jobs.length, source: 'greenhouse' })
}