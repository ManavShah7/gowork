import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

const COMPANIES = [
  'figma', 'notion', 'linear', 'vercel', 'framer', 'webflow', 'canva', 'miro',
  'loom', 'coda', 'airtable', 'retool', 'amplitude', 'mixpanel', 'segment',
  'openai', 'anthropic', 'cohere', 'scale-ai', 'databricks', 'snowflake',
  'stripe', 'plaid', 'brex', 'ramp', 'chime', 'robinhood', 'coinbase',
  'hubspot', 'zendesk', 'intercom', 'asana', 'monday', 'clickup',
  'cloudflare', 'datadog', 'newrelic', 'elastic', 'hashicorp',
  'github', 'gitlab', 'postman', 'digitalocean', 'netlify',
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

  if (!jobs.length) return NextResponse.json({ count: 0, source: 'greenhouse-tech' })

  const { error } = await supabase
    .from('job_listings')
    .upsert(jobs, { onConflict: 'apply_url', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ count: jobs.length, source: 'greenhouse-tech' })
}