import { extractText } from 'unpdf'
import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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

    // Extract text from PDF
    let rawText = ''
    try {
      const { text } = await extractText(new Uint8Array(buffer), { mergePages: true })
      rawText = text
    } catch (pdfErr) {
      console.error('PDF parse error:', pdfErr)
      return NextResponse.json({ error: 'Could not read PDF.' }, { status: 400 })
    }

    if (!rawText || rawText.trim().length < 50) {
      return NextResponse.json({ error: 'PDF appears empty or scanned. Please upload a text-based PDF.' }, { status: 400 })
    }

    // Parse resume with GPT-4o
    const parseCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2000,
      messages: [{
        role: 'system',
        content: 'You are an expert resume parser. Extract all information accurately. Preserve specific numbers, metrics, and details. Return only valid JSON.'
      }, {
        role: 'user',
        content: `Extract all information from this resume. Return ONLY a JSON object:
{
  "name": "full name",
  "email": "email",
  "phone": "phone number",
  "location": "city, state",
  "linkedin": "linkedin url if present",
  "portfolio": "portfolio/website url if present",
  "summary": "summary if present",
  "experience": [
    {
      "title": "job title",
      "company": "company name",
      "duration": "start - end",
      "description": "description preserving metrics",
      "achievements": ["specific achievement with numbers"]
    }
  ],
  "education": [
    {
      "degree": "degree and major",
      "school": "school name",
      "year": "graduation year",
      "gpa": "gpa if listed"
    }
  ],
  "skills": ["skill1", "skill2"],
  "projects": [
    {
      "name": "project name",
      "description": "what it does",
      "tech": ["tech used"]
    }
  ],
  "certifications": [],
  "awards": []
}

Resume text:
${rawText.slice(0, 6000)}`
      }]
    })

    let parsedData = {}
    try {
      const raw = parseCompletion.choices[0].message.content.replace(/```json|```/g, '').trim()
      parsedData = JSON.parse(raw)
    } catch { parsedData = {} }

    // Build intelligence profile
    const profileCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1500,
      messages: [{
        role: 'system',
        content: 'You are a senior talent advisor. Create specific, accurate candidate profiles for job matching. Be specific to their actual background — never generic.'
      }, {
        role: 'user',
        content: `Create a detailed intelligence profile. Return ONLY a JSON object:
{
  "primary_role": "most realistic job title they can get RIGHT NOW based on experience",
  "suggested_roles": ["6-8 specific job titles ordered by fit"],
  "career_stage": "Student|New Grad|Junior|Mid-level|Senior",
  "skill_groupings": ["12-18 specific skills they actually have"],
  "industries": ["3-6 industries based on their background"],
  "positioning": "3-4 sentence pitch referencing specific achievements and numbers",
  "experience_highlights": ["6-8 most impressive achievements with metrics"],
  "years_of_experience": 0,
  "education_level": "High School|Associate's|Bachelor's|Master's|PhD|Bootcamp"
}

Resume data:
${JSON.stringify(parsedData, null, 2)}`
      }]
    })

    let profileData = {}
    try {
      const raw = profileCompletion.choices[0].message.content.replace(/```json|```/g, '').trim()
      profileData = JSON.parse(raw)
    } catch { profileData = {} }

    // Generate embedding
    const embeddingText = `
      ${profileData.primary_role || ''}
      ${(profileData.suggested_roles || []).join(', ')}
      ${(profileData.skill_groupings || []).join(', ')}
      ${(profileData.industries || []).join(', ')}
      ${profileData.positioning || ''}
      ${(profileData.experience_highlights || []).join('. ')}
      ${(parsedData.experience || []).map(e => `${e.title} at ${e.company}`).join(', ')}
    `.trim().replace(/\s+/g, ' ')

    const embeddingRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: embeddingText,
    })
    const embedding = embeddingRes.data[0].embedding

    // Upload resume to Supabase Storage
    const serviceSupabase = createServiceSupabase()
    const fileName = `${user.id}/resume_${Date.now()}.pdf`
    await serviceSupabase.storage.from('resumes').upload(fileName, buffer, {
      contentType: 'application/pdf',
      upsert: true
    })

    // Save to database
    await Promise.all([
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

    return NextResponse.json({ success: true, profile: profileData })
  } catch (err) {
    console.error('Parse resume error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}