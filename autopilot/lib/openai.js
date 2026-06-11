import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function generateAnswer(question, profile, jobInfo) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 200,
      temperature: 0.7,
      messages: [{
        role: 'system',
        content: `You are writing job application answers for a candidate.
Rules:
- Be specific — reference real experience and achievements
- Never use: "passionate", "excited", "leverage", "synergy", "hardworking"
- Sound human, not like AI
- Keep answers concise — 2-4 sentences max unless it's a major essay question
- Always answer in first person`
      }, {
        role: 'user',
        content: `Answer this application question for the candidate.

QUESTION: ${question}

CANDIDATE PROFILE:
Name: ${profile.name}
Role: ${profile.primary_role}
Career Stage: ${profile.career_stage}
Proven Skills: ${(profile.proven_skills || []).join(', ')}
Key Achievements: ${(profile.experience_highlights || []).slice(0, 3).join(' | ')}
Industries: ${(profile.industries || []).join(', ')}

JOB:
Title: ${jobInfo.title} at ${jobInfo.company}

Write a specific, authentic answer. No filler words.`
      }]
    })
    return completion.choices[0].message.content.trim()
  } catch {
    return ''
  }
}

// Batched chooser: for each dropdown question, pick EXACTLY one of its real
// options that fits the candidate, or null if it can't be determined from the
// facts. Used as the fallback after rule-based answers. One gpt-4o-mini call.
//   questions: [{ key, label, options: string[] }]
//   facts:     plain object of known candidate facts
// returns: { [key]: { choice: string|null, confidence: 'high'|'low' } }
export async function chooseFromOptions(questions, facts) {
  if (!questions.length) return {}
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'system',
        content: `You fill job-application dropdowns for a candidate. For each question, choose EXACTLY ONE option from its provided "options" list — copy the option text verbatim.
- Only answer when the candidate FACTS clearly support it.
- For legal / visa / citizenship / nationality / security-clearance / criminal-history / disability questions, answer ONLY if the facts EXPLICITLY state it; otherwise return choice:null.
- NEVER infer nationality, citizenship, or country of origin from the candidate's name, location, university, or skills. If nationality/citizenship is not an explicit fact, return choice:null with confidence:"low".
- LOW-STAKES questions (e.g. "how/where did you hear about this role", referral source, marketing/how-found-us) are fine to answer with confidence:"high" — pick a sensible option such as LinkedIn, Online, Job board, Company website, or Other.
- If you are not confident, return choice:null and confidence:"low". Never invent an option that isn't in the list. Return only JSON.`
      }, {
        role: 'user',
        content: `CANDIDATE FACTS:
${JSON.stringify(facts, null, 2)}

QUESTIONS:
${JSON.stringify(questions, null, 2)}

Return JSON: {"answers":[{"key":"<key>","choice":"<exact option text or null>","confidence":"high|low"}]}`
      }]
    })
    const parsed = JSON.parse(completion.choices[0].message.content)
    const map = {}
    for (const a of parsed.answers || []) {
      map[String(a.key)] = { choice: a.choice ?? null, confidence: a.confidence === 'high' ? 'high' : 'low' }
    }
    return map
  } catch (err) {
    console.log('  chooseFromOptions failed:', err.message)
    return {}
  }
}

export async function generateCoverLetter(profile, jobInfo) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 400,
      temperature: 0.7,
      messages: [{
        role: 'system',
        content: `You write cover letters that sound human and specific.
Rules:
- 180-220 words max
- Reference the specific company by name
- Reference specific skills and achievements from the resume
- Never use: "passionate", "excited", "leverage", "I am writing to apply"
- Start with something other than "I"
- Sound like a real person wrote it`
      }, {
        role: 'user',
        content: `Write a cover letter for this application.

CANDIDATE:
Name: ${profile.name}
Role: ${profile.primary_role}
Proven Skills: ${(profile.proven_skills || []).join(', ')}
Key Achievements: ${(profile.experience_highlights || []).slice(0, 4).join(' | ')}
Positioning: ${profile.positioning}

JOB:
Title: ${jobInfo.title}
Company: ${jobInfo.company}
Description: ${(jobInfo.description || '').slice(0, 800)}

Write the cover letter. No subject line, no date, no address. Just the letter body.`
      }]
    })
    return completion.choices[0].message.content.trim()
  } catch {
    return ''
  }
}