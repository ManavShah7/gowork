import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request) {
  const { pathname } = request.nextUrl
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cs) {
          cs.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cs.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        }
      }
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Not logged in — redirect to auth
  if (!user && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/', request.url))
  }
  if (!user && pathname.startsWith('/onboarding')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Logged in — check onboarding completion
  if (user && pathname === '/') {
    const { data: profile } = await supabase
      .from('intelligence_profiles')
      .select('user_id, target_role_tags')
      .eq('user_id', user.id)
      .single()

    const { data: autofill } = await supabase
      .from('autofill_data')
      .select('user_id, phone')
      .eq('user_id', user.id)
      .single()

    const { data: settings } = await supabase
      .from('auto_apply_settings')
      .select('user_id')
      .eq('user_id', user.id)
      .single()

    // Step 1 — no profile at all → upload resume
    if (!profile) {
      return NextResponse.redirect(new URL('/onboarding/resume', request.url))
    }

    // Step 2 — no target roles selected → role targeting
    if (!profile.target_role_tags?.length) {
      return NextResponse.redirect(new URL('/onboarding/roles', request.url))
    }

    // Step 3 — no contact details → details page
    if (!autofill?.phone) {
      return NextResponse.redirect(new URL('/onboarding/details', request.url))
    }

    // Step 4 — no autopilot settings → autopilot page
    if (!settings) {
      return NextResponse.redirect(new URL('/onboarding/autopilot', request.url))
    }

    // All done → dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/onboarding/:path*']
}