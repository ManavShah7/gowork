import { NextResponse } from 'next/server'

export async function GET(request) {
  const base = new URL(request.url).origin

  const sources = [
  'greenhouse-tech',
  'greenhouse-finance', 
  'greenhouse-health',
  'lever-tech',
  'lever-other',
  'ashby',
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
    error: r.status === 'rejected' ? r.reason?.message : null,
  }))

  const totalFetched = summary.reduce((acc, s) => acc + s.count, 0)

  return NextResponse.json({ summary, total_fetched: totalFetched })
}