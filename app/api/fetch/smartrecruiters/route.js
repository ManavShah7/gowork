import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

const COMPANIES = [
  // Companies known to use SmartRecruiters
  'bosch', 'ikea', 'sephora', 'visa', 'linkedin',
  'twitter', 'medium', 'atlassian', 'equinox', 'soulcycle',
  'mcdonalds', 'yum', 'hilton', 'marriott', 'hyatt',
  'fedex', 'ups', 'dhl', 'amazon-logistics', 'flexport',
  'cardinal-health', 'mckesson', 'amerisource',
  'unitedhealth', 'cigna', 'aetna', 'humana', 'anthem',
  'jpmorgan', 'bankofamerica', 'wellsfargo', 'citigroup',
  'goldmansachs', 'morganstanley', 'ubs', 'creditsuisse',
  'deloitte', 'pwc', 'kpmg', 'ey', 'bain',
  'mckinsey', 'bcg', 'accenture', 'ibm', 'cognizant',
  'infosys', 'wipro', 'tcs', 'hcltech', 'capgemini',
  'nike', 'adidas', 'puma', 'underarmour', 'newbalance',
  'loreal', 'unilever', 'pg', 'colgate', 'jnj',
  'pfizer', 'merck', 'abbvie', 'bristol-myers', 'eli-lilly',
]

export async function GET() {
  const supabase = createServiceSupabase()
  const jobs = []

  await Promise.allSettled(
    COMPANIES.map(async (company) => {
      try {
        const res = await fetch(
          `https://api.smartrecruiters.com/v1/companies/${company}/postings?limit=100`,
          {
            headers: { 'Content-Type': 'application/json' },
            next: { revalidate: 0 }
          }
        )
        if (!res.ok) return
        const data = await res.json()
        if (!data.content?.length) return

        for (const job of data.content) {
          const applyUrl = `https://jobs.smartrecruiters.com/${company}/${job.id}`
          jobs.push({
            apply_url: applyUrl,
            company: job.company?.name || company,
            title: job.name,
            description: (job.jobAd?.sections?.jobDescription?.text || '').replace(/<[^>]*>/g, '').slice(0, 5000),
            location: [job.location?.city, job.location?.country].filter(Boolean).join(', '),
            job_type: job.typeOfEmployment?.id?.toLowerCase() || 'fulltime',
            source: 'smartrecruiters',
            ats_platform: 'smartrecruiters',
            posted_at: job.releasedDate || new Date().toISOString(),
            classified: false,
          })
        }
      } catch {}
    })
  )

  if (!jobs.length) return NextResponse.json({ count: 0, source: 'smartrecruiters' })

  const { error } = await supabase
    .from('job_listings')
    .upsert(jobs, { onConflict: 'apply_url', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ count: jobs.length, source: 'smartrecruiters' })
}