import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { runMatchForUser } from '@/lib/matching'

// Matches classified direct-apply jobs to all (or one) autopilot user via the
// shared pipeline in lib/matching.js: hard SQL filters + pgvector retrieval →
// DNA → GPT rerank → apply_queue. Cron every 30 min.
export async function GET(request) {
  const supabase = createServiceSupabase()
  const url = new URL(request.url)
  const userId = url.searchParams.get('user_id') || null

  let settingsQuery = supabase
    .from('auto_apply_settings')
    .select('*')
    .eq('enabled', true)

  if (userId) settingsQuery = settingsQuery.eq('user_id', userId)

  const { data: allSettings } = await settingsQuery
  if (!allSettings?.length) return NextResponse.json({ error: 'No autopilot users' })

  let totalQueued = 0
  for (const userSettings of allSettings) {
    totalQueued += await runMatchForUser(supabase, userSettings)
  }

  return NextResponse.json({ success: true, total_queued: totalQueued })
}
