import 'dotenv/config'
import Browserbase from '@browserbasehq/sdk'
import { chromium } from 'playwright-core'
import { createRequire } from 'module'
import { supabase } from './lib/supabase.js'
import { fillGreenhouse } from './lib/greenhouse.js'
import { fillLever } from './lib/lever.js'
import { fillGeneric } from './lib/generic.js'
import { sendApplicationEmail, sendFallbackEmail } from './lib/mailer.js'

const require = createRequire(import.meta.url)
const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY })

const SUBMIT_ENABLED = false

async function downloadResume(filePath) {
  try {
    const { data, error } = await supabase.storage.from('resumes').download(filePath)
    if (error) { console.log('  Resume download error:', error.message); return null }
    const arrayBuffer = await data.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (err) {
    console.log('  Resume download failed:', err.message)
    return null
  }
}

async function getAutofillData(userId) {
  const [autofillRes, profileRes, resumeRes] = await Promise.all([
    supabase.from('autofill_data').select('*').eq('user_id', userId).single(),
    supabase.from('intelligence_profiles').select('*').eq('user_id', userId).single(),
    supabase.from('parsed_resumes').select('file_path, file_name').eq('user_id', userId).single(),
  ])
  const { data: authUser } = await supabase.auth.admin.getUserById(userId)
  return {
    ...autofillRes.data,
    email: authUser?.user?.email || '',
    primary_role: profileRes.data?.primary_role,
    career_stage: profileRes.data?.career_stage,
    proven_skills: profileRes.data?.proven_skills,
    skill_groupings: profileRes.data?.skill_groupings,
    learning_skills: profileRes.data?.learning_skills,
    experience_highlights: profileRes.data?.experience_highlights,
    industries: profileRes.data?.industries,
    positioning: profileRes.data?.positioning,
    resume_file_path: resumeRes.data?.file_path,
    resume_file_name: resumeRes.data?.file_name,
  }
}

async function logCanary(queueItem, ats, page, responseTime, captchaDetected) {
  try {
    const html = await page.content()
    const hash = Buffer.from(html).toString('base64').slice(0, 32)
    await supabase.from('canary_logs').insert({
      user_id: queueItem.user_id,
      queue_id: queueItem.id,
      ats_platform: ats,
      page_html_hash: hash,
      response_time_ms: responseTime,
      captcha_detected: captchaDetected,
      is_anomalous: captchaDetected || responseTime > 20000,
    })
  } catch {}
}

function detectATS(url) {
  const u = url.toLowerCase()
  if (u.includes('greenhouse.io')) return 'greenhouse'
  if (u.includes('lever.co')) return 'lever'
  if (u.includes('ashbyhq.com')) return 'ashby'
  if (u.includes('workday')) return 'workday'
  if (u.includes('smartrecruiters')) return 'smartrecruiters'
  if (u.includes('workable')) return 'workable'
  return 'unknown'
}

async function processJob(queueItem) {
  console.log('\n' + '='.repeat(60))
  console.log(`JOB: ${queueItem.company} — ${queueItem.role}`)
  console.log(`URL: ${queueItem.job_url}`)
  console.log(`Queue ID: ${queueItem.id}`)
  console.log(`Submit: ${SUBMIT_ENABLED ? '🔴 LIVE' : '🟡 TESTING'}`)
  console.log('='.repeat(60))

  await supabase.from('apply_queue').update({ status: 'processing' }).eq('id', queueItem.id)

  let browser = null

  try {
    // Step 1: User data
    console.log('\n[1/7] Loading user data...')
    const autofill = await getAutofillData(queueItem.user_id)
    console.log(`  Email: ${autofill.email}`)
    console.log(`  Name: ${autofill.name}`)
    console.log(`  Phone: ${autofill.phone}`)
    console.log(`  LinkedIn: ${autofill.linkedin_url}`)
    console.log(`  Portfolio: ${autofill.portfolio_url}`)
    console.log(`  Location: ${autofill.city}, ${autofill.state}`)
    console.log(`  Resume: ${autofill.resume_file_path || 'MISSING'}`)
    console.log(`  Skills: ${(autofill.proven_skills || []).slice(0, 5).join(', ')}`)

    // Step 2: Resume
    console.log('\n[2/7] Downloading resume...')
    const resumeBuffer = autofill.resume_file_path
      ? await downloadResume(autofill.resume_file_path)
      : null
    console.log(`  Resume: ${resumeBuffer ? `${resumeBuffer.length} bytes ✓` : 'FAILED'}`)

    // Step 3: ATS
    console.log('\n[3/7] Detecting ATS...')
    const originalAts = detectATS(queueItem.job_url)
    console.log(`  Original ATS: ${originalAts}`)

    // Step 4: BrowserBase
    console.log('\n[4/7] Creating BrowserBase session...')
    const session = await bb.sessions.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      browserSettings: { solveCaptchas: true },
    })
    console.log(`  Session ID: ${session.id}`)
    console.log(`  Live view: https://www.browserbase.com/sessions/${session.id}`)

    browser = await chromium.connectOverCDP(session.connectUrl)
    const context = browser.contexts()[0]
    const page = context.pages()[0] || await context.newPage()
    console.log('  Browser connected ✓')

    // Step 5: Navigate
    console.log('\n[5/7] Navigating...')
    const directUrl = originalAts === 'greenhouse'
      ? queueItem.job_url.replace('boards.greenhouse.io', 'job-boards.greenhouse.io')
      : queueItem.job_url
    console.log(`  URL: ${directUrl}`)

    await page.goto(directUrl, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(3000)

    const currentUrl = page.url()
    const pageTitle = await page.title()
    console.log(`  Current URL: ${currentUrl}`)
    console.log(`  Page title: ${pageTitle}`)

    const actualAts = detectATS(currentUrl)
    if (actualAts !== originalAts) console.log(`  ⚠️ Redirected: ${originalAts} → ${actualAts}`)

    try {
      const ss = await page.screenshot()
      require('fs').writeFileSync('./debug-screenshot.png', ss)
    } catch {}

    // Server error check
    const pageText = await page.textContent('body').catch(() => '')
    if (pageText.includes('522') || pageText.includes('520') || pageText.includes('Connection timed out') || pageText.includes('Web server is returning an unknown error')) {
      console.log('  ERROR: Server error on job page')
      await supabase.from('apply_queue')
        .update({ status: 'fallback_ready', error: 'Job page server error' })
        .eq('id', queueItem.id)
      return { success: false, reason: 'server_error' }
    }

    // Step 6: Fill form
    console.log('\n[6/7] Filling form...')
    const { data: jobListing } = await supabase
      .from('job_listings')
      .select('description')
      .eq('job_id', queueItem.job_id)
      .single()

    const jobInfo = {
      title: queueItem.role,
      company: queueItem.company,
      description: jobListing?.description || '',
    }
    console.log(`  JD length: ${jobInfo.description.length} chars`)

    let fillResult
    const startTime = Date.now()

    if (actualAts === 'greenhouse') {
      console.log('  Using Greenhouse filler')
      fillResult = await fillGreenhouse(page, autofill, autofill, jobInfo, resumeBuffer)
    } else if (actualAts === 'lever') {
      console.log('  Using Lever filler')
      fillResult = await fillLever(page, autofill, autofill, jobInfo, resumeBuffer)
    } else {
      console.log(`  Using Generic filler (${actualAts})`)
      fillResult = await fillGeneric(page, autofill, autofill, jobInfo, resumeBuffer)
    }

    const responseTime = Date.now() - startTime
    console.log(`\n  ── Fill Summary ──────────────────────────`)
    console.log(`  Fields filled: ${fillResult.fields_filled}`)
    console.log(`  Fields failed: ${fillResult.fields_failed?.join(', ') || 'none'}`)
    console.log(`  Cover letter: ${fillResult.cover_letter_generated ? '✓' : 'skipped'}`)
    console.log(`  CAPTCHA present: ${fillResult.captcha_detected ? '⚠️ (BrowserBase solving)' : '✓ none'}`)
    console.log(`  Time: ${(responseTime / 1000).toFixed(1)}s`)
    console.log(`  ─────────────────────────────────────────`)

    try {
      const ss2 = await page.screenshot({ fullPage: true })
      require('fs').writeFileSync('./debug-screenshot-filled.png', ss2)
      console.log('  Post-fill screenshot saved')
    } catch {}

    if (fillResult.fields_filled < 3) {
      console.log(`\n  Too few fields (${fillResult.fields_filled}) — marking fallback_ready`)
      await supabase.from('apply_queue')
        .update({ status: 'fallback_ready', error: `Only ${fillResult.fields_filled} fields filled` })
        .eq('id', queueItem.id)
      await sendFallbackEmail(autofill.email, queueItem)
      return { success: false, reason: 'few_fields' }
    }

    // Step 7: Submit or testing mode
    if (!SUBMIT_ENABLED) {
      console.log('\n[7/7] TESTING MODE — not submitting')
      console.log('  Everything looks good — set SUBMIT_ENABLED = true when ready')
      try {
        const ss3 = await page.screenshot({ fullPage: true })
        require('fs').writeFileSync('./debug-screenshot-final.png', ss3)
        console.log('  Final screenshot: debug-screenshot-final.png')
      } catch {}
      await supabase.from('apply_queue')
        .update({ status: 'fallback_ready', error: 'Testing mode' })
        .eq('id', queueItem.id)
      return { success: false, reason: 'testing_mode' }
    }

    // LIVE SUBMIT
    console.log('\n[7/7] Submitting...')
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(1500)

    let submitButton =
      await page.$('button[type="submit"]') ||
      await page.$('input[type="submit"]') ||
      await page.$('[data-qa="btn-submit"]') ||
      await page.$('button:has-text("Submit Application")') ||
      await page.$('button:has-text("Submit my application")') ||
      await page.$('button:has-text("Submit")')

    if (!submitButton) {
      const allButtons = await page.$$('button')
      for (const btn of allButtons) {
        const text = await btn.textContent().catch(() => '')
        if (text.toLowerCase().includes('submit')) { submitButton = btn; break }
      }
    }

    if (!submitButton) {
      console.log('  ERROR: No submit button')
      await supabase.from('apply_queue')
        .update({ status: 'fallback_ready', error: 'Submit button not found' })
        .eq('id', queueItem.id)
      return { success: false, reason: 'no_submit' }
    }

    await submitButton.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    console.log('  Clicking submit...')
    await submitButton.click()

    // Wait for CAPTCHA solve + page response
    console.log('  Waiting for submission (CAPTCHA may be solving)...')
    await page.waitForTimeout(15000)
    console.log(`  Post-submit URL: ${page.url()}`)

    try {
      const ss3 = await page.screenshot()
      require('fs').writeFileSync('./debug-screenshot-submitted.png', ss3)
    } catch {}

    const postText = await page.textContent('body').catch(() => '')
    const success =
      postText.includes('Thank you') ||
      postText.includes('Application submitted') ||
      postText.includes('We received') ||
      postText.includes('successfully submitted') ||
      postText.includes('application has been received') ||
      postText.includes('Your application') ||
      page.url().includes('confirmation') ||
      page.url().includes('success') ||
      page.url().includes('thank')

    console.log(`  Success: ${success}`)
    await logCanary(queueItem, actualAts, page, responseTime, fillResult.captcha_detected)

    if (success) {
      console.log('\n  ✅ APPLICATION SUBMITTED')
      await supabase.from('apply_queue')
        .update({ status: 'applied', processed_at: new Date().toISOString() })
        .eq('id', queueItem.id)
      await supabase.from('applications').upsert({
        user_id: queueItem.user_id,
        company: queueItem.company,
        role: queueItem.role,
        job_url: queueItem.job_url,
        location: queueItem.location,
        status: 'applied',
        source: 'auto-pilot',
        match_score: queueItem.match_score,
        applied_at: new Date().toISOString(),
      }, { onConflict: 'user_id,job_url' })
      return { success: true, company: queueItem.company, role: queueItem.role }
    } else {
      console.log('\n  ⚠️ No confirmation — fallback_ready')
      await supabase.from('apply_queue')
        .update({ status: 'fallback_ready', error: 'No success confirmation' })
        .eq('id', queueItem.id)
      await sendFallbackEmail(autofill.email, queueItem)
      return { success: false, reason: 'no_confirmation' }
    }

  } catch (err) {
    console.error(`\n  ❌ ERROR: ${err.message}`)
    console.error(err.stack)
    await supabase.from('apply_queue')
      .update({ status: 'failed', error: err.message })
      .eq('id', queueItem.id)
    return { success: false, reason: err.message }
  } finally {
    if (browser) {
      console.log('\n  Closing browser...')
      await browser.close().catch(() => {})
    }
  }
}

