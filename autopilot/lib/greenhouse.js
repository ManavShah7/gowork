import { generateAnswer, generateCoverLetter, chooseFromOptions } from './openai.js'

// TESTING: when true, never hand off to a human — fill a best-effort answer for
// every question (LLM pick regardless of confidence, else first option) so the
// form submits end-to-end. Leave FALSE in shared/production code: that restores
// the safe human hand-off for required questions we can't confidently answer.
const TESTING_FILL_ANYTHING = false

async function fillReactSelect(page, fieldId, value) {
  if (!value) return false
  try {
    console.log(`    React Select #${fieldId} → "${value}"`)
    // Attribute selector (not #id) so ids containing [] (multi-selects) are valid.
    const input = await page.$(`[id="${fieldId}"]`)
    if (!input) { console.log(`    ✗ #${fieldId} not found`); return false }

    await input.click()
    await page.waitForTimeout(800)

    const valueLower = value.toLowerCase().replace(/\s/g, '')
    let allOptions = await page.$$('[class*="option"]')
    if (!allOptions.length) { // menu not rendered yet — retry once
      await page.waitForTimeout(1200)
      allOptions = await page.$$('[class*="option"]')
    }
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

    // Testing: rather than give up, just pick the first real option.
    if (TESTING_FILL_ANYTHING && allOptions.length) {
      const text = await allOptions[0].textContent()
      console.log(`    ✓ [testing] first option: "${text.trim()}"`)
      await allOptions[0].click()
      return true
    }

    await page.keyboard.press('Escape')
    console.log(`    ✗ No match for "${value}"`)
    return false
  } catch (err) {
    console.log(`    ✗ React Select error: ${err.message}`)
    return false
  }
}

