import { generateAnswer, generateCoverLetter } from './openai.js'

async function fillInput(page, selector, value) {
  if (!value) return false
  try {
    const el = await page.$(selector)
    if (!el) { console.log(`    ✗ Not found: ${selector}`); return false }
    await el.scrollIntoViewIfNeeded()
    await page.waitForTimeout(200)
    await el.click({ clickCount: 3 })
    await el.type(String(value), { delay: 30 })
    console.log(`    ✓ Filled ${selector}: "${String(value).slice(0, 40)}"`)
    return true
  } catch (err) {
    console.log(`    ✗ Failed ${selector}: ${err.message}`)
    return false
  }
}

async function fillLocation(page, city, state) {
  try {
    const locationInput =
      await page.$('input[name="location"]') ||
      await page.$('#location') ||
      await page.$('input[placeholder*="ocation"]')

    if (!locationInput) { console.log('    ✗ Location input not found'); return false }

    await locationInput.scrollIntoViewIfNeeded()
    const locationStr = `${city}, ${state}`
    await locationInput.click({ clickCount: 3 })
    await locationInput.type(locationStr, { delay: 80 })
    await page.waitForTimeout(1500)
    await locationInput.press('ArrowDown')
    await page.waitForTimeout(300)
    await locationInput.press('Enter')
    await page.waitForTimeout(500)
    console.log(`    ✓ Location: ${locationStr}`)
    return true
  } catch (err) {
    console.log(`    ✗ Location error: ${err.message}`)
    return false
  }
}

async function uploadResume(page, resumeBuffer, fileName) {
  try {
    const fileInput = await page.$('input[type="file"]')
    if (!fileInput) { console.log('    ✗ File input not found'); return false }
    await fileInput.setInputFiles({
      name: fileName || 'resume.pdf',
      mimeType: 'application/pdf',
      buffer: resumeBuffer,
    })
    await page.waitForTimeout(1500)
    console.log(`    ✓ Resume: ${fileName}`)
    return true
  } catch (err) {
    console.log(`    ✗ Resume failed: ${err.message}`)
    return false
  }
}

async function scrollAndLoadPage(page) {
  // Scroll down section by section to trigger lazy loading
  console.log('  Scrolling page to load all fields...')
  const height = await page.evaluate(() => document.body.scrollHeight)
  const steps = 5
  for (let i = 1; i <= steps; i++) {
    await page.evaluate((pos) => window.scrollTo(0, pos), (height / steps) * i)
    await page.waitForTimeout(400)
  }
  // Scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(500)
  console.log('  Page fully loaded ✓')
}