export async function processQueue() {
  console.log('\n' + '='.repeat(60))
  console.log('PROCESS QUEUE — ' + new Date().toISOString())
  console.log(`Submit: ${SUBMIT_ENABLED ? '🔴 LIVE' : '🟡 TESTING'}`)
  console.log('='.repeat(60))

  const { data: jobs, error } = await supabase
    .from('apply_queue')
    .select('*')
    .eq('status', 'queued')
    .order('queued_at', { ascending: true })
    .limit(5)

  if (error) { console.log('DB ERROR:', error.message); return { processed: 0 } }

  console.log(`Jobs in queue: ${jobs?.length || 0}`)
  jobs?.forEach(j => console.log(`  - ${j.company}: ${j.role}`))
  if (!jobs?.length) { console.log('Queue empty'); return { processed: 0 } }

  const results = []
  const successByUser = {}

  for (const job of jobs) {
    const result = await processJob(job)
    results.push(result)
    if (result.success) {
      if (!successByUser[job.user_id]) successByUser[job.user_id] = []
      successByUser[job.user_id].push({ company: job.company, role: job.role, match_score: job.match_score })
    }
    const delay = Math.random() * 5000 + 3000
    console.log(`\nWaiting ${Math.round(delay / 1000)}s...`)
    await new Promise(r => setTimeout(r, delay))
  }

  for (const [userId, apps] of Object.entries(successByUser)) {
    const { data: authUser } = await supabase.auth.admin.getUserById(userId)
    const email = authUser?.user?.email
    if (email && apps.length) await sendApplicationEmail(email, apps)
    await supabase.from('auto_apply_settings').update({
      last_run_at: new Date().toISOString(),
      last_run_count: apps.length,
      last_run_summary: `Applied to ${apps.length} job${apps.length > 1 ? 's' : ''}: ${apps.map(a => a.company).join(', ')}`,
    }).eq('user_id', userId)
  }

  const succeeded = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success && r.reason !== 'testing_mode').length
  const testing = results.filter(r => r.reason === 'testing_mode').length

  console.log('\n' + '='.repeat(60))
  console.log(`DONE — Processed: ${results.length} | Succeeded: ${succeeded} | Failed: ${failed} | Testing: ${testing}`)
  console.log('='.repeat(60))

  return { processed: results.length, succeeded, failed }
}