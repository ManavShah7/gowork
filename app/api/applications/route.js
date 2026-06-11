import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await request.json()
    const { company, role, url, status = 'applied', notes = '' } = body

    if (!company && !url) return NextResponse.json({ error: 'Missing data' }, { status: 400 })

    const { data: existing } = await supabase
      .from('applications')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('job_url', url)
      .single()

    if (existing) {
      const statusOrder = ['in_progress', 'saved', 'applied', 'oa', 'interview', 'final_round', 'offer', 'rejected', 'withdrawn']
      const currentIdx = statusOrder.indexOf(existing.status)
      const newIdx = statusOrder.indexOf(status)
      if (newIdx > currentIdx) {
        await supabase
          .from('applications')
          .update({
            status,
            ...(notes ? { notes } : {}),
            ...(status === 'applied' ? { applied_at: new Date().toISOString() } : {}),
          })
          .eq('id', existing.id)
      }
      return NextResponse.json({ success: true, id: existing.id, action: 'updated' })
    }

    const { data, error } = await supabase
      .from('applications')
      .insert({
        user_id: user.id,
        company,
        role,
        job_url: url,
        location: body.location || '',
        status,
        source: 'extension',
        applied_at: status === 'applied' ? new Date().toISOString() : null,
        notes,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, id: data.id, action: 'created' })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('user_id', user.id)
      .order('applied_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ applications: data })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}