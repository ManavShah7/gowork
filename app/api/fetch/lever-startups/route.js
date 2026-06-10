import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

const COMPANIES = [
  // High-growth startups on Lever
  'openai', 'anthropic', 'mistral', 'cohere', 'adept',
  'runway', 'stability', 'jasper', 'copy-ai', 'writer',
  'harvey', 'casetext', 'ironclad', 'spellbook', 'lexion',
  'scale-ai', 'labelbox', 'snorkel', 'aquarium', 'humanloop',
  'weights-biases', 'neptune-ai', 'comet-ml', 'clearml',
  'modal', 'replicate', 'baseten', 'together-ai', 'fireworks',
  'anyscale', 'ray', 'determined-ai', 'grid-ai',
  'huggingface', 'deepmind', 'inflection', 'character-ai',
  'typeface', 'jasper', 'copy-ai', 'writesonic', 'rytr',
  'notion', 'coda', 'craft', 'anytype', 'logseq',
  'linear', 'height', 'shortcut', 'jira', 'asana',
  'figma', 'sketch', 'zeplin', 'abstract', 'avocode',
  'loom', 'vimeo', 'wistia', 'vidyard', 'descript',
  'miro', 'figjam', 'whimsical', 'excalidraw', 'mural',
  'retool', 'appsmith', 'tooljet', 'budibase', 'internal',
  'airplane', 'superblocks', 'pipedream', 'zapier', 'make',
  'segment', 'rudderstack', 'mparticle', 'tealium',
  'amplitude', 'mixpanel', 'heap', 'fullstory', 'hotjar',
  'datadog', 'grafana', 'prometheus', 'newrelic', 'honeycomb',
  'sentry', 'rollbar', 'bugsnag', 'raygun', 'logrocket',
  'vercel', 'netlify', 'render', 'railway', 'fly',
  'supabase', 'firebase', 'convex', 'pocketbase',
  'planetscale', 'neon', 'turso', 'upstash', 'redis',
  'cloudflare', 'fastly', 'akamai', 'bunny', 'cloudfront',
  'twilio', 'vonage', 'bandwidth', 'telnyx', 'sinch',
  'sendgrid', 'mailgun', 'postmark', 'resend', 'loops',
  'stripe', 'braintree', 'adyen', 'checkout', 'worldpay',
  'plaid', 'finicity', 'mx', 'yodlee', 'akoya',
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
            location: job.categories?.location || '',
            job_type: job.categories?.commitment?.toLowerCase() || 'fulltime',
            source: 'lever',
            ats_platform: 'lever',
            posted_at: job.createdAt ? new Date(job.createdAt).toISOString() : new Date().toISOString(),
            classified: false,
          })
        }
      } catch {}
    })
  )

  if (!jobs.length) return NextResponse.json({ count: 0, source: 'lever-startups' })

  const { error } = await supabase
    .from('job_listings')
    .upsert(jobs, { onConflict: 'apply_url', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ count: jobs.length, source: 'lever-startups' })
}