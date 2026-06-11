'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const JOB_TYPES = [
  { value: 'internship', label: 'Internship' },
  { value: 'coop', label: 'Co-op' },
  { value: 'fulltime', label: 'Full-time' },
  { value: 'contract', label: 'Contract' },
]
const WORK_STYLES = ['Remote', 'Hybrid', 'On-site']
const RELOCATE_OPTIONS = ['Yes', 'No', 'Open to it']
const VISA_STATUSES = ['U.S. Citizen', 'Permanent Resident', 'F-1', 'J-1', 'H-1B', 'Other']
const EEO_DECLINE = 'Prefer not to say'
const GENDERS = ['Male', 'Female', 'Non-binary', EEO_DECLINE]
const YESNO_DECLINE = ['Yes', 'No', EEO_DECLINE]

// ---- small field primitives ----
function Field({ label, children }) {
  return (
    <div>
      <label className="text-[12px] font-medium text-[#0A0A0A] block mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full h-10 px-3 text-[13px] border border-[#E5E5E5] rounded-xl outline-none focus:border-[#2D5219]" />
  )
}

function Select({ value, onChange, options, placeholder }) {
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value)}
      className="w-full h-10 px-3 text-[13px] border border-[#E5E5E5] rounded-xl outline-none focus:border-[#2D5219] bg-white">
      <option value="">{placeholder || 'Select...'}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function Chips({ options, selected, onToggle }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map(opt => {
        const val = opt.value ?? opt
        const label = opt.label ?? opt
        const active = (selected || []).includes(val)
        return (
          <button key={val} type="button" onClick={() => onToggle(val)}
            className={`h-8 px-3.5 rounded-xl text-[12px] font-medium border transition-all ${active ? 'bg-[#2D5219] text-white border-[#2D5219]' : 'bg-white text-[#0A0A0A] border-[#E5E5E5] hover:border-[#ADADAD]'}`}>
            {label}
          </button>
        )
      })}
    </div>
  )
}

function TagInput({ tags, onChange, placeholder }) {
  const [input, setInput] = useState('')
  const add = () => {
    const v = input.trim()
    if (!v || (tags || []).includes(v)) { setInput(''); return }
    onChange([...(tags || []), v])
    setInput('')
  }
  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="flex-1 h-9 px-3 text-[13px] border border-[#E5E5E5] rounded-xl outline-none focus:border-[#2D5219]" />
        <button type="button" onClick={add}
          className="h-9 px-4 bg-[#F5F4F0] text-[#0A0A0A] text-[13px] rounded-xl hover:bg-[#EDEDEB] border border-[#E5E5E5]">Add</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(tags || []).map(tag => (
          <span key={tag} className="flex items-center gap-1.5 h-7 px-3 bg-[#F4F9F0] text-[#2D5219] text-[12px] rounded-full border border-[#C8E0BC]">
            {tag}
            <button type="button" onClick={() => onChange(tags.filter(t => t !== tag))} className="hover:text-[#1F3A11]">✕</button>
          </span>
        ))}
      </div>
    </div>
  )
}

function SaveBar({ onSave, saving, savedAt }) {
  return (
    <div className="flex items-center gap-3 mt-6">
      <button onClick={onSave} disabled={saving}
        className="h-10 px-6 bg-[#2D5219] text-white text-[13px] font-medium rounded-xl hover:bg-[#3A6B22] disabled:opacity-50">
        {saving ? 'Saving...' : 'Save'}
      </button>
      {savedAt && <span className="text-[12px] text-[#2D5219]">Saved ✓</span>}
    </div>
  )
}

