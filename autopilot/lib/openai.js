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