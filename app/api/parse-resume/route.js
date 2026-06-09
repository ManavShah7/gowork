

import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ─── SAFE JSON PARSE ─────────────────────────────────────────
function safeJSON(text, fallback = {}) {
  try {
    const cleaned = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    return JSON.parse(cleaned)
  } catch {
    // Try extracting JSON from text
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try { return JSON.parse(match[0]) } catch {}
    }
    return fallback
  }
}

// ─── EXTRACT TEXT ────────────────────────────────────────────
async function extractText(buffer) {
  try {
    const { extractText } = await import('unpdf')
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true })
    if (text && text.trim().length > 50) return text.trim()
  } catch {}

 

// ─── PARSE RESUME ────────────────────────────────────────────
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
      "achievements": [
        "specific achievement with exact numbers and metrics"
      ],
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
  "publications": ["publication if any"],
  "languages_spoken": ["languages spoken"],
  "volunteer": ["volunteer work if listed"]
}

Resume:
${rawText.slice(0, 8000)}`
    }]
  })

  return safeJSON(completion.choices[0].message.content)
}

// ─── BUILD INTELLIGENCE PROFILE ──────────────────────────────
async function buildProfile(parsedData, rawText) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 2000,
    temperature: 0,
    messages: [{
      role: 'system',
      content: `You are a senior talent advisor at a top recruitment firm.
You create hyper-specific candidate profiles used for semantic job matching.

Rules:
- primary_role must be the MOST REALISTIC title they can get RIGHT NOW
- Reference their ACTUAL companies, numbers, and achievements
- skill_groupings must be specific tools/skills, not categories
- positioning must mention real company names and specific metrics
- suggested_roles must be realistic given their actual background
- Never be generic — always be specific to this person`
    }, {
      role: 'user',
      content: `Build a detailed intelligence profile for job matching.
Return ONLY a JSON object:
{
  "primary_role": "most realistic job title RIGHT NOW (e.g. 'Product Design Intern', 'Junior Software Engineer', 'Financial Analyst')",
  "suggested_roles": [
    "8-10 specific job titles ordered by fit, realistic for their level"
  ],
  "career_stage": "Student|New Grad|Junior|Mid-level|Senior",
  "years_of_experience": 0,
  "education_level": "High School|Associate's|Bachelor's|Master's|PhD|Bootcamp",
  "skill_groupings": [
    "15-20 specific skills, tools, technologies they actually have — be specific (e.g. 'Figma' not 'design tools', 'React.js' not 'frontend')"
  ],
  "industries": [
    "4-6 industries based on their actual experience and education"
  ],
  "positioning": "4-5 sentences — reference SPECIFIC companies they worked at, EXACT metrics from their experience, and what makes them stand out. Sound like a real recruiter pitch.",
  "experience_highlights": [
    "8-10 most impressive achievements — include company names, exact numbers, specific outcomes"
  ],
  "technical_depth": "high|medium|low",
  "top_companies": [
    "notable companies or schools on their resume"
  ],
  "target_companies": [
    "8-10 specific companies that would be a great fit based on their background"
  ],
  "career_trajectory": "2-3 sentences describing their career direction and goals based on resume",
  "red_flags": [],
  "strengths": [
    "4-5 specific strengths based on their actual experience"
  ]
}

Resume data:
${JSON.stringify(parsedData, null, 2)}

Raw resume text (for additional context):
${rawText.slice(0, 3000)}`
    }]
  })

  const profile = safeJSON(completion.choices[0].message.content)

  // Validate critical fields
  if (!profile.primary_role) profile.primary_role = 'Professional'
  if (!profile.suggested_roles?.length) profile.suggested_roles = []
  if (!profile.skill_groupings?.length) profile.skill_groupings = []
  if (!profile.positioning) profile.positioning = ''
  if (!profile.experience_highlights?.length) profile.experience_highlights = []

  return profile
}

// ─── GENERATE EMBEDDING ──────────────────────────────────────
async function generateEmbedding(profile, parsedData) {
  // Rich, structured text for maximum semantic accuracy
  const experienceText = (parsedData.experience || [])
    .map(e => `${e.title} at ${e.company}: ${(e.achievements || []).join('. ')}`)
    .join('\n')

  const projectText = (parsedData.projects || [])
    .map(p => `${p.name}: ${p.description} using ${(p.technologies || []).join(', ')}`)
    .join('\n')

  const educationText = (parsedData.education || [])
    .map(e => `${e.degree} from ${e.school} ${e.graduation_year || ''}`)
    .join('\n')

  const skillsText = [
    ...(parsedData.skills?.technical || []),
    ...(parsedData.skills?.tools || []),
    ...(parsedData.skills?.languages || []),
    ...(parsedData.skills?.frameworks || []),
  ].join(', ')

  const text = `
CANDIDATE PROFILE:
Name: ${parsedData.name || ''}
Primary Role: ${profile.primary_role}
Career Stage: ${profile.career_stage}
Years of Experience: ${profile.years_of_experience}
Technical Depth: ${profile.technical_depth}

TARGET ROLES:
${(profile.suggested_roles || []).join('\n')}

SKILLS AND TOOLS:
${(profile.skill_groupings || []).join(', ')}

RAW SKILLS:
${skillsText}

INDUSTRIES:
${(profile.industries || []).join(', ')}

POSITIONING:
${profile.positioning}

KEY ACHIEVEMENTS:
${(profile.experience_highlights || []).join('\n')}

WORK EXPERIENCE:
${experienceText}

PROJECTS:
${projectText}

EDUCATION:
${educationText}

TOP COMPANIES:
${(profile.top_companies || []).join(', ')}

CAREER TRAJECTORY:
${profile.career_trajectory || ''}

STRENGTHS:
${(profile.strengths || []).join(', ')}
  `.trim().replace(/\s+/g, ' ')

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
  })

  return response.data[0].embedding
}

// ─── MAIN HANDLER ─────────────────────────────────────────────
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

    // Step 1 — Extract text
    const rawText = await extractText(buffer)
    if (!rawText) {
      return NextResponse.json({
        error: 'Could not extract text from PDF. Make sure it is a text-based PDF, not a scanned image.'
      }, { status: 400 })
    }

    if (rawText.trim().length < 100) {
      return NextResponse.json({
        error: 'Resume appears to be too short or empty.'
      }, { status: 400 })
    }

    // Step 2 — Parse resume
    const parsedData = await parseResume(rawText)

    // Step 3 — Build intelligence profile
    const profileData = await buildProfile(parsedData, rawText)

    // Step 4 — Generate embedding
    const embedding = await generateEmbedding(profileData, parsedData)

    // Step 5 — Upload resume to storage
    const serviceSupabase = createServiceSupabase()
    const fileName = `${user.id}/resume_${Date.now()}.pdf`

    await serviceSupabase.storage
      .from('resumes')
      .upload(fileName, buffer, {
        contentType: 'application/pdf',
        upsert: true
      })

    // Step 6 — Save everything in parallel
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
        embedding,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }),
    ])

    if (resumeRes.error) throw resumeRes.error
    if (profileRes.error) throw profileRes.error

    return NextResponse.json({
      success: true,
      profile: profileData,
      parsed: parsedData,
    })

  } catch (err) {
    console.error('Parse resume error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}