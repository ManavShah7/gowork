import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

const CATEGORIES = [
  'Design & UX',
  'Engineering',
  'Product',
  'Data Science',
  'Finance',
  'Marketing & PR',
  'Sales',
  'Operations',
  'HR & Recruiting',
  'Legal',
  'Healthcare',
  'Business Development',
  'Consulting',
  'Media & Journalism',
  'Education',
  'Science & Research',
  'Social Media & Community',
  'Account Management',
  'Customer Service',
  'Project & Program Management',
]

export async function GET() {
  const supabase = createServiceSupabase()
  const jobs = []

  await Promise.allSettled(
    CATEGORIES.map(async (cat) => {
      try {
        const res = await fetch(
          `https://www.themuse.com/api/public/jobs?category=${encodeURIComponent(cat)}&page=0&api_key=${process.env.MUSE_API_KEY}`,
          { next: { revalidate: 0 } }
        )
        if (!res.ok) return
        const data = await res.json()
        if (!data.results?.length) return

        for (const job of data.results) {
          const applyUrl = job.refs?.landing_page
          if (!applyUrl) continue
          jobs.push({
            apply_url: applyUrl,
            company: job.company?.name || '',
            title: job.name,
            description: (job.contents || '').replace(/<[^>]*>/g, '').slice(0, 5000),
            location: job.locations?.[0]?.name || 'Remote',
            job_type: job.levels?.[0]?.name?.toLowerCase().includes('intern')
              ? 'internship'
              : 'fulltime',
            source: 'themuse',
            ats_platform: null,
            posted_at: job.publication_date || new Date().toISOString(),
            classified: false,
          })
        }
      } catch {}
    })
  )

  if (!jobs.length) return NextResponse.json({ count: 0, source: 'themuse' })

  const { error } = await supabase
    .from('job_listings')
    .upsert(jobs, { onConflict: 'apply_url', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ count: jobs.length, source: 'themuse' })
}