export async function fillLever(page, autofill, profile, jobInfo, resumeBuffer) {
  const results = {
    fields_filled: 0,
    fields_failed: [],
    captcha_detected: false,
    cover_letter_generated: false,
  }

  try {
    console.log(`  URL: ${page.url()}`)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})

    // Click Apply if on description page
    if (!page.url().includes('/apply')) {
      console.log('  Looking for Apply button...')
      try {
        const applyBtn =
          await page.$('a[href*="/apply"]') ||
          await page.$('a:has-text("Apply for this job")') ||
          await page.$('a:has-text("Apply now")') ||
          await page.$('button:has-text("Apply")')

        if (applyBtn) {
          const href = await applyBtn.getAttribute('href').catch(() => '')
          console.log(`  Apply: ${href}`)
          await applyBtn.click()
          await page.waitForTimeout(3000)
          await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
          console.log(`  Now at: ${page.url()}`)
        }
      } catch (err) {
        console.log(`  Apply button error: ${err.message}`)
      }
    }

    // Wait for form
    try {
      await page.waitForSelector('input[name="name"]', { timeout: 20000 })
      console.log('  Form loaded ✓')
    } catch {
      console.log('  ERROR: Lever form not found')
      return results
    }

    // Scroll to load all fields
    await scrollAndLoadPage(page)

    // Basic fields
    console.log('\n  Filling basic fields...')

    if (await fillInput(page, 'input[name="name"]', autofill.name)) results.fields_filled++
    else if (await fillInput(page, '#name', autofill.name)) results.fields_filled++
    else results.fields_failed.push('name')

    if (await fillInput(page, 'input[name="email"]', autofill.email)) results.fields_filled++
    else if (await fillInput(page, '#email', autofill.email)) results.fields_filled++
    else results.fields_failed.push('email')

    if (await fillInput(page, 'input[name="phone"]', autofill.phone)) results.fields_filled++
    else results.fields_failed.push('phone')

    // LinkedIn
    const linkedinUrl = autofill.linkedin_url || ''
    if (linkedinUrl.toLowerCase().includes('linkedin')) {
      if (await fillInput(page, 'input[name="urls[LinkedIn]"]', linkedinUrl)) results.fields_filled++
    } else {
      console.log(`    ✗ LinkedIn not a valid URL: "${linkedinUrl}"`)
    }

    // Portfolio
    const portfolioUrl = autofill.portfolio_url || ''
    if (portfolioUrl.includes('.') && portfolioUrl.length > 5 && !portfolioUrl.toLowerCase().includes('github.com') === false || portfolioUrl.toLowerCase().includes('github.com') || portfolioUrl.toLowerCase().includes('http')) {
      if (await fillInput(page, 'input[name="urls[Portfolio]"]', portfolioUrl)) results.fields_filled++
      else if (await fillInput(page, 'input[name="urls[GitHub]"]', portfolioUrl)) results.fields_filled++
      else await fillInput(page, 'input[name="urls[Other]"]', portfolioUrl)
    } else {
      console.log(`    ✗ Portfolio not a valid URL: "${portfolioUrl}"`)
    }

    // Location
    console.log('\n  Filling location...')
    if (await fillLocation(page, autofill.city || 'Boston', autofill.state || 'MA')) {
      results.fields_filled++
    }

    // Resume
    console.log('\n  Uploading resume...')
    if (resumeBuffer) {
      if (await uploadResume(page, resumeBuffer, autofill.resume_file_name)) results.fields_filled++
      else results.fields_failed.push('resume')
    }

    // Cover letter
    console.log('\n  Checking cover letter...')
    try {
      const coverLetterField =
        await page.$('textarea[name="comments"]') ||
        await page.$('textarea[id*="cover"]') ||
        await page.$('textarea[placeholder*="cover"]') ||
        await page.$('textarea[placeholder*="Cover"]')

      if (coverLetterField) {
        await coverLetterField.scrollIntoViewIfNeeded()
        const isVisible = await coverLetterField.isVisible().catch(() => false)
        if (isVisible) {
          console.log('  Generating cover letter...')
          const coverLetter = await generateCoverLetter(profile, jobInfo)
          await coverLetterField.fill(coverLetter)
          results.cover_letter_generated = true
          results.fields_filled++
          console.log(`  ✓ Cover letter (${coverLetter.length} chars)`)
        }
      } else {
        console.log('  No cover letter field')
      }
    } catch (err) {
      console.log(`  Cover letter error: ${err.message}`)
    }

    // Custom questions — scroll to each one
    console.log('\n  Filling custom questions...')
    try {
      // Get ALL inputs and textareas on the page
      const allFields = await page.$$('input[name^="cards["], textarea[name^="cards["]')
      console.log(`  Found ${allFields.length} custom fields`)

      let answered = 0
      for (const field of allFields) {
        try {
          // Scroll to field first
          await field.scrollIntoViewIfNeeded()
          await page.waitForTimeout(200)

          const isVisible = await field.isVisible().catch(() => false)
          if (!isVisible) {
            console.log('    Skipping invisible field')
            continue
          }

          const name = await field.getAttribute('name')
          const id = await field.getAttribute('id')
          if (!name) continue

          // Try multiple label strategies
          let label = ''

          if (id) {
            label = await page.$eval(
              `label[for="${id}"]`,
              el => el.textContent.trim()
            ).catch(() => '')
          }

          // If no label by for= attribute, try parent container
          if (!label) {
            label = await field.evaluate(el => {
              const parent = el.closest('.application-question, .field, [class*="question"], [class*="field"]')
              if (parent) {
                const labelEl = parent.querySelector('label, .label, [class*="label"]')
                return labelEl?.textContent?.trim() || ''
              }
              return ''
            }).catch(() => '')
          }

          if (!label) {
            // Try previous sibling or parent text
            label = await field.evaluate(el => {
              let node = el.previousElementSibling
              while (node) {
                if (node.tagName === 'LABEL' || node.className?.includes('label')) {
                  return node.textContent.trim()
                }
                node = node.previousElementSibling
              }
              return el.getAttribute('placeholder') || ''
            }).catch(() => '')
          }

          if (!label) continue
          const labelLower = label.toLowerCase()
          console.log(`  Q: "${label.slice(0, 70)}"`)

          const tag = await field.evaluate(el => el.tagName)

          if (labelLower.includes('authorized') || labelLower.includes('work auth') || labelLower.includes('legally authorized')) {
            await fillInput(page, `[name="${name}"]`, autofill.authorized_to_work ? 'Yes' : 'No')
            results.fields_filled++; answered++
          } else if (labelLower.includes('sponsorship') || labelLower.includes('sponsor')) {
            await fillInput(page, `[name="${name}"]`, autofill.sponsorship_needed ? 'Yes' : 'No')
            results.fields_filled++; answered++
          } else if (labelLower.includes('pronoun')) {
            if (autofill.pronouns) {
              await fillInput(page, `[name="${name}"]`, autofill.pronouns)
              results.fields_filled++; answered++
            }
          } else if (tag === 'TEXTAREA') {
            console.log(`    Generating AI answer...`)
            const answer = await generateAnswer(label, profile, jobInfo)
            if (answer) {
              await field.scrollIntoViewIfNeeded()
              await field.fill(answer)
              results.fields_filled++; answered++
              console.log(`    ✓ AI answered (${answer.length} chars)`)
            }
          } else if (tag === 'INPUT') {
            // Short text questions
            const answer = await generateAnswer(label, profile, jobInfo)
            if (answer) {
              const shortAnswer = answer.split('.')[0] // first sentence only
              await field.scrollIntoViewIfNeeded()
              await field.click({ clickCount: 3 })
              await field.type(shortAnswer, { delay: 20 })
              results.fields_filled++; answered++
              console.log(`    ✓ Short answer: "${shortAnswer.slice(0, 40)}"`)
            }
          }
        } catch (err) {
          console.log(`    Question error: ${err.message}`)
        }
      }
      console.log(`  Answered ${answered}/${allFields.length} questions`)
    } catch (err) {
      console.log(`  Custom questions error: ${err.message}`)
    }

    // CAPTCHA — detect but DON'T stop, let BrowserBase solve on submit
    console.log('\n  Checking CAPTCHA...')
    try {
      const captcha = await page.$(
        '[class*="recaptcha"], [id*="recaptcha"], [data-sitekey], ' +
        '[class*="hcaptcha"], [id*="hcaptcha"], [data-hcaptcha-sitekey], ' +
        'iframe[src*="hcaptcha"], iframe[src*="recaptcha"]'
      )
      if (captcha) {
        console.log('  ⚠️ CAPTCHA present — BrowserBase will solve on submit')
        results.captcha_detected = true
        // Don't return early — BrowserBase solves during submission
      } else {
        console.log('  No CAPTCHA ✓')
      }
    } catch (err) {
      console.log(`  CAPTCHA check error: ${err.message}`)
    }

  } catch (err) {
    console.log(`  fillLever unexpected error: ${err.message}`)
    console.log(err.stack)
  }

  return results
}