import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function safeJSON(text, fallback = {}) {
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try { return JSON.parse(match[0]) } catch {}
    }
    return fallback
  }
}

async function extractText(buffer) {
  try {
    const { extractText: extract } = await import('unpdf')
    const { text } = await extract(new Uint8Array(buffer), { mergePages: true })
    if (text && text.trim().length > 50) return text.trim()
  } catch {}
  return null
}

async function parseResume(rawText) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 3000,
    temperature: 0,
    messages: [{
      role: 'system',
      content: `You are an expert resume parser. Extract EVERY piece of information accurately.
Rules:
- Preserve exact numbers, metrics, percentages
- Keep company names exactly as written
- Extract all technologies, tools, frameworks mentioned
- Never summarize — keep specifics
- Return only valid JSON`
    }, {
      role: 'user',
      content: `Parse this resume completely. Return ONLY a JSON object:
{
  "name": "full name",
  "email": "email address",
  "phone": "phone number",
  "location": "city, state",
  "linkedin": "full linkedin url or null",
  "portfolio": "portfolio/github url or null",
  "summary": "professional summary if present or null",
  "experience": [
    {
      "title": "exact job title",
      "company": "exact company name",
      "location": "city, state or remote",
      "duration": "start date - end date",
      "current": false,
      "description": "full description",
      "achievements": ["specific achievement with exact numbers and metrics"],
      "technologies": ["tech used in this role"]
    }
  ],
  "education": [
    {
      "degree": "full degree name and major",
      "school": "school name",
      "location": "city, state",
      "graduation_year": "year or expected year",
      "gpa": "gpa if listed or null",
      "relevant_courses": ["course names"],
      "honors": "honors/awards if any or null"
    }
  ],
  "skills": {
    "technical": ["specific technical skills"],
    "tools": ["specific tools and software"],
    "languages": ["programming languages"],
    "frameworks": ["frameworks and libraries"],
    "soft": ["soft skills if listed"]
  },
  "projects": [
    {
      "name": "project name",
      "description": "what it does and impact",
      "technologies": ["tech used"],
      "link": "url if present or null",
      "metrics": "any metrics or results or null"
    }
  ],
  "certifications": ["certification name and issuer"],
  "awards": ["award name and context"],
  "languages_spoken": ["languages spoken"],
  "volunteer": ["volunteer work if listed"]
}

Resume:
${rawText.slice(0, 8000)}`
    }]
  })
  return safeJSON(completion.choices[0].message.content)
}

async function buildProfile(parsedData, rawText) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 2500,
    temperature: 0,
    messages: [{
      role: 'system',
      content: `You are a senior talent advisor building candidate DNA profiles for job matching.
Rules:
- primary_role must be the MOST REALISTIC title they can get RIGHT NOW
- proven_skills must be skills explicitly demonstrated in experience/projects — not just listed
- target_role_tags must come ONLY from the allowed list
- Be hyper-specific, never generic`
    }, {
      role: 'user',
      content: `Build a complete intelligence profile. Return ONLY a JSON object:
{
  "primary_role": "most realistic job title RIGHT NOW (e.g. 'Product Design Intern')",
  "suggested_roles": ["8-10 specific job titles ordered by fit"],
  "career_stage": "Student|New Grad|Junior|Mid-level|Senior",
  "years_of_experience": 0,
  "education_level": "High School|Associate's|Bachelor's|Master's|PhD|Bootcamp",
  "skill_groupings": ["15-20 specific skills they actually have"],
  "industries": ["4-6 industries based on actual experience"],
  "positioning": "4-5 sentences referencing SPECIFIC companies and EXACT metrics",
  "experience_highlights": ["8-10 achievements with company names and numbers"],
  "technical_depth": "high|medium|low",
  "top_companies": ["notable companies or schools on resume"],
  "target_companies": ["8-10 companies that would be a great fit"],
  "career_trajectory": "2-3 sentences describing career direction",
  "strengths": ["4-5 specific strengths"],

  "target_role_tags": [
    "ONLY tags from this list that match what they're targeting:
     product-design, ux-design, ui-design, visual-design, interaction-design,
     graphic-design, brand-design, motion-design, design-research,
     software-engineering, frontend-engineering, backend-engineering,
     full-stack-engineering, mobile-engineering, devops,
     machine-learning, ai-engineering, data-science, data-engineering,
     data-analysis, business-intelligence,
     product-management, program-management, project-management,
     investment-banking, financial-analysis, accounting, corporate-finance,
     private-equity, venture-capital, equity-research, risk-analysis,
     business-analysis, strategy, consulting, operations,
     supply-chain, logistics, procurement, business-development,
     marketing, growth, content, brand, digital-marketing, product-marketing,
     sales, sales-development, account-executive,
     clinical-research, healthcare, biotech, genomics, drug-discovery,
     cybersecurity, information-security,
     sustainability, climate-tech, energy,
     research, ux-research, legal, compliance,
     human-resources, talent-acquisition, other"
  ],

  "proven_skills": [
    "skills EXPLICITLY DEMONSTRATED in work experience or projects
     lowercase, specific (e.g. 'figma', 'user research', 'react.js', 'python')
     NOT just listed in skills section — must be used in real work"
  ],

  "learning_skills": [
    "skills mentioned in education or side projects but not proven in real work
     things they know but haven't used professionally yet"
  ]
}

Resume data:
${JSON.stringify(parsedData, null, 2)}

Raw text:
${rawText.slice(0, 3000)}`
    }]
  })

  const profile = safeJSON(completion.choices[0].message.content)

  if (!profile.primary_role) profile.primary_role = 'Professional'
  if (!profile.suggested_roles?.length) profile.suggested_roles = []
  if (!profile.skill_groupings?.length) profile.skill_groupings = []
  if (!profile.positioning) profile.positioning = ''
  if (!profile.experience_highlights?.length) profile.experience_highlights = []
  if (!profile.target_role_tags?.length) profile.target_role_tags = ['other']
  if (!profile.proven_skills?.length) profile.proven_skills = []
  if (!profile.learning_skills?.length) profile.learning_skills = []

  return profile
}

