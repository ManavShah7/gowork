import { generateAnswer, generateCoverLetter } from './openai.js'

async function fillInput(page, selector, value) {
  if (!value) return false
  try {
    const el = await page.$(selector)
    if (!el) return false
    await el.click({ clickCount: 3 })
    await el.type(value, { delay: 30 })
    return true
  } catch {
    return false
  }
}

async function uploadResume(page, resumeBuffer, fileName) {
  try {
    const fileInput = await page.$('input[type="file"]')
    if (!fileInput) return false
    await fileInput.setInputFiles({
      name: fileName || 'resume.pdf',
      mimeType: 'application/pdf',
      buffer: resumeBuffer,
    })
    await page.waitForTimeout(1000)
    return true
  } catch {
    return false
  }
}

export async function fillLever(page, autofill, profile, jobInfo, resumeBuffer) {
  const results = {
    fields_filled: 0,
    fields_failed: [],
    captcha_detected: false,
    cover_letter_generated: false,
  }

  // Wait for form
  await page.waitForSelector('input[name="name"]', { timeout: 10000 })

  const nameParts = (autofill.name || '').split(' ')
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''

  // ── BASIC FIELDS ──────────────────────────────────────────
  if (await fillInput(page, 'input[name="name"]', autofill.name)) results.fields_filled++
  else if (await fillInput(page, '#name', autofill.name)) results.fields_filled++

  if (await fillInput(page, 'input[name="email"]', autofill.email)) results.fields_filled++
  else if (await fillInput(page, '#email', autofill.email)) results.fields_filled++

  if (await fillInput(page, 'input[name="phone"]', autofill.phone)) results.fields_filled++
  else if (await fillInput(page, '#phone', autofill.phone)) results.fields_filled++

  // LinkedIn
  if (await fillInput(page, 'input[name="urls[LinkedIn]"]', autofill.linkedin_url)) results.fields_filled++
  else if (await fillInput(page, 'input[placeholder*="LinkedIn"]', autofill.linkedin_url)) results.fields_filled++

  // Portfolio
  if (await fillInput(page, 'input[name="urls[Portfolio]"]', autofill.portfolio_url)) results.fields_filled++
  else if (await fillInput(page, 'input[name="urls[Other]"]', autofill.portfolio_url)) results.fields_filled++

  // Location
  if (await fillInput(page, 'input[name="location"]', `${autofill.city}, ${autofill.state}`)) results.fields_filled++

  // Resume upload
  if (resumeBuffer) {
    if (await uploadResume(page, resumeBuffer, autofill.resume_file_name)) results.fields_filled++
    else results.fields_failed.push('resume')
  }

  // ── COVER LETTER ──────────────────────────────────────────
  const coverLetterField = await page.$('textarea[name="comments"]') ||
    await page.$('textarea[id*="cover"]') ||
    await page.$('textarea[placeholder*="cover"]')

  if (coverLetterField) {
    const coverLetter = await generateCoverLetter(profile, jobInfo)
    await coverLetterField.fill(coverLetter)
    results.cover_letter_generated = true
    results.fields_filled++
  }

  // ── CUSTOM QUESTIONS ──────────────────────────────────────
  const customFields = await page.$$('input[name^="cards["], textarea[name^="cards["]')

  for (const field of customFields) {
    try {
      const name = await field.getAttribute('name')
      const label = await page.$eval(
        `label[for="${await field.getAttribute('id')}"]`,
        el => el.textContent.trim()
      ).catch(() => '')

      if (!label) continue
      const labelLower = label.toLowerCase()

      if (labelLower.includes('authorized') || labelLower.includes('work authorization')) {
        await fillInput(page, `[name="${name}"]`, autofill.authorized_to_work ? 'Yes' : 'No')
        results.fields_filled++
      } else if (labelLower.includes('sponsor')) {
        await fillInput(page, `[name="${name}"]`, autofill.sponsorship_needed ? 'Yes' : 'No')
        results.fields_filled++
      } else {
        const tag = await field.evaluate(el => el.tagName)
        if (tag === 'TEXTAREA') {
          const answer = await generateAnswer(label, profile, jobInfo)
          await field.fill(answer)
          results.fields_filled++
        }
      }
    } catch {}
  }

  // ── CAPTCHA CHECK ─────────────────────────────────────────
  const captcha = await page.$('[class*="recaptcha"], [id*="recaptcha"]')
  if (captcha) results.captcha_detected = true

  return results
}