import { generateAnswer, generateCoverLetter } from './openai.js'

async function uploadResume(page, resumeBuffer, fileName) {
  try {
    const fileInputs = await page.$$('input[type="file"]')
    for (const input of fileInputs) {
      const accept = await input.getAttribute('accept') || ''
      if (accept.includes('pdf') || accept.includes('doc') || accept === '' || accept.includes('*')) {
        await input.setInputFiles({
          name: fileName || 'resume.pdf',
          mimeType: 'application/pdf',
          buffer: resumeBuffer,
        })
        await page.waitForTimeout(1500)
        console.log('    ✓ Resume uploaded')
        return true
      }
    }
    console.log('    ✗ No suitable file input found')
    return false
  } catch (err) {
    console.log(`    ✗ Resume upload failed: ${err.message}`)
    return false
  }
}

export async function fillGeneric(page, autofill, profile, jobInfo, resumeBuffer) {
  const results = {
    fields_filled: 0,
    fields_failed: [],
    captcha_detected: false,
    cover_letter_generated: false,
  }

  try {
    console.log('  Generic filler — scanning page...')
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})

    // Look for Apply button
    const applySelectors = [
      'a:has-text("Apply Now")',
      'a:has-text("Apply for this Job")',
      'a:has-text("Apply")',
      'button:has-text("Apply Now")',
      'button:has-text("Apply")',
      'a[href*="apply"]',
      '[class*="apply-btn"]',
      '[class*="applyBtn"]',
    ]

    for (const sel of applySelectors) {
      try {
        const btn = await page.$(sel)
        if (btn) {
          const isVisible = await btn.isVisible().catch(() => false)
          if (isVisible) {
            console.log(`  Found apply button: ${sel}`)
            await btn.click()
            await page.waitForTimeout(3000)
            await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
            console.log(`  Now at: ${page.url()}`)
            break
          }
        }
      } catch {}
    }

    // Scan all form fields
    const allInputs = await page.$$(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), textarea, select'
    )
    console.log(`  Found ${allInputs.length} form fields`)

    const nameParts = (autofill.name || '').split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    for (const input of allInputs) {
      try {
        const isVisible = await input.isVisible().catch(() => false)
        if (!isVisible) continue

        const id = await input.getAttribute('id') || ''
        const name = await input.getAttribute('name') || ''
        const placeholder = await input.getAttribute('placeholder') || ''
        const type = await input.getAttribute('type') || 'text'
        const tag = await input.evaluate(el => el.tagName.toLowerCase())

        const label = await page.$eval(
          `label[for="${id}"]`,
          el => el.textContent.trim()
        ).catch(() => '')

        const combined = `${id} ${name} ${placeholder} ${label}`.toLowerCase()
        console.log(`  Field: id="${id}" type="${type}" label="${label.slice(0, 30)}"`)

        // File upload
        if (type === 'file') {
          if (resumeBuffer) await uploadResume(page, resumeBuffer, autofill.resume_file_name)
          continue
        }

        let value = null

        if (combined.includes('first') && combined.includes('name')) value = firstName
        else if (combined.includes('last') && combined.includes('name')) value = lastName
        else if (combined.match(/\bfullname\b|\bfull.name\b/)) value = autofill.name
        else if (combined.match(/\bname\b/) && !combined.includes('company') && !combined.includes('school') && !combined.includes('last') && !combined.includes('first')) value = autofill.name
        else if (combined.includes('email')) value = autofill.email
        else if (combined.includes('phone') || combined.includes('mobile') || type === 'tel') value = autofill.phone
        else if (combined.includes('linkedin')) {
          const linkedinUrl = autofill.linkedin_url || ''
          if (linkedinUrl.toLowerCase().includes('linkedin')) value = linkedinUrl
        } else if (combined.includes('portfolio') || combined.includes('website') || combined.includes('github')) {
          const portfolioUrl = autofill.portfolio_url || ''
          if (portfolioUrl.includes('.')) value = portfolioUrl
        } else if (combined.includes('location') || combined.includes('city')) {
          value = `${autofill.city}, ${autofill.state}`
        } else if (combined.includes('zip') || combined.includes('postal')) {
          value = autofill.zip || ''
        } else if (combined.includes('authorized') || combined.includes('work auth')) {
          value = autofill.authorized_to_work ? 'Yes' : 'No'
        } else if (combined.includes('sponsor')) {
          value = autofill.sponsorship_needed ? 'Yes' : 'No'
        } else if (combined.includes('pronoun')) {
          value = autofill.pronouns || ''
        } else if (combined.includes('cover letter') && tag === 'textarea') {
          const coverLetter = await generateCoverLetter(profile, jobInfo)
          await input.fill(coverLetter)
          results.cover_letter_generated = true
          results.fields_filled++
          console.log('    ✓ Cover letter generated')
          continue
        } else if (tag === 'textarea' && label && label.length > 5) {
          const answer = await generateAnswer(label, profile, jobInfo)
          if (answer) {
            await input.fill(answer)
            results.fields_filled++
            console.log(`    ✓ AI answered textarea`)
          }
          continue
        }

        if (value) {
          if (tag === 'select') {
            await input.selectOption({ label: value }).catch(() =>
              input.selectOption({ value }).catch(() => {})
            )
            results.fields_filled++
            console.log(`    ✓ Select: "${value}"`)
          } else {
            await input.click({ clickCount: 3 })
            await input.type(String(value), { delay: 30 })
            results.fields_filled++
            console.log(`    ✓ Filled: "${String(value).slice(0, 40)}"`)
          }
        }
      } catch (err) {
        console.log(`    Field error: ${err.message}`)
      }
    }

    // CAPTCHA
    console.log('\n  Checking CAPTCHA...')
    const captcha = await page.$(
      '[class*="recaptcha"], [id*="recaptcha"], [data-sitekey], ' +
      '[class*="hcaptcha"], [id*="hcaptcha"], iframe[src*="hcaptcha"]'
    ).catch(() => null)

    if (captcha) {
      console.log('  ⚠️ CAPTCHA DETECTED')
      results.captcha_detected = true
    } else {
      console.log('  No CAPTCHA ✓')
    }

    console.log(`\n  Generic filler done: ${results.fields_filled} fields filled`)

  } catch (err) {
    console.log(`  fillGeneric unexpected error: ${err.message}`)
    console.log(err.stack)
  }

  return results
}