// Open a react-select and read its visible option texts (then close it).
// Used so the LLM can choose from the REAL options for unrecognized questions.
async function readReactSelectOptions(page, fieldId) {
  try {
    const input = await page.$(`[id="${fieldId}"]`)
    if (!input) return []
    await input.click()
    await page.waitForTimeout(500)
    const opts = await page.$$eval('[class*="option"]', els =>
      els.map(e => (e.textContent || '').trim()).filter(Boolean)
    )
    await page.keyboard.press('Escape')
    // de-dupe + drop obvious placeholders
    return [...new Set(opts)].filter(t => !/^(select|choose|--)/i.test(t))
  } catch {
    return []
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

// Pick an <option> from a native <select> by matching label/value text.
async function selectNative(page, id, value) {
  if (!value) return false
  try {
    try { await page.selectOption(`[id="${id}"]`, { label: value }); console.log(`    ✓ Select #${id} → "${value}"`); return true } catch {}
    const opts = await page.$$eval(`[id="${id}"] option`, os => os.map(o => ({ v: o.value, t: (o.textContent || '').trim() })))
    const vlow = value.toLowerCase().replace(/\s/g, '')
    const m = opts.find(o => o.t && (o.t.toLowerCase().replace(/\s/g, '').includes(vlow) || vlow.includes(o.t.toLowerCase().replace(/\s/g, ''))))
    if (m) { await page.selectOption(`[id="${id}"]`, m.v); console.log(`    ✓ Select #${id} → "${m.t}"`); return true }
    console.log(`    ✗ No <option> match for "${value}" in #${id}`)
    return false
  } catch (err) {
    console.log(`    ✗ selectNative error: ${err.message}`)
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

    // Country — required react-select on many Greenhouse forms (e.g. Twitch).
    // Was never filled before, which silently blocked submit.
    if (await fillReactSelect(page, 'country', autofill.user_country || 'United States')) {
      results.fields_filled++
    }

    // Location — Greenhouse uses a Google-places autocomplete. Typing alone
    // leaves it invalid ("Please enter your location"); we must select a
    // suggestion so a valid place is registered.
    if (autofill.city) {
      try {
        const locEl = await page.$('#candidate-location')
        if (locEl) {
          await locEl.click({ clickCount: 3 })
          await locEl.type(`${autofill.city}${autofill.state ? ', ' + autofill.state : ''}`, { delay: 50 })
          await page.waitForTimeout(1800) // wait for suggestions to load
          await page.keyboard.press('ArrowDown')
          await page.keyboard.press('Enter')
          await page.waitForTimeout(500)
          console.log('    ✓ Location selected from autocomplete')
          results.fields_filled++
        }
      } catch (err) {
        console.log(`    ✗ Location autocomplete failed: ${err.message}`)
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
      // Capture each question's TYPE (native select / react-select combobox /
      // text) and whether it's REQUIRED, so we can answer it correctly instead
      // of typing into everything.
      const questions = await page.$$eval('[id^="question_"]', els =>
        els
          .filter(el => !['DIV', 'LABEL', 'FIELDSET'].includes(el.tagName))
          .map(el => {
            const lbl = document.querySelector(`label[for="${el.id}"]`)
            const labelText = (lbl?.textContent || el.closest('div')?.querySelector('label')?.textContent || '').trim()
            return {
              id: el.id,
              tag: el.tagName,
              label: labelText.replace(/\s*\*\s*$/, ''),
              required: el.getAttribute('aria-required') === 'true' || el.required || /\*/.test(labelText),
              isSelect: el.tagName === 'SELECT',
              isMulti: el.id.endsWith('[]') || el.multiple,
              nativeOptions: el.tagName === 'SELECT'
                ? Array.from(el.querySelectorAll('option')).map(o => (o.textContent || '').trim()).filter(t => t && !/^(select|choose|--)/i.test(t))
                : [],
              isCombobox: el.getAttribute('role') === 'combobox'
                || el.getAttribute('aria-haspopup') === 'listbox'
                || !!el.closest('[class*="select__control"],[class*="select-shell"]'),
            }
          })
      )
      console.log(`  Found ${questions.length} custom questions`)

      // High-confidence answer from the user's known data, else null.
      const ruleValue = (q) => {
        const L = q.label.toLowerCase()
        if (L.includes('linkedin')) return (autofill.linkedin_url || '').toLowerCase().includes('linkedin') ? autofill.linkedin_url : null
        if (L.includes('website') || L.includes('portfolio') || L.includes('github')) return (autofill.portfolio_url || '').includes('.') ? autofill.portfolio_url : null
        if (L.includes('pronoun')) return autofill.pronouns || null
        if (L.includes('preferred') && L.includes('name')) return firstName
        if (L.includes('authorized') || (L.includes('eligible') && L.includes('work'))) return autofill.authorized_to_work ? 'Yes' : 'No'
        if (L.includes('sponsor') || (L.includes('visa') && L.includes('require'))) return autofill.sponsorship_needed ? 'Yes' : 'No'
        if (L.includes('relocat')) return autofill.willing_to_relocate ? 'Yes' : 'No'
        if (L.includes('travel')) return autofill.willing_to_travel ? 'Yes' : 'No'
        if (L.includes('employee') && (L.includes('current') || L.includes('currently'))) return 'No'
        if (L.includes('worked for') || L.includes('previously employed') || L.includes('previously applied') || L.includes('former employee')) return 'No'
        if (L.includes('noncomp') || (L.includes('non') && L.includes('competit'))) return 'No'
        if (/how did you hear|where did you (first )?hear|hear about|how did you (find|learn)|referral source/.test(L) || (L.includes('source') && L.length < 40)) return 'LinkedIn'
        return null
      }

      // ── Decide answers: rules first; unrecognized dropdowns get real options + one batched LLM call ──
      const apply = []        // confident answers to fill
      const llmQueue = []     // dropdowns needing the LLM to choose from real options
      const needsHuman = []   // required questions we can't answer confidently → hand off

      for (const q of questions) {
        if (!q.label || !q.id) continue
        const isDropdown = q.isSelect || q.isCombobox || q.isMulti
        if (!isDropdown) {
          // Free text / essay — answerable directly.
          let value = ruleValue(q)
          if (value == null) {
            if (q.label.toLowerCase().includes('cover letter')) { value = await generateCoverLetter(profile, jobInfo); results.cover_letter_generated = true }
            else if (q.required || q.tag === 'TEXTAREA' || /why|describe|tell us|experience/i.test(q.label)) value = await generateAnswer(q.label, profile, jobInfo)
          }
          if (value) apply.push({ q, value })
          else if (q.required) needsHuman.push(q.label)
          continue
        }
        const rv = ruleValue(q)
        if (rv != null) { apply.push({ q, value: rv }); continue }
        // Unrecognized dropdown: read the REAL options so the LLM picks a valid one.
        const options = q.isSelect ? q.nativeOptions : await readReactSelectOptions(page, q.id)
        if (options.length) llmQueue.push({ q, options })
        else if (TESTING_FILL_ANYTHING) apply.push({ q, value: 'Yes' }) // testing: try Yes → falls back to first option
        else if (q.required) needsHuman.push(q.label)
      }

      // One batched gpt-4o-mini call to choose among real options (null when unsure).
      if (llmQueue.length) {
        const facts = {
          name: autofill.name, role: profile.primary_role, career_stage: profile.career_stage,
          work_location: [autofill.city, autofill.state, autofill.user_country].filter(Boolean).join(', '),
          citizenship: autofill.visa_status || null, // explicit fact from the user's profile (not inferred)
          authorized_to_work: autofill.authorized_to_work, sponsorship_needed: autofill.sponsorship_needed,
          willing_to_relocate: autofill.willing_to_relocate, willing_to_travel: autofill.willing_to_travel,
          gender: autofill.gender, skills: (profile.proven_skills || []).slice(0, 10), industries: profile.industries,
        }
        const choices = await chooseFromOptions(
          llmQueue.map(x => ({ key: x.q.id, label: x.q.label, options: x.options })),
          facts
        )
        for (const x of llmQueue) {
          const c = choices[x.q.id]
          if (c && c.choice && (c.confidence === 'high' || TESTING_FILL_ANYTHING)) apply.push({ q: x.q, value: c.choice })
          else if (TESTING_FILL_ANYTHING) apply.push({ q: x.q, value: x.options[0] }) // testing: put anything
          else if (x.q.required) needsHuman.push(x.q.label) // unsure on a required Q → human
        }
      }

      // ── Apply every confident answer with the right mechanism for its type ──
      console.log(`  Answers: ${apply.length} to fill, ${needsHuman.length} need human`)
      for (const { q, value } of apply) {
        try {
          let ok = false
          if (q.isSelect) ok = await selectNative(page, q.id, value)
          else if (q.isCombobox || q.isMulti) ok = await fillReactSelect(page, q.id, value)
          else ok = await fillInput(page, `[id="${q.id}"]`, value)
          if (ok) results.fields_filled++
          else if (q.required && !TESTING_FILL_ANYTHING) needsHuman.push(q.label)
          console.log(`  Q: "${q.label.slice(0, 50)}" [${q.isSelect ? 'select' : q.isCombobox ? 'combo' : q.isMulti ? 'multi' : q.tag}]${q.required ? ' *' : ''} → "${String(value).slice(0, 30)}" ${ok ? '✓' : '✗'}`)
        } catch (err) {
          console.log(`    Apply error (${q.label.slice(0, 30)}): ${err.message}`)
          if (q.required && !TESTING_FILL_ANYTHING) needsHuman.push(q.label)
        }
      }

      // Required questions we couldn't safely answer → human hand-off (disabled in testing).
      results.needs_human = TESTING_FILL_ANYTHING ? [] : [...new Set(needsHuman)]
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