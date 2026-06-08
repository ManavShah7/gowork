'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase'

function Section({ title, subtitle, children }) {
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 space-y-4">
      <div>
        <p className="text-[15px] font-semibold text-[#0A0A0A]">{title}</p>
        {subtitle && <p className="text-[12px] text-[#9B9B9B] mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-[12px] font-medium text-[#6B6B6B] block mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-10 px-3 text-[13px] text-[#0A0A0A] border border-[#E5E5E5] rounded-xl outline-none focus:border-[#2D5219] transition-colors placeholder:text-[#DADADA] bg-white"
    />
  )
}

function Pill({ label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 px-4 rounded-xl text-[12px] font-medium border transition-all ${
        selected
          ? 'bg-[#2D5219] text-white border-[#2D5219]'
          : 'bg-white text-[#0A0A0A] border-[#E5E5E5] hover:border-[#ADADAD]'
      }`}
    >
      {label}
    </button>
  )
}

export default function DetailsPage() {
  const router = useRouter()
  const supabase = createBrowserSupabase()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Contact
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [portfolio, setPortfolio] = useState('')

  // Address
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')

  // Work auth
  const [authorized, setAuthorized] = useState(true)
  const [sponsorship, setSponsorship] = useState(false)
  const [visaStatus, setVisaStatus] = useState('')

  // Job preferences
  const [jobTypes, setJobTypes] = useState(['internship'])
  const [workStyle, setWorkStyle] = useState('')
  const [locations, setLocations] = useState('')

  // EEO
  const [pronouns, setPronouns] = useState('')
  const [gender, setGender] = useState('')
  const [sexuality, setSexuality] = useState('')
  const [ethnicity, setEthnicity] = useState('')
  const [disability, setDisability] = useState('')
  const [veteran, setVeteran] = useState('')

  useEffect(() => {
    const prefill = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setName(user.user_metadata?.full_name || '')

      const { data: resume } = await supabase
        .from('parsed_resumes')
        .select('parsed_data')
        .eq('user_id', user.id)
        .single()

      if (resume?.parsed_data) {
        const d = resume.parsed_data
        if (d.phone) setPhone(d.phone)
        if (d.linkedin) setLinkedin(d.linkedin)
        if (d.portfolio) setPortfolio(d.portfolio)
        if (d.location) {
          const parts = d.location.split(',')
          if (parts[0]) setCity(parts[0].trim())
          if (parts[1]) setState(parts[1].trim())
        }
      }
    }
    prefill()
  }, [])

  const toggleJobType = (type) => {
    setJobTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const handleSave = async () => {
    if (!name.trim()) { setError('Enter your name'); return }
    if (!city.trim()) { setError('Enter your city'); return }

    setSaving(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const preferredLocations = locations
      .split(',')
      .map(l => l.trim())
      .filter(Boolean)

    const [autofillRes, prefsRes] = await Promise.all([
      supabase.from('autofill_data').upsert({
        user_id: user.id,
        name,
        phone,
        linkedin_url: linkedin,
        portfolio_url: portfolio,
        address,
        city,
        state,
        zip,
        authorized_to_work: authorized,
        sponsorship_needed: sponsorship,
        visa_status: visaStatus,
        gender,
        ethnicity,
        disability_status: disability,
        veteran_status: veteran,
        pronouns,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }),

      supabase.from('preferences').upsert({
        user_id: user.id,
        job_types: jobTypes,
        work_style: workStyle,
        preferred_locations: preferredLocations,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }),
    ])

    if (autofillRes.error) { setError(autofillRes.error.message); setSaving(false); return }
    if (prefsRes.error) { setError(prefsRes.error.message); setSaving(false); return }

    router.push('/onboarding/autopilot')
  }

  return (
    <div className="min-h-screen bg-[#F7F6F2] flex flex-col items-center px-4 py-12">

      {/* Steps */}
      <div className="flex items-center justify-center gap-2 mb-10">
        {['Resume', 'Details', 'Autopilot'].map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 ${i === 1 ? 'opacity-100' : 'opacity-30'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-medium ${
                i < 2 ? 'bg-[#2D5219] text-white' : 'bg-[#E5E5E5] text-[#888]'
              }`}>
                {i === 0 ? '✓' : i + 1}
              </div>
              <span className="text-[13px] text-[#0A0A0A]">{step}</span>
            </div>
            {i < 2 && <div className="w-8 h-px bg-[#E5E5E5]" />}
          </div>
        ))}
      </div>

      <div className="text-center mb-8 max-w-[480px]">
        <h1 className="text-[28px] font-semibold text-[#0A0A0A] tracking-tight mb-2">
          Fill this in once.
        </h1>
        <p className="text-[14px] text-[#6B6B6B] leading-relaxed">
          GoWork uses this to fill every job application automatically — from your name to your EEO data. You never type this again.
        </p>
      </div>

      <div className="w-full max-w-[600px] space-y-4">

        {/* Contact */}
        <Section title="Contact" subtitle="Basic fields on every application">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full name">
              <Input value={name} onChange={setName} placeholder="Manav Shah" />
            </Field>
            <Field label="Phone">
              <Input value={phone} onChange={setPhone} placeholder="+1 (555) 000-0000" type="tel" />
            </Field>
          </div>
          <Field label="LinkedIn URL">
            <Input value={linkedin} onChange={setLinkedin} placeholder="linkedin.com/in/yourname" />
          </Field>
          <Field label="Portfolio / Website">
            <Input value={portfolio} onChange={setPortfolio} placeholder="yourportfolio.com" />
          </Field>
        </Section>

        {/* Address */}
        <Section title="Location" subtitle="Used for address and location fields">
          <Field label="Street address">
            <Input value={address} onChange={setAddress} placeholder="123 Main St" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Field label="City">
                <Input value={city} onChange={setCity} placeholder="Boston" />
              </Field>
            </div>
            <Field label="State">
              <Input value={state} onChange={setState} placeholder="MA" />
            </Field>
            <Field label="ZIP">
              <Input value={zip} onChange={setZip} placeholder="02101" />
            </Field>
          </div>
        </Section>

        {/* Work auth */}
        <Section title="Work authorization" subtitle="Answered automatically on every application">
          <Field label="Authorized to work in the US?">
            <div className="flex gap-2">
              <Pill label="Yes" selected={authorized === true} onClick={() => setAuthorized(true)} />
              <Pill label="No" selected={authorized === false} onClick={() => setAuthorized(false)} />
            </div>
          </Field>
          <Field label="Require sponsorship now or in the future?">
            <div className="flex gap-2">
              <Pill label="Yes" selected={sponsorship === true} onClick={() => setSponsorship(true)} />
              <Pill label="No" selected={sponsorship === false} onClick={() => setSponsorship(false)} />
            </div>
          </Field>
          <Field label="Visa status">
            <div className="flex gap-2 flex-wrap">
              {['US Citizen', 'Green Card', 'F-1/OPT', 'H-1B', 'Other'].map(v => (
                <Pill key={v} label={v} selected={visaStatus === v} onClick={() => setVisaStatus(visaStatus === v ? '' : v)} />
              ))}
            </div>
          </Field>
        </Section>

        {/* Job preferences */}
        <Section title="Job preferences" subtitle="GoWork only applies to jobs that match these">
          <Field label="Job types">
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'internship', label: 'Internship' },
                { value: 'fulltime', label: 'Full-time' },
                { value: 'coop', label: 'Co-op' },
                { value: 'contract', label: 'Contract' },
              ].map(opt => (
                <Pill
                  key={opt.value}
                  label={opt.label}
                  selected={jobTypes.includes(opt.value)}
                  onClick={() => toggleJobType(opt.value)}
                />
              ))}
            </div>
          </Field>
          <Field label="Work style">
            <div className="flex gap-2 flex-wrap">
              {['Remote', 'Hybrid', 'On-site', 'No preference'].map(s => (
                <Pill key={s} label={s} selected={workStyle === s} onClick={() => setWorkStyle(workStyle === s ? '' : s)} />
              ))}
            </div>
          </Field>
          <Field label="Where are you open to working? (comma separated)">
            <Input value={locations} onChange={setLocations} placeholder="Boston, New York, Remote" />
          </Field>
        </Section>

        {/* EEO */}
        <Section
          title="Diversity info"
          subtitle="Optional — only used for voluntary EEO sections. Never used to filter your opportunities. Stored securely."
        >
          <Field label="Pronouns">
            <div className="flex gap-2 flex-wrap">
              {['He/Him', 'She/Her', 'They/Them', 'Ze/Zir', 'Prefer not to say'].map(p => (
                <Pill key={p} label={p} selected={pronouns === p} onClick={() => setPronouns(pronouns === p ? '' : p)} />
              ))}
            </div>
          </Field>
          <Field label="Gender">
            <div className="flex gap-2 flex-wrap">
              {['Male', 'Female', 'Non-binary', 'Transgender', 'Prefer not to say'].map(g => (
                <Pill key={g} label={g} selected={gender === g} onClick={() => setGender(gender === g ? '' : g)} />
              ))}
            </div>
          </Field>
          <Field label="Sexual orientation">
            <div className="flex gap-2 flex-wrap">
              {['Heterosexual', 'Gay or Lesbian', 'Bisexual', 'Prefer not to say'].map(s => (
                <Pill key={s} label={s} selected={sexuality === s} onClick={() => setSexuality(sexuality === s ? '' : s)} />
              ))}
            </div>
          </Field>
          <Field label="Race / Ethnicity">
            <div className="flex gap-2 flex-wrap">
              {[
                'Hispanic or Latino',
                'White',
                'Black or African American',
                'Asian',
                'Native American',
                'Pacific Islander',
                'Two or more races',
                'Prefer not to say',
              ].map(e => (
                <Pill key={e} label={e} selected={ethnicity === e} onClick={() => setEthnicity(ethnicity === e ? '' : e)} />
              ))}
            </div>
          </Field>
          <Field label="Disability status">
            <div className="flex gap-2 flex-wrap">
              {['Yes, I have a disability', 'No', 'Prefer not to say'].map(d => (
                <Pill key={d} label={d} selected={disability === d} onClick={() => setDisability(disability === d ? '' : d)} />
              ))}
            </div>
          </Field>
          <Field label="Veteran status">
            <div className="flex gap-2 flex-wrap">
              {['Veteran', 'Active duty', 'Not a veteran', 'Prefer not to say'].map(v => (
                <Pill key={v} label={v} selected={veteran === v} onClick={() => setVeteran(veteran === v ? '' : v)} />
              ))}
            </div>
          </Field>
        </Section>

        {error && (
          <p className="text-[13px] text-red-500 text-center bg-red-50 py-2 rounded-xl">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 bg-[#2D5219] text-white rounded-xl text-[14px] font-medium hover:bg-[#3A6B22] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.3"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              </svg>
              Saving...
            </>
          ) : 'Continue →'}
        </button>

        <p className="text-center text-[12px] text-[#ADADAD] pb-8">
          You can update all of this anytime from your profile page.
        </p>

      </div>
    </div>
  )
}