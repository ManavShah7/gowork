// Re-embed all intelligence_profiles and all direct-apply classified job_listings
// on the new clean embedding scheme (lib/matching.js §6).
//
// WHY: the matching rebuild changed how user and job embeddings are built. Old
// rows hold vectors from the previous scheme, which are NOT comparable to new
// ones — cosine similarity is only valid when BOTH sides use the same scheme.
// Run this once after deploying the new pipeline (and after running
// supabase/match_jobs.sql).
//
// Usage (from repo root):  node scripts/reembed.mjs
// Needs .env.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY.

import { readFileSync } from 'fs'

// --- load .env.local into process.env BEFORE importing lib/matching.js
// (that module builds an OpenAI client from process.env at import time) ---
const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const need = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'OPENAI_API_KEY']
const missing = need.filter(k => !process.env[k])
if (missing.length) {
  console.error('Missing env vars in .env.local:', missing.join(', '))
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
const { embed, buildUserEmbeddingText, buildJobEmbeddingText } = await import('../lib/matching.js')

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const OpenAI = (await import('openai')).default
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ── 1. Re-embed every user profile ──────────────────────────────────────────
const { data: profiles, error: pErr } = await sb
  .from('intelligence_profiles')
  .select('user_id, primary_role, target_role_tags, career_stage, proven_skills, experience_highlights, industries')
if (pErr) { console.error('profiles fetch failed:', pErr.message); process.exit(1) }

console.log(`Re-embedding ${profiles.length} profile(s)...`)
for (const p of profiles) {
  const emb = await embed(buildUserEmbeddingText(p))
  const { error } = await sb.from('intelligence_profiles').update({ embedding: emb }).eq('user_id', p.user_id)
  console.log(`  ${p.primary_role || '(no role)'} ${p.user_id.slice(0, 8)} ${error ? 'ERR: ' + error.message : 'ok'}`)
}

// ── 2. Re-embed the direct-apply classified job pool (the retrieval universe) ─
let jobs = [], from = 0
while (true) {
  const { data, error } = await sb
    .from('job_listings')
    .select('job_id, title, company, description, job_type_clean, seniority_level, required_skills, role_tags')
    .eq('classified', true)
    .eq('is_direct_apply', true)
    .range(from, from + 999)
  if (error) { console.error('jobs fetch failed:', error.message); process.exit(1) }
  jobs.push(...data)
  if (data.length < 1000) break
  from += 1000
}

console.log(`\nRe-embedding ${jobs.length} direct-apply job(s)...`)
let done = 0
for (let i = 0; i < jobs.length; i += 100) {
  const batch = jobs.slice(i, i + 100)
  // The job row carries both job fields and classification fields, so pass it as both.
  const inputs = batch.map(j => buildJobEmbeddingText(j, j))
  const resp = await openai.embeddings.create({ model: 'text-embedding-3-small', input: inputs })
  await Promise.all(batch.map((j, k) =>
    sb.from('job_listings').update({ embedding: resp.data[k].embedding }).eq('job_id', j.job_id)
  ))
  done += batch.length
  process.stdout.write(`\r  re-embedded ${done}/${jobs.length}`)
}

console.log('\n\nDone. Profiles and the direct-apply job pool are now on the same scheme.')
console.log('Next: run /api/run-matching?user_id=<uuid>, then check /api/debug + apply_queue.')
