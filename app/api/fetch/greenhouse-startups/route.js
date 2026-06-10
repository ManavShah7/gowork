import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

const COMPANIES = [
  // Y Combinator companies
  'airbnb', 'stripe', 'coinbase', 'instacart', 'doordash',
  'dropbox', 'twitch', 'reddit', 'openai', 'scale-ai',
  'brex', 'gusto', 'segment', 'amplitude', 'mixpanel',
  'retool', 'webflow', 'notion', 'linear', 'loom',
  'mercury', 'rippling', 'deel', 'remote', 'pilot',
  'mainstreet', 'ramp', 'plaid', 'chime', 'robinhood',
  'clearbit', 'sendbird', 'knock', 'courier', 'stytch',
  'workos', 'clerk', 'supabase', 'planetscale', 'neon',
  'upstash', 'trigger', 'inngest', 'resend', 'loops',
  'posthog', 'june', 'koala', 'commonroom', 'orbit',
  'dub', 'cal', 'papermark', 'documenso', 'infisical',
  'crowd', 'twenty', 'huly', 'plane', 'appflowy',
  'formbricks', 'openreplay', 'highlight', 'zipper',
  'windmill', 'activepieces', 'n8n', 'pipedream',
  'vapi', 'bland', 'retell', 'hamming', 'hume',
  'elevenlabs', 'assemblyai', 'deepgram', 'gladia',
  'modal', 'replicate', 'baseten', 'beam', 'banana',
  'together', 'fireworks', 'anyscale', 'determined-ai',
  'weights-biases', 'neptune', 'comet', 'clearml',
  'labelbox', 'scale-ai', 'snorkel', 'aquarium',
  'humanloop', 'brainlox', 'lytix', 'helicone',
  'portkey', 'langchain', 'langfuse', 'phoenix',
  'traceloop', 'agentops', 'honeyhive', 'patronus',
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

  if (!jobs.length) return NextResponse.json({ count: 0, source: 'greenhouse-startups' })

  const { error } = await supabase
    .from('job_listings')
    .upsert(jobs, { onConflict: 'apply_url', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ count: jobs.length, source: 'greenhouse-startups' })
}