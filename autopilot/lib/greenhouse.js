import { generateAnswer, generateCoverLetter } from './openai.js'

// Fill a React Select dropdown
async function fillReactSelect(page, fieldId, value) {
  if (!value) return false
  try {
    const input = await page.$(`#${fieldId}`)
    if (!input) return false

    // Click to open dropdown
    await input.click()
    await page.waitForTimeout(600)

    // Look for options
    const options = await page.$$('[class*="option"]')
    if (!options.length) {
      // Try parent container click
      const container = await page.$(`#${fieldId}`)
      await container?.click({ force: true })
      await page.waitForTimeout(600)
    }

    // Find matching option
    const valueLower = value.toLowerCase().replace(/\s/g, '')
    const allOptions = await page.$$('[class*="option"]')

    for (const option of allOptions) {
      const text = await option.textContent()
      const textLower = text.toLowerCase().replace(/\s/g, '')
      if (textLower.includes(valueLower) || valueLower.includes(textLower)) {
        await option.click()
        return true
      }
    }

    // Click "decline to self identify" as fallback
    for (const option of allOptions) {
      const text = await option.textContent()
      if (text.toLowerCase().includes('decline') || text.toLowerCase().includes('prefer not')) {
        await option.click()
        return true
      }
    }

    // Close dropdown
    await page.keyboard.press('Escape')
    return false
  } catch {
    return false
  }
}

// Fill a regular input field
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

// Upload resume file
async function uploadResume(page, resumeBuffer, fileName) {
  try {
    const fileInput = await page.$('#resume')
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

// Main Greenhouse filler
export async function fillGreenhouse(page, autofill, profile, jobInfo, resumeBuffer) {
  const results = {
    fields_filled: 0,
    fields_failed: [],
    captcha_detected: false,
    cover_letter_generated: false,
  }

  // Wait for form to load
  await page.waitForSelector('#first_name', { timeout: 10000 })

  // ── BASIC FIELDS ──────────────────────────────────────────
  const nameParts = (autofill.name || '').split(' ')
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''

  if (await fillInput(page, '#first_name', firstName)) results.fields_filled++
  else results.fields_failed.push('first_name')

  if (await fillInput(page, '#last_name', lastName)) results.fields_filled++
  else results.fields_failed.push('last_name')

  if (await fillInput(page, '#email', autofill.email)) results.fields_filled++
  else results.fields_failed.push('email')

  if (await fillInput(page, '#phone', autofill.phone)) results.fields_filled++
  else results.fields_failed.push('phone')

  // Location field
  if (autofill.city && autofill.state) {
    await fillInput(page, '#candidate-location', `${autofill.city}, ${autofill.state}`)
    results.fields_filled++
  }

  // ── RESUME UPLOAD ─────────────────────────────────────────
  if (resumeBuffer) {
    if (await uploadResume(page, resumeBuffer, autofill.resume_file_name)) {
      results.fields_filled++
    } else {
      results.fields_failed.push('resume')
    }
  }

  // ── CUSTOM QUESTIONS ──────────────────────────────────────
  // Get all question fields with their labels
  const questions = await page.$$eval('[id^="question_"]', els =>
    els
      .filter(el => el.tagName !== 'DIV' && el.tagName !== 'LABEL')
      .map(el => ({
        id: el.id,
        tag: el.tagName,
        label: document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() || '',
      }))
  )

  for (const q of questions) {
    if (!q.label || !q.id) continue

    const labelLower = q.label.toLowerCase()

    // LinkedIn
    if (labelLower.includes('linkedin')) {
      await fillInput(page, `#${q.id}`, autofill.linkedin_url || '')
      results.fields_filled++
      continue
    }

    // Portfolio / website
    if (labelLower.includes('website') || labelLower.includes('portfolio') || labelLower.includes('github')) {
      await fillInput(page, `#${q.id}`, autofill.portfolio_url || '')
      results.fields_filled++
      continue
    }

    // Pronouns
    if (labelLower.includes('pronoun')) {
      await fillInput(page, `#${q.id}`, autofill.pronouns || 'They/Them')
      results.fields_filled++
      continue
    }

    // Work authorization
    if (labelLower.includes('authorized') || labelLower.includes('work authorization') || labelLower.includes('legally')) {
      await fillInput(page, `#${q.id}`, autofill.authorized_to_work ? 'Yes' : 'No')
      results.fields_filled++
      continue
    }

    // Sponsorship
    if (labelLower.includes('sponsor') || labelLower.includes('visa')) {
      await fillInput(page, `#${q.id}`, autofill.sponsorship_needed ? 'Yes' : 'No')
      results.fields_filled++
      continue
    }

    // Preferred name
    if (labelLower.includes('preferred') && labelLower.includes('name')) {
      await fillInput(page, `#${q.id}`, firstName)
      results.fields_filled++
      continue
    }

    // Location / where do you intend to work
    if (labelLower.includes('where') && (labelLower.includes('work') || labelLower.includes('locat'))) {
      await fillInput(page, `#${q.id}`, `${autofill.city}, ${autofill.state}`)
      results.fields_filled++
      continue
    }

    // "Have you ever worked for X before"
    if (labelLower.includes('worked for') || labelLower.includes('previously employed')) {
      await fillInput(page, `#${q.id}`, 'No')
      results.fields_filled++
      continue
    }

    // Cover letter textarea
    if (labelLower.includes('cover letter')) {
      const coverLetter = await generateCoverLetter(profile, jobInfo)
      if (q.tag === 'TEXTAREA') {
        await page.fill(`#${q.id}`, coverLetter)
      } else {
        await fillInput(page, `#${q.id}`, coverLetter)
      }
      results.cover_letter_generated = true
      results.fields_filled++
      continue
    }

    // Open-ended questions — AI answers them
    if (q.tag === 'TEXTAREA' || labelLower.includes('why') || labelLower.includes('tell us') || labelLower.includes('describe')) {
      const answer = await generateAnswer(q.label, profile, jobInfo)
      if (answer) {
        await page.fill(`#${q.id}`, answer)
        results.fields_filled++
      }
      continue
    }

    // Additional information
    if (labelLower.includes('additional') || labelLower.includes('anything else')) {
      await page.fill(`#${q.id}`, '')
      results.fields_filled++
      continue
    }
  }

  // ── EEO DROPDOWNS ─────────────────────────────────────────
  await fillReactSelect(page, 'gender', autofill.gender || 'Decline to Self Identify')
  await fillReactSelect(page, 'hispanic_ethnicity', autofill.ethnicity?.includes('Hispanic') ? 'Yes' : 'No')
  await fillReactSelect(page, 'veteran_status', autofill.veteran_status || 'I am not a protected veteran')
  await fillReactSelect(page, 'disability_status', autofill.disability_status || 'I do not have a disability')

  results.fields_filled += 4

  // ── CHECK FOR CAPTCHA ──────────────────────────────────────
  const captcha = await page.$('[class*="recaptcha"], [id*="recaptcha"], [data-sitekey]')
  if (captcha) {
    results.captcha_detected = true
  }

  return results
}