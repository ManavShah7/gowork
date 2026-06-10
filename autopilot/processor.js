import Browserbase from '@browserbasehq/sdk'
import { chromium } from 'playwright-core'
import { supabase } from './lib/supabase.js'
import { fillGreenhouse } from './lib/greenhouse.js'
import { fillLever } from './lib/lever.js'
import { sendApplicationEmail, sendFallbackEmail } from './lib/mailer.js'

const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY })

async function downloadResume(filePath) {
  try {
    const { data, error } = await supabase.storage
      .from('resumes')
      .download(filePath)
    if (error) return null
    const arrayBuffer = await data.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch {
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
    experience_highlights: profileRes.data?.experience_highlights,
    industries: profileRes.data?.industries,
    positioning: profileRes.data?.positioning,
    resume_file_path: resumeRes.data?.file_path,
    resume_file_name: resumeRes.data?.file_name,
  }
}

async function processJob(queueItem) {
  console.log(`Processing: ${queueItem.company} - ${queueItem.role}`)

  // Mark as processing
  await supabase
    .from('apply_queue')
    .update({ status: 'processing' })
    .eq('id', queueItem.id)

  let browser = null
  let session = null

  try {
    // Get user data
    const autofill = await getAutofillData(queueItem.user_id)
    const resumeBuffer = autofill.resume_file_path
      ? await downloadResume(autofill.resume_file_path)
      : null

    // Detect ATS platform
    const url = queueItem.job_url.toLowerCase()
    const ats = url.includes('greenhouse.io') ? 'greenhouse'
      : url.includes('lever.co') ? 'lever'
      : url.includes('ashbyhq.com') ? 'ashby'
      : 'unknown'

    if (ats === 'unknown') {
      await supabase.from('apply_queue')
        .update({ status: 'fallback_ready', error: 'Unknown ATS platform' })
        .eq('id', queueItem.id)
      return { success: false, reason: 'unknown_ats' }
    }

    // Create BrowserBase session
    session = await bb.sessions.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID,
    })

    browser = await chromium.connectOverCDP(session.connectUrl)
    const context = browser.contexts()[0]
    const page = context.pages()[0] || await context.newPage()

    // Navigate to job
    await page.goto(queueItem.job_url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)

    const jobInfo = {
      title: queueItem.role,
      company: queueItem.company,
      description: '', // We could fetch this from job_listings
    }

    // Fetch job description from DB
    const { data: jobListing } = await supabase
      .from('job_listings')
      .select('description')
      .eq('job_id', queueItem.job_id)
      .single()

    if (jobListing?.description) jobInfo.description = jobListing.description

    // Fill the form
    let fillResult
    const startTime = Date.now()

    if (ats === 'greenhouse') {
      fillResult = await fillGreenhouse(page, autofill, autofill, jobInfo, resumeBuffer)
    } else if (ats === 'lever') {
      fillResult = await fillLever(page, autofill, autofill, jobInfo, resumeBuffer)
    }

    const responseTime = Date.now() - startTime

    // Check for CAPTCHA
    if (fillResult.captcha_detected) {
      await supabase.from('apply_queue')
        .update({ status: 'fallback_ready', error: 'CAPTCHA detected' })
        .eq('id', queueItem.id)

      await logCanary(queueItem, ats, page, responseTime, true)
      await sendFallbackEmail(autofill.email, queueItem)
      return { success: false, reason: 'captcha' }
    }

    // Check fields filled
    if (fillResult.fields_filled < 3) {
      await supabase.from('apply_queue')
        .update({ status: 'fallback_ready', error: 'Too few fields filled' })
        .eq('id', queueItem.id)

      await logCanary(queueItem, ats, page, responseTime, false)
      await sendFallbackEmail(autofill.email, queueItem)
      return { success: false, reason: 'few_fields' }
    }

    // Human-like pause before submit
    await page.waitForTimeout(Math.random() * 2000 + 1000)

    // Submit
    const submitButton = await page.$('button[type="submit"], input[type="submit"], button:has-text("Submit")')
    if (!submitButton) {
      await supabase.from('apply_queue')
        .update({ status: 'fallback_ready', error: 'Submit button not found' })
        .eq('id', queueItem.id)
      return { success: false, reason: 'no_submit' }
    }

    await submitButton.click()
    await page.waitForTimeout(3000)

    // Verify success
    const pageText = await page.textContent('body')
    const success = pageText.includes('Thank you') ||
      pageText.includes('Application submitted') ||
      pageText.includes('We received') ||
      pageText.includes('successfully submitted') ||
      pageText.includes('application has been received')

    await logCanary(queueItem, ats, page, responseTime, false)

    if (success) {
      // Mark applied
      await supabase.from('apply_queue')
        .update({ status: 'applied', processed_at: new Date().toISOString() })
        .eq('id', queueItem.id)

      // Insert into applications
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
      await supabase.from('apply_queue')
        .update({ status: 'fallback_ready', error: 'No success confirmation found' })
        .eq('id', queueItem.id)

      await sendFallbackEmail(autofill.email, queueItem)
      return { success: false, reason: 'no_confirmation' }
    }

  } catch (err) {
    console.error(`Error processing ${queueItem.id}:`, err.message)
    await supabase.from('apply_queue')
      .update({ status: 'failed', error: err.message })
      .eq('id', queueItem.id)
    return { success: false, reason: err.message }
  } finally {
    if (browser) await browser.close().catch(() => {})
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

export async function processQueue() {
  // Get queued jobs
  const { data: jobs } = await supabase
    .from('apply_queue')
    .select('*')
    .eq('status', 'queued')
    .order('queued_at', { ascending: true })
    .limit(5)

  if (!jobs?.length) {
    console.log('Queue empty')
    return { processed: 0 }
  }

  console.log(`Processing ${jobs.length} jobs`)

  const results = []
  const successByUser = {}

  // Process one at a time to avoid detection
  for (const job of jobs) {
    const result = await processJob(job)
    results.push(result)

    if (result.success) {
      if (!successByUser[job.user_id]) successByUser[job.user_id] = []
      successByUser[job.user_id].push({
        company: job.company,
        role: job.role,
        match_score: job.match_score,
      })
    }

    // Human-like delay between applications
    await new Promise(r => setTimeout(r, Math.random() * 5000 + 3000))
  }

  // Send batch email per user
  for (const [userId, apps] of Object.entries(successByUser)) {
    const { data: autofill } = await supabase
      .from('autofill_data')
      .select('name')
      .eq('user_id', userId)
      .single()

    const { data: authUser } = await supabase.auth.admin.getUserById(userId)
    const email = authUser?.user?.email

    if (email && apps.length) {
      await sendApplicationEmail(email, apps)
    }

    // Update last run stats
    await supabase.from('auto_apply_settings').update({
      last_run_at: new Date().toISOString(),
      last_run_count: apps.length,
      last_run_summary: `Applied to ${apps.length} job${apps.length > 1 ? 's' : ''}: ${apps.map(a => a.company).join(', ')}`,
    }).eq('user_id', userId)
  }

  return {
    processed: results.length,
    succeeded: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
  }
}