import { NextResponse } from 'next/server'

export async function GET(request) {
  const base = new URL(request.url).origin

  const sources = [
    // Greenhouse (direct apply)
    'greenhouse-tech',
    'greenhouse-finance',
    'greenhouse-health',
    'greenhouse-startups',
    'greenhouse-enterprise',
    // Lever (direct apply)
    'lever-tech',
    'lever-other',
    'lever-startups',
    // Ashby (direct apply)
    'ashby',
    // Other ATS
    'smartrecruiters',
    'workable',
    'wellfound',
    // Broad job boards
    'jsearch-tech',
    'jsearch-business',
    'jsearch-science',
    'adzuna',
    'remoteok',
    'themuse',
  ]

  const fetchResults = await Promise.allSettled(
    sources.map(s => fetch(`${base}/api/fetch/${s}`).then(r => r.json()))
  )

  const summary = fetchResults.map((r, i) => ({
    source: sources[i],
    status: r.status,
    count: r.status === 'fulfilled' ? r.value?.count || 0 : 0,
    error: r.status === 'rejected' ? r.reason?.message : r.value?.error || null,
  }))

  const totalFetched = summary.reduce((acc, s) => acc + s.count, 0)

  return NextResponse.json({ summary, total_fetched: totalFetched })
}