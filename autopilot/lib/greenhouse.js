import { generateAnswer, generateCoverLetter } from './openai.js'

async function fillReactSelect(page, fieldId, value) {
  if (!value) return false
  try {
    console.log(`    React Select #${fieldId} → "${value}"`)
    const input = await page.$(`#${fieldId}`)
    if (!input) { console.log(`    ✗ #${fieldId} not found`); return false }

    await input.click()
    await page.waitForTimeout(800)

    const valueLower = value.toLowerCase().replace(/\s/g, '')
    const allOptions = await page.$$('[class*="option"]')
    console.log(`    Found ${allOptions.length} options`)

    for (const option of allOptions) {
      const text = await option.textContent()
      const textLower = text.toLowerCase().replace(/\s/g, '')
      if (textLower.includes(valueLower) || valueLower.includes(textLower)) {
        console.log(`    ✓ Selected: "${text.trim()}"`)
        await option.click()
        return true
      }
    }

    // Fallback: decline / prefer not to say
    for (const option of allOptions) {
      const text = await option.textContent()
      if (text.toLowerCase().includes('decline') || text.toLowerCase().includes('prefer not')) {
        console.log(`    ✓ Fallback: "${text.trim()}"`)
        await option.click()
        return true
      }
    }

    await page.keyboard.press('Escape')
    console.log(`    ✗ No match for "${value}"`)
    return false
  } catch (err) {
    console.log(`    ✗ React Select error: ${err.message}`)
    return false
  }
}

async function fillInput(page, selector, value) {
  if (!value) return false
  try {
    const el = await page.$(selector)
    if (!el) { console.log(`    ✗ Not found: ${selector}`); return false }
    await el.click({ clickCount: 3 })
    await el.type(String(value), { delay: 30 })
    console.log(`    ✓ Filled ${selector}: "${String(value).slice(0, 40)}"`)
    return true
  } catch (err) {
    console.log(`    ✗ Failed ${selector}: ${err.message}`)
    return false
  }
}

async function uploadResume(page, resumeBuffer, fileName) {
  try {
    const fileInput = await page.$('#resume')
    if (!fileInput) { console.log('    ✗ #resume not found'); return false }
    await fileInput.setInputFiles({
      name: fileName || 'resume.pdf',
      mimeType: 'application/pdf',
      buffer: resumeBuffer,
    })
    await page.waitForTimeout(1500)
    console.log(`    ✓ Resume uploaded: ${fileName}`)
    return true
  } catch (err) {
    console.log(`    ✗ Resume upload failed: ${err.message}`)
    return false
  }
}