async function generateEmbedding(profile, parsedData) {
  const experienceText = (parsedData.experience || [])
    .map(e => `${e.title} at ${e.company}: ${(e.achievements || []).join('. ')}`)
    .join('\n')

  const projectText = (parsedData.projects || [])
    .map(p => `${p.name}: ${p.description} using ${(p.technologies || []).join(', ')}`)
    .join('\n')

  const educationText = (parsedData.education || [])
    .map(e => `${e.degree} from ${e.school} ${e.graduation_year || ''}`)
    .join('\n')

  const text = `
CANDIDATE PROFILE:
Primary Role: ${profile.primary_role}
Career Stage: ${profile.career_stage}
Target Roles: ${(profile.target_role_tags || []).join(', ')}
Proven Skills: ${(profile.proven_skills || []).join(', ')}
All Skills: ${(profile.skill_groupings || []).join(', ')}
Industries: ${(profile.industries || []).join(', ')}
Positioning: ${profile.positioning}
Key Achievements: ${(profile.experience_highlights || []).join(' | ')}
Experience: ${experienceText}
Projects: ${projectText}
Education: ${educationText}
  `.trim().replace(/\s+/g, ' ')

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
  })
  return response.data[0].embedding
}

export async function POST(request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('resume')
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const rawText = await extractText(buffer)
    if (!rawText) {
      return NextResponse.json({
        error: 'Could not extract text from PDF. Make sure it is a text-based PDF, not a scanned image.'
      }, { status: 400 })
    }

    if (rawText.trim().length < 100) {
      return NextResponse.json({ error: 'Resume appears to be too short or empty.' }, { status: 400 })
    }

    const parsedData = await parseResume(rawText)
    const profileData = await buildProfile(parsedData, rawText)
    const embedding = await generateEmbedding(profileData, parsedData)

    const serviceSupabase = createServiceSupabase()
    const fileName = `${user.id}/resume_${Date.now()}.pdf`

    await serviceSupabase.storage
      .from('resumes')
      .upload(fileName, buffer, { contentType: 'application/pdf', upsert: true })

    const [resumeRes, profileRes] = await Promise.all([
      serviceSupabase.from('parsed_resumes').upsert({
        user_id: user.id,
        raw_text: rawText,
        parsed_data: parsedData,
        file_path: fileName,
        file_name: file.name || 'resume.pdf',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }),

      serviceSupabase.from('intelligence_profiles').upsert({
        user_id: user.id,
        primary_role: profileData.primary_role,
        suggested_roles: profileData.suggested_roles,
        career_stage: profileData.career_stage,
        skill_groupings: profileData.skill_groupings,
        industries: profileData.industries,
        positioning: profileData.positioning,
        experience_highlights: profileData.experience_highlights,
        years_of_experience: profileData.years_of_experience || 0,
        education_level: profileData.education_level,
        target_role_tags: profileData.target_role_tags,
        proven_skills: profileData.proven_skills,
        learning_skills: profileData.learning_skills,
        embedding,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }),
    ])

    if (resumeRes.error) throw resumeRes.error
    if (profileRes.error) throw profileRes.error

    return NextResponse.json({ success: true, profile: profileData, parsed: parsedData })

  } catch (err) {
    console.error('Parse resume error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}