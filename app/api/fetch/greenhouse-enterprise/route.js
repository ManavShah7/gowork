import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

const COMPANIES = [
  // Fortune 500 + big tech
  'google', 'meta', 'apple', 'microsoft', 'amazon',
  'netflix', 'uber', 'lyft', 'twitter', 'snapchat',
  'pinterest', 'spotify', 'adobe', 'salesforce', 'oracle',
  'sap', 'servicenow', 'workday', 'zendesk', 'hubspot',
  'twilio', 'sendgrid', 'cloudflare', 'fastly', 'akamai',
  'datadog', 'newrelic', 'splunk', 'elastic', 'mongodb',
  'snowflake', 'databricks', 'palantir', 'c3-ai', 'veeva',
  'medallia', 'qualtrics', 'sprinklr', 'hootsuite', 'buffer',
  'asana', 'monday', 'clickup', 'notion', 'airtable',
  'smartsheet', 'basecamp', 'atlassian', 'jira', 'trello',
  'zoom', 'ringcentral', '8x8', 'dialpad', 'aircall',
  'intercom', 'drift', 'zendesk', 'freshdesk', 'helpscout',
  'shopify', 'bigcommerce', 'magento', 'woocommerce',
  'square', 'toast', 'lightspeed', 'clover', 'olo',
  'doordash', 'instacart', 'gopuff', 'grubhub', 'uber-eats',
  'airbnb', 'vrbo', 'booking', 'expedia', 'tripadvisor',
  'hopper', 'kayak', 'skyscanner', 'momondo',
  'wayfair', 'chewy', 'petco', 'petsmart', 'zooplus',
  'warby-parker', 'allbirds', 'casper', 'away', 'rimowa',
  'peloton', 'mirror', 'fitbit', 'whoop', 'oura',
  'calm', 'headspace', 'noom', 'myfitnesspal', 'strava',
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

  if (!jobs.length) return NextResponse.json({ count: 0, source: 'greenhouse-enterprise' })

  const { error } = await supabase
    .from('job_listings')
    .upsert(jobs, { onConflict: 'apply_url', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ count: jobs.length, source: 'greenhouse-enterprise' })
}