export async function fillGreenhouse(page, autofill, profile, jobInfo, resumeBuffer) {
  const results = {
    fields_filled: 0,
    fields_failed: [],
    captcha_detected: false,
    cover_letter_generated: false,
  }

  try {
    console.log('  Waiting for Greenhouse form...')
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
    console.log(`  URL: ${page.url()}`)

    // Click Apply if on description page
    if (!page.url().includes('/apply') && !page.url().includes('application')) {
      console.log('  Looking for Apply button...')
      try {
        const applyBtn =
          await page.$('a[href*="apply"]') ||
          await page.$('a:has-text("Apply for this Job")') ||
          await page.$('a:has-text("Apply Now")') ||
          await page.$('button:has-text("Apply")')

        if (applyBtn) {
          console.log('  Clicking Apply...')
          await applyBtn.click()
          await page.waitForTimeout(2000)
          await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
          console.log(`  Now at: ${page.url()}`)
        }
      } catch (err) {
        console.log(`  Apply button error: ${err.message}`)
      }
    }

    // Wait for form
    try {
      await page.waitForSelector('#first_name', { timeout: 20000 })
      console.log('  Form loaded ✓')
    } catch {
      console.log('  ERROR: #first_name not found')
      return results
    }

    const nameParts = (autofill.name || '').split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    // Basic fields
    console.log('\n  Filling basic fields...')
    if (await fillInput(page, '#first_name', firstName)) results.fields_filled++
    else results.fields_failed.push('first_name')

    if (await fillInput(page, '#last_name', lastName)) results.fields_filled++
    else results.fields_failed.push('last_name')

    if (await fillInput(page, '#email', autofill.email)) results.fields_filled++
    else results.fields_failed.push('email')

    if (await fillInput(page, '#phone', autofill.phone)) results.fields_filled++
    else results.fields_failed.push('phone')

    if (autofill.city && autofill.state) {
      if (await fillInput(page, '#candidate-location', `${autofill.city}, ${autofill.state}`)) {
        results.fields_filled++
      }
    }

    // Resume
    console.log('\n  Uploading resume...')
    if (resumeBuffer) {
      if (await uploadResume(page, resumeBuffer, autofill.resume_file_name)) results.fields_filled++
      else results.fields_failed.push('resume')
    }

    // Custom questions
    console.log('\n  Filling custom questions...')
    try {
      const questions = await page.$$eval('[id^="question_"]', els =>
        els
          .filter(el => el.tagName !== 'DIV' && el.tagName !== 'LABEL')
          .map(el => ({
            id: el.id,
            tag: el.tagName,
            label: document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() || '',
          }))
      )
      console.log(`  Found ${questions.length} custom questions`)

      for (const q of questions) {
        try {
          if (!q.label || !q.id) continue
          const labelLower = q.label.toLowerCase()
          console.log(`  Q: "${q.label.slice(0, 60)}" [${q.tag}]`)

          if (labelLower.includes('linkedin')) {
            const linkedinUrl = autofill.linkedin_url || ''
            if (linkedinUrl.toLowerCase().includes('linkedin')) {
              await fillInput(page, `#${q.id}`, linkedinUrl)
              results.fields_filled++
            }
          } else if (labelLower.includes('website') || labelLower.includes('portfolio') || labelLower.includes('github')) {
            const portfolioUrl = autofill.portfolio_url || ''
            if (portfolioUrl.includes('.')) {
              await fillInput(page, `#${q.id}`, portfolioUrl)
              results.fields_filled++
            }
          } else if (labelLower.includes('pronoun')) {
            await fillInput(page, `#${q.id}`, autofill.pronouns || '')
            results.fields_filled++
          } else if (labelLower.includes('authorized') || labelLower.includes('legally')) {
            await fillInput(page, `#${q.id}`, autofill.authorized_to_work ? 'Yes' : 'No')
            results.fields_filled++
          } else if (labelLower.includes('sponsor') || (labelLower.includes('visa') && labelLower.includes('require'))) {
            await fillInput(page, `#${q.id}`, autofill.sponsorship_needed ? 'Yes' : 'No')
            results.fields_filled++
          } else if (labelLower.includes('preferred') && labelLower.includes('name')) {
            await fillInput(page, `#${q.id}`, firstName)
            results.fields_filled++
          } else if (labelLower.includes('where') && labelLower.includes('work')) {
            await fillInput(page, `#${q.id}`, `${autofill.city}, ${autofill.state}`)
            results.fields_filled++
          } else if (labelLower.includes('worked for') || labelLower.includes('previously employed')) {
            await fillInput(page, `#${q.id}`, 'No')
            results.fields_filled++
          } else if (labelLower.includes('cover letter')) {
            const coverLetter = await generateCoverLetter(profile, jobInfo)
            await page.fill(`#${q.id}`, coverLetter)
            results.cover_letter_generated = true
            results.fields_filled++
            console.log(`    ✓ Cover letter generated (${coverLetter.length} chars)`)
          } else if (q.tag === 'TEXTAREA' || labelLower.includes('why') || labelLower.includes('tell us') || labelLower.includes('describe') || labelLower.includes('what')) {
            const answer = await generateAnswer(q.label, profile, jobInfo)
            if (answer) {
              await page.fill(`#${q.id}`, answer)
              results.fields_filled++
            }
          } else if (labelLower.includes('additional')) {
            await page.fill(`#${q.id}`, '')
            results.fields_filled++
          }
        } catch (err) {
          console.log(`    Question error: ${err.message}`)
        }
      }
    } catch (err) {
      console.log(`  Custom questions error: ${err.message}`)
    }

    // EEO dropdowns
    console.log('\n  Filling EEO dropdowns...')
    await fillReactSelect(page, 'gender', autofill.gender || 'Decline to Self Identify')
    await fillReactSelect(page, 'hispanic_ethnicity', autofill.ethnicity?.toLowerCase().includes('hispanic') ? 'Yes' : 'No')
    await fillReactSelect(page, 'veteran_status', autofill.veteran_status || 'I am not a protected veteran')
    await fillReactSelect(page, 'disability_status', autofill.disability_status || 'I do not have a disability')
    results.fields_filled += 4

    // CAPTCHA
    console.log('\n  Checking CAPTCHA...')
    try {
      const captcha = await page.$(
        '[class*="recaptcha"], [id*="recaptcha"], [data-sitekey], ' +
        '[class*="hcaptcha"], [id*="hcaptcha"], [data-hcaptcha-sitekey], ' +
        'iframe[src*="hcaptcha"], iframe[src*="recaptcha"]'
      )
      if (captcha) {
        console.log('  ⚠️ CAPTCHA DETECTED')
        results.captcha_detected = true
      } else {
        console.log('  No CAPTCHA ✓')
      }
    } catch (err) {
      console.log(`  CAPTCHA check error: ${err.message}`)
    }

  } catch (err) {
    console.log(`  fillGreenhouse unexpected error: ${err.message}`)
    console.log(err.stack)
  }

  return results
}