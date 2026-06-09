import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

const COMPANIES = [
  // Design tools
  'figma', 'notion', 'linear', 'vercel', 'framer', 'webflow',
  'canva', 'miro', 'loom', 'coda', 'airtable', 'retool',
  'amplitude', 'mixpanel', 'segment', 'heap', 'fullstory',
  'hotjar', 'mouseflow', 'logrocket',
  // AI
  'openai', 'anthropic', 'cohere', 'scale-ai', 'databricks',
  'snowflake', 'datarobot', 'c3-ai', 'palantir', 'weights-biases',
  'huggingface', 'replicate', 'together', 'modal',
  // Infrastructure
  'cloudflare', 'datadog', 'newrelic', 'splunk', 'elastic',
  'hashicorp', 'terraform', 'pagerduty', 'statuspage',
  'digitalocean', 'netlify', 'supabase', 'planetscale',
  'postman', 'insomnia', 'readme',
  // Dev tools
  'github', 'gitlab', 'jetbrains', 'sourcegraph', 'snyk',
  'sonarqube', 'checkmarx', 'veracode',
  // Communication
  'zoom', 'dropbox', 'box', 'docusign', 'hellosign',
  // Analytics
  'looker', 'dbt-labs', 'fivetran', 'airbyte', 'stitch',
  'matillion', 'talend', 'informatica',
  // Gaming
  'roblox', 'unity', 'riot-games', 'epic-games',
  'ea', 'activision', 'take-two', '2k',
  // Social
  'pinterest', 'reddit', 'twitch', 'discord',
  // Big tech adjacent
  'uber', 'lyft', 'airbnb', 'doordash', 'instacart',
  'gopuff', 'grubhub', 'postmates',
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