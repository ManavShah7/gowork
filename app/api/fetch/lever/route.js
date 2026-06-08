import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

const COMPANIES = [
  'netflix', 'spotify', 'twitter', 'square', 'cloudflare', 'datadog',
  'snowflake', 'databricks', 'scale-ai', 'openai', 'anthropic', 'mistral',
  'nvidia', 'amd', 'qualcomm', 'arm', 'palantir', 'anduril', 'spacex',
  'rivian', 'lucid', 'waymo', 'cruise', 'aurora', 'zoox',
  'doordash', 'instacart', 'postmates', 'gopuff', 'getir',
  'headspace', 'calm', 'peloton', 'strava', 'whoop',
  'duolingo', 'coursera', 'chegg', 'quizlet', 'khan-academy',
  'figma', 'invision', 'abstract', 'zeplin', 'avocode',
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
            posted_at: job.createdAt ? new Date(job.createdAt).toISOString() : new Date().toISOString(),
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