function Card({ title, subtitle, children }) {
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6">
      <h2 className="text-[15px] font-semibold text-[#0A0A0A]">{title}</h2>
      {subtitle && <p className="text-[12px] text-[#ADADAD] mt-0.5 mb-5">{subtitle}</p>}
      {!subtitle && <div className="mb-5" />}
      {children}
    </div>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)

  const [profile, setProfile] = useState({})
  const [autofill, setAutofill] = useState({})
  const [prefs, setPrefs] = useState({})

  const [savingKey, setSavingKey] = useState(null)
  const [savedKey, setSavedKey] = useState(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUserId(user.id)

      const [p, a, pr] = await Promise.all([
        supabase.from('intelligence_profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('autofill_data').select('*').eq('user_id', user.id).single(),
        supabase.from('preferences').select('*').eq('user_id', user.id).single(),
      ])
      setProfile(p.data || {})
      setAutofill(a.data || {})
      setPrefs(pr.data || {})
      setLoading(false)
    }
    load()
  }, [])

  const flashSaved = (key) => {
    setSavedKey(key)
    setTimeout(() => setSavedKey(k => (k === key ? null : k)), 2500)
  }

  const saveProfile = async () => {
    setSavingKey('profile')
    await supabase.from('intelligence_profiles').upsert({
      user_id: userId,
      primary_role: profile.primary_role,
      career_stage: profile.career_stage,
      suggested_roles: profile.suggested_roles || [],
      industries: profile.industries || [],
      positioning: profile.positioning,
    }, { onConflict: 'user_id' })
    setSavingKey(null)
    flashSaved('profile')
  }

  const saveAutofill = async () => {
    setSavingKey('autofill')
    await supabase.from('autofill_data').upsert({
      user_id: userId,
      name: autofill.name,
      phone: autofill.phone,
      linkedin_url: autofill.linkedin_url,
      portfolio_url: autofill.portfolio_url,
      address: autofill.address,
      city: autofill.city,
      state: autofill.state,
      zip: autofill.zip,
      authorized_to_work: autofill.authorized_to_work ?? null,
      sponsorship_needed: autofill.sponsorship_needed ?? null,
      pronouns: autofill.pronouns,
      gender: autofill.gender,
      ethnicity: autofill.ethnicity,
      disability_status: autofill.disability_status,
      veteran_status: autofill.veteran_status,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    setSavingKey(null)
    flashSaved('autofill')
  }

  const savePrefs = async () => {
    setSavingKey('prefs')
    await supabase.from('preferences').upsert({
      user_id: userId,
      job_types: prefs.job_types || [],
      work_style: prefs.work_style,
      open_to_relocate: prefs.open_to_relocate,
      preferred_locations: prefs.preferred_locations || [],
      visa_status: prefs.visa_status,
      visa_sub_type: prefs.visa_sub_type || [],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    setSavingKey(null)
    flashSaved('prefs')
  }

  const toggleJobType = (val) => {
    const cur = prefs.job_types || []
    setPrefs(p => ({ ...p, job_types: cur.includes(val) ? cur.filter(t => t !== val) : [...cur, val] }))
  }

  // boolean Yes/No/decline mapping for work-eligibility fields
  const boolToChoice = (b) => (b === true ? 'Yes' : b === false ? 'No' : '')
  const choiceToBool = (c) => (c === 'Yes' ? true : c === 'No' ? false : null)

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#E5E5E5" strokeWidth="3" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="#2D5219" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  )

  return (
    <div className="px-8 py-7">
      <div className="max-w-[720px] mx-auto space-y-5">

        <div>
          <h1 className="text-[22px] font-semibold text-[#0A0A0A] tracking-tight">Profile &amp; Preferences</h1>
          <p className="text-[13px] text-[#6B6B6B] mt-0.5">Keep this current — it powers your matches, autofill, and auto-pilot.</p>
        </div>

        {/* Career profile */}
        <Card title="Career profile" subtitle="Extracted from your resume. Edit anything that's off.">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Primary role">
                <TextInput value={profile.primary_role} onChange={v => setProfile(p => ({ ...p, primary_role: v }))} placeholder="e.g. Product Designer" />
              </Field>
              <Field label="Career stage">
                <TextInput value={profile.career_stage} onChange={v => setProfile(p => ({ ...p, career_stage: v }))} placeholder="e.g. New grad" />
              </Field>
            </div>
            <Field label="Suggested roles">
              <TagInput tags={profile.suggested_roles} onChange={v => setProfile(p => ({ ...p, suggested_roles: v }))} placeholder="Add a role you'd target..." />
            </Field>
            <Field label="Industries">
              <TagInput tags={profile.industries} onChange={v => setProfile(p => ({ ...p, industries: v }))} placeholder="Add an industry..." />
            </Field>
            <Field label="Positioning">
              <textarea value={profile.positioning ?? ''} onChange={e => setProfile(p => ({ ...p, positioning: e.target.value }))} rows={3}
                placeholder="A short summary of how you position yourself..."
                className="w-full px-3 py-2.5 text-[13px] border border-[#E5E5E5] rounded-xl outline-none focus:border-[#2D5219] resize-none leading-relaxed" />
            </Field>
          </div>
          <SaveBar onSave={saveProfile} saving={savingKey === 'profile'} savedAt={savedKey === 'profile'} />
        </Card>

        {/* Personal & autofill */}
        <Card title="Personal & autofill info" subtitle="Used to fill applications automatically.">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full name"><TextInput value={autofill.name} onChange={v => setAutofill(a => ({ ...a, name: v }))} placeholder="Jordan Lee" /></Field>
              <Field label="Phone"><TextInput value={autofill.phone} onChange={v => setAutofill(a => ({ ...a, phone: v }))} placeholder="(555) 123-4567" /></Field>
              <Field label="LinkedIn URL"><TextInput value={autofill.linkedin_url} onChange={v => setAutofill(a => ({ ...a, linkedin_url: v }))} placeholder="https://linkedin.com/in/..." /></Field>
              <Field label="Portfolio URL"><TextInput value={autofill.portfolio_url} onChange={v => setAutofill(a => ({ ...a, portfolio_url: v }))} placeholder="https://..." /></Field>
            </div>
            <Field label="Street address"><TextInput value={autofill.address} onChange={v => setAutofill(a => ({ ...a, address: v }))} placeholder="123 Main St" /></Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="City"><TextInput value={autofill.city} onChange={v => setAutofill(a => ({ ...a, city: v }))} placeholder="San Francisco" /></Field>
              <Field label="State"><TextInput value={autofill.state} onChange={v => setAutofill(a => ({ ...a, state: v }))} placeholder="CA" /></Field>
              <Field label="ZIP"><TextInput value={autofill.zip} onChange={v => setAutofill(a => ({ ...a, zip: v }))} placeholder="94105" /></Field>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#F0F0F0]">
              <Field label="Authorized to work in the U.S.?">
                <Select value={boolToChoice(autofill.authorized_to_work)} onChange={v => setAutofill(a => ({ ...a, authorized_to_work: choiceToBool(v) }))} options={['Yes', 'No']} />
              </Field>
              <Field label="Will you need sponsorship?">
                <Select value={boolToChoice(autofill.sponsorship_needed)} onChange={v => setAutofill(a => ({ ...a, sponsorship_needed: choiceToBool(v) }))} options={['Yes', 'No']} />
              </Field>
            </div>

            <p className="text-[11px] font-semibold text-[#ADADAD] uppercase tracking-widest pt-2">Voluntary EEO (optional)</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Pronouns"><TextInput value={autofill.pronouns} onChange={v => setAutofill(a => ({ ...a, pronouns: v }))} placeholder="she/her, he/him, they/them" /></Field>
              <Field label="Gender"><Select value={autofill.gender} onChange={v => setAutofill(a => ({ ...a, gender: v }))} options={GENDERS} /></Field>
              <Field label="Race / ethnicity"><TextInput value={autofill.ethnicity} onChange={v => setAutofill(a => ({ ...a, ethnicity: v }))} placeholder="Optional" /></Field>
              <Field label="Disability status"><Select value={autofill.disability_status} onChange={v => setAutofill(a => ({ ...a, disability_status: v }))} options={YESNO_DECLINE} /></Field>
              <Field label="Veteran status"><Select value={autofill.veteran_status} onChange={v => setAutofill(a => ({ ...a, veteran_status: v }))} options={YESNO_DECLINE} /></Field>
            </div>
          </div>
          <SaveBar onSave={saveAutofill} saving={savingKey === 'autofill'} savedAt={savedKey === 'autofill'} />
        </Card>

        {/* Job preferences */}
        <Card title="Job preferences" subtitle="What auto-pilot and matching should target.">
          <div className="space-y-5">
            <Field label="Job types">
              <Chips options={JOB_TYPES} selected={prefs.job_types} onToggle={toggleJobType} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Work style"><Select value={prefs.work_style} onChange={v => setPrefs(p => ({ ...p, work_style: v }))} options={WORK_STYLES} /></Field>
              <Field label="Open to relocation"><Select value={prefs.open_to_relocate} onChange={v => setPrefs(p => ({ ...p, open_to_relocate: v }))} options={RELOCATE_OPTIONS} /></Field>
            </div>
            <Field label="Preferred locations">
              <TagInput tags={prefs.preferred_locations} onChange={v => setPrefs(p => ({ ...p, preferred_locations: v }))} placeholder="Add a city or 'Remote'..." />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Visa status"><Select value={prefs.visa_status} onChange={v => setPrefs(p => ({ ...p, visa_status: v }))} options={VISA_STATUSES} /></Field>
              <Field label="Visa sub-type">
                <TagInput tags={prefs.visa_sub_type} onChange={v => setPrefs(p => ({ ...p, visa_sub_type: v }))} placeholder="OPT, STEM-OPT, CPT..." />
              </Field>
            </div>
          </div>
          <SaveBar onSave={savePrefs} saving={savingKey === 'prefs'} savedAt={savedKey === 'prefs'} />
        </Card>

      </div>
    </div>
  )
}
