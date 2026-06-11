import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cs) { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) },
      },
    }
  )
}

export async function GET() {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data } = await supabase
    .from('auto_apply_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json(data || {
    enabled: false,
    match_threshold: 80,
    daily_limit: 5,
    job_types: ['internship', 'fulltime'],
    blacklisted_companies: [],
  })
}

export async function POST(request) {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await request.json()

  const { data, error } = await supabase
    .from('auto_apply_settings')
    .upsert({
      user_id: user.id,
      enabled: body.enabled,
      match_threshold: body.match_threshold,
      daily_limit: body.daily_limit,
      job_types: body.job_types,
      blacklisted_companies: body.blacklisted_companies,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}