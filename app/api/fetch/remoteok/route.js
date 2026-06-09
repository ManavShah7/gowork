import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function GET() {
  const supabase = createServiceSupabase()

  try {
    const res = await fetch('https://remoteok.com/api', {
      headers: { 'User-Agent': 'GoWork Job Aggregator' },
      next: { revalidate: 0 }
    })
    if (!res.ok) return NextResponse.json({ count: 0, source: 'remoteok' })

    const data = await res.json()
    const listings = data.filter(j => j.id && j.url)

    const jobs = listings.slice(0, 100).map(job => ({
      apply_url: job.url,
      company: job.company || '',
      title: job.position || '',
      description: (job.description || '').replace(/<[^>]*>/g, '').slice(0, 5000),
      location: 'Remote',
      job_type: 'fulltime',
      source: 'remoteok',
      ats_platform: null,
      posted_at: job.date || new Date().toISOString(),
      classified: false,
    }))

    if (!jobs.length) return NextResponse.json({ count: 0, source: 'remoteok' })

    const { error } = await supabase
      .from('job_listings')
      .upsert(jobs, { onConflict: 'apply_url', ignoreDuplicates: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ count: jobs.length, source: 'remoteok' })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}