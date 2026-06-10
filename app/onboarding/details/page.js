'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase'

const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Mandarin', 'Cantonese',
  'Japanese', 'Korean', 'Hindi', 'Arabic', 'Portuguese', 'Russian',
  'Italian', 'Dutch', 'Hebrew', 'Turkish', 'Vietnamese', 'Bengali',
  'Urdu', 'Tagalog', 'Polish', 'Swedish', 'Danish', 'Finnish'
]

const VISA_OPTIONS = [
  { value: 'us_citizen', label: 'US Citizen' },
  { value: 'green_card', label: 'Green Card' },
  { value: 'h1b', label: 'H-1B' },
  { value: 'opt', label: 'OPT' },
  { value: 'stem_opt', label: 'STEM OPT' },
  { value: 'cpt', label: 'CPT' },
  { value: 'tn', label: 'TN Visa' },
  { value: 'o1', label: 'O-1' },
  { value: 'other', label: 'Other' },
]

function Toggle({ checked, onChange, label, sublabel }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 0', cursor: 'pointer', borderBottom: '1px solid #F0EEE8'
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: '#1A1A1A' }}>{label}</p>
        {sublabel && <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6B6B6B' }}>{sublabel}</p>}
      </div>
      <div style={{
        width: 44, height: 26, borderRadius: 13,
        background: checked ? '#2D5219' : '#D4D2CC',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%', background: 'white',
          position: 'absolute', top: 3,
          left: checked ? 21 : 3, transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
        }} />
      </div>
    </div>
  )
}

function Chip({ label, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px', borderRadius: 100, fontSize: 14, fontWeight: 500,
        border: `1.5px solid ${selected ? '#2D5219' : '#E0DED8'}`,
        background: selected ? '#2D5219' : 'white',
        color: selected ? 'white' : '#3D3D3D',
        cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit'
      }}
    >
      {label}
    </button>
  )
}

function Section({ title, children, optional = false, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ background: 'white', borderRadius: 16, padding: '20px 20px 4px', marginBottom: 12, border: '1px solid #E8E6E0' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 16px', fontFamily: 'inherit'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>{title}</span>
          {optional && (
            <span style={{ fontSize: 12, fontWeight: 500, color: '#ADADAD', background: '#F5F4F0', padding: '2px 8px', borderRadius: 6 }}>
              optional
            </span>
          )}
        </div>
        <span style={{ fontSize: 18, color: '#ADADAD', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          ↓
        </span>
      </button>
      {open && <div style={{ paddingBottom: 16 }}>{children}</div>}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #E0DED8',
  background: '#FAFAF8', fontSize: 15, color: '#1A1A1A', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.15s'
}

export default function DetailsPage() {
  const router = useRouter()
  const supabase = createBrowserSupabase()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Contact
  const [name, setName] = useState('')
  const [preferredName, setPreferredName] = useState('')
  const [phone, setPhone] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [country, setCountry] = useState('United States')

  // Work preferences
  const [jobTypes, setJobTypes] = useState(['internship'])
  const [workStyle, setWorkStyle] = useState('any')
  const [startDate, setStartDate] = useState('immediately')
  const [willingToRelocate, setWillingToRelocate] = useState(false)
  const [preferredLocations, setPreferredLocations] = useState([])
  const [locationInput, setLocationInput] = useState('')

  // Authorization
  const [authorizedToWork, setAuthorizedToWork] = useState(true)
  const [sponsorshipNeeded, setSponsorshipNeeded] = useState(false)
  const [visaStatus, setVisaStatus] = useState('us_citizen')
  const [currentlyEmployed, setCurrentlyEmployed] = useState(false)
  const [noticePeriod, setNoticePeriod] = useState('immediately')

  // Travel / logistics
  const [willingToTravel, setWillingToTravel] = useState(false)
  const [travelPercentage, setTravelPercentage] = useState('0%')
  const [hasDriversLicense, setHasDriversLicense] = useState(false)

  // Compensation
  const [expectedSalary, setExpectedSalary] = useState('negotiable')

  // Languages
  const [languages, setLanguages] = useState(['English'])

  // EEO
  const [pronouns, setPronouns] = useState('')
  const [gender, setGender] = useState('')
  const [ethnicity, setEthnicity] = useState('')
  const [veteranStatus, setVeteranStatus] = useState('')
  const [disabilityStatus, setDisabilityStatus] = useState('')

  // Legal
  const [backgroundCheckOk, setBackgroundCheckOk] = useState(true)
  const [drugTestOk, setDrugTestOk] = useState(true)
  const [felonyConviction, setFelonyConviction] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [autofillRes, profileRes, parsedRes, settingsRes] = await Promise.all([
      supabase.from('autofill_data').select('*').eq('user_id', user.id).single(),
      supabase.from('intelligence_profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('parsed_resumes').select('parsed_data').eq('user_id', user.id).single(),
      supabase.from('auto_apply_settings').select('*').eq('user_id', user.id).single(),
    ])

    const a = autofillRes.data || {}
    const p = profileRes.data || {}
    const parsed = parsedRes.data?.parsed_data || {}
    const s = settingsRes.data || {}

    // Pre-fill from autofill_data
    setName(a.name || parsed.name || '')
    setPreferredName(a.preferred_name || '')
    setPhone(a.phone || parsed.phone || '')
    setLinkedinUrl(a.linkedin_url || parsed.linkedin || '')
    setPortfolioUrl(a.portfolio_url || parsed.portfolio || '')
    setCity(a.city || '')
    setState(a.state || '')
    setZip(a.zip || '')
    setCountry(a.country || 'United States')
    setAuthorizedToWork(a.authorized_to_work ?? true)
    setSponsorshipNeeded(a.sponsorship_needed ?? false)
    setVisaStatus(a.visa_status || 'us_citizen')
    setPronouns(a.pronouns || '')
    setGender(a.gender || '')
    setEthnicity(a.ethnicity || '')
    setVeteranStatus(a.veteran_status || '')
    setDisabilityStatus(a.disability_status || '')
    setWillingToRelocate(a.willing_to_relocate ?? false)
    setWillingToTravel(a.willing_to_travel ?? false)
    setTravelPercentage(a.travel_percentage || '0%')
    setHasDriversLicense(a.has_drivers_license ?? false)
    setCurrentlyEmployed(a.currently_employed ?? false)
    setNoticePeriod(a.notice_period || 'immediately')
    setStartDate(a.start_date || 'immediately')
    setExpectedSalary(a.expected_salary || 'negotiable')
    setBackgroundCheckOk(a.background_check_ok ?? true)
    setDrugTestOk(a.drug_test_ok ?? true)
    setFelonyConviction(a.felony_conviction ?? false)

    // Settings
    setJobTypes(s.job_types || ['internship'])
    setWorkStyle(s.preferred_work_style || s.work_style || 'any')
    setPreferredLocations(s.preferred_locations || [])

    // Languages from parsed resume
    const parsedLangs = parsed.languages_spoken || []
    if (parsedLangs.length > 0) setLanguages(parsedLangs)

    setLoading(false)
  }

  function toggleJobType(type) {
    setJobTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  function toggleLanguage(lang) {
    if (lang === 'English') return // always keep English
    setLanguages(prev =>
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    )
  }

  function addLocation() {
    if (locationInput.trim() && !preferredLocations.includes(locationInput.trim())) {
      setPreferredLocations(prev => [...prev, locationInput.trim()])
      setLocationInput('')
    }
  }

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await Promise.all([
      supabase.from('autofill_data').upsert({
        user_id: user.id,
        name, preferred_name: preferredName, phone,
        linkedin_url: linkedinUrl, portfolio_url: portfolioUrl,
        city, state, zip, country,
        authorized_to_work: authorizedToWork,
        sponsorship_needed: sponsorshipNeeded,
        visa_status: visaStatus,
        willing_to_relocate: willingToRelocate,
        willing_to_travel: willingToTravel,
        travel_percentage: travelPercentage,
        has_drivers_license: hasDriversLicense,
        currently_employed: currentlyEmployed,
        notice_period: noticePeriod,
        start_date: startDate,
        expected_salary: expectedSalary,
        pronouns, gender, ethnicity,
        veteran_status: veteranStatus,
        disability_status: disabilityStatus,
        background_check_ok: backgroundCheckOk,
        drug_test_ok: drugTestOk,
        felony_conviction: felonyConviction,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }),

      supabase.from('intelligence_profiles').update({
        languages_spoken: languages.map(l => ({ language: l, proficiency: l === 'English' ? 'native' : 'fluent' })),
      }).eq('user_id', user.id),

      supabase.from('auto_apply_settings').upsert({
        user_id: user.id,
        job_types: jobTypes,
        preferred_work_style: workStyle,
        preferred_locations: preferredLocations,
        enabled: false,
        match_threshold: 72,
        daily_limit: 5,
      }, { onConflict: 'user_id' }),
    ])

    router.push('/onboarding/autopilot')
  }

  if (loading) return (
    <div style={{ background: '#F5F4F0', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 24, height: 24, border: '2px solid #2D5219', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ background: '#F5F4F0', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        input:focus, select:focus { border-color: #2D5219 !important; background: white !important; }
      `}</style>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px 120px' }}>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 40 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: i <= 3 ? '#2D5219' : '#E0DED8' }} />
          ))}
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1A1A1A', margin: '0 0 8px' }}>
          A few quick details
        </h1>
        <p style={{ fontSize: 16, color: '#6B6B6B', margin: '0 0 32px', lineHeight: 1.5 }}>
          Pre-filled from your resume. Just confirm and fill any gaps.
        </p>

        {/* Contact */}
        <Section title="Contact">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Full name">
              <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Manav Shah" />
            </Field>
            <Field label="Preferred name">
              <input style={inputStyle} value={preferredName} onChange={e => setPreferredName(e.target.value)} placeholder="Manav (optional)" />
            </Field>
          </div>
          <Field label="Phone">
            <input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (617) 000-0000" />
          </Field>
          <Field label="LinkedIn URL">
            <input style={inputStyle} value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="linkedin.com/in/yourprofile" />
          </Field>
          <Field label="Portfolio / GitHub">
            <input style={inputStyle} value={portfolioUrl} onChange={e => setPortfolioUrl(e.target.value)} placeholder="yoursite.com or github.com/you" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
            <Field label="City">
              <input style={inputStyle} value={city} onChange={e => setCity(e.target.value)} placeholder="Boston" />
            </Field>
            <Field label="State">
              <input style={inputStyle} value={state} onChange={e => setState(e.target.value)} placeholder="MA" />
            </Field>
            <Field label="Zip">
              <input style={inputStyle} value={zip} onChange={e => setZip(e.target.value)} placeholder="02101" />
            </Field>
          </div>
        </Section>

        {/* Job preferences */}
        <Section title="Job preferences">
          <Field label="Job type">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { id: 'internship', label: 'Internship' },
                { id: 'coop', label: 'Co-op' },
                { id: 'fulltime', label: 'Full-time' },
                { id: 'parttime', label: 'Part-time' },
                { id: 'contract', label: 'Contract' },
              ].map(t => (
                <Chip key={t.id} label={t.label} selected={jobTypes.includes(t.id)} onClick={() => toggleJobType(t.id)} />
              ))}
            </div>
          </Field>

          <Field label="Work style">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['Any', 'Remote', 'Hybrid', 'On-site'].map(s => (
                <Chip key={s} label={s} selected={workStyle === s.toLowerCase()} onClick={() => setWorkStyle(s.toLowerCase())} />
              ))}
            </div>
          </Field>

          <Field label="Start date">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['Immediately', '2 weeks', '1 month', '3 months'].map(d => (
                <Chip key={d} label={d} selected={startDate === d.toLowerCase()} onClick={() => setStartDate(d.toLowerCase())} />
              ))}
            </div>
          </Field>

          <Toggle
            checked={willingToRelocate}
            onChange={setWillingToRelocate}
            label="Willing to relocate"
            sublabel="Open to moving for the right role"
          />

          {willingToRelocate && (
            <Field label="Preferred locations">
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                {preferredLocations.map(loc => (
                  <span key={loc} style={{
                    padding: '6px 12px', background: '#2D5219', color: 'white',
                    borderRadius: 100, fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6
                  }}>
                    {loc}
                    <button onClick={() => setPreferredLocations(prev => prev.filter(l => l !== loc))}
                      style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={locationInput}
                  onChange={e => setLocationInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addLocation()}
                  placeholder="San Francisco, CA"
                />
                <button onClick={addLocation} style={{
                  padding: '12px 16px', borderRadius: 10, background: '#2D5219', color: 'white',
                  border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit'
                }}>Add</button>
              </div>
            </Field>
          )}
        </Section>

        {/* Work authorization */}
        <Section title="Work authorization">
          <Toggle
            checked={authorizedToWork}
            onChange={setAuthorizedToWork}
            label="Authorized to work in the US"
            sublabel="Citizens, green card holders, valid work visa"
          />

          <Toggle
            checked={sponsorshipNeeded}
            onChange={setSponsorshipNeeded}
            label="Need visa sponsorship"
            sublabel="H-1B, OPT extension, etc."
          />

          <Field label="Visa / work status">
            <select
              style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
              value={visaStatus}
              onChange={e => setVisaStatus(e.target.value)}
            >
              {VISA_OPTIONS.map(v => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </Field>

          <Toggle
            checked={currentlyEmployed}
            onChange={setCurrentlyEmployed}
            label="Currently employed"
            sublabel="We'll handle notice period questions for you"
          />

          {currentlyEmployed && (
            <Field label="Notice period">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['Immediately', '1 week', '2 weeks', '1 month', '2 months'].map(n => (
                  <Chip key={n} label={n} selected={noticePeriod === n.toLowerCase()} onClick={() => setNoticePeriod(n.toLowerCase())} />
                ))}
              </div>
            </Field>
          )}

          <Toggle
            checked={willingToTravel}
            onChange={setWillingToTravel}
            label="Willing to travel"
          />

          {willingToTravel && (
            <Field label="Travel percentage">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['10%', '25%', '50%', '75%'].map(t => (
                  <Chip key={t} label={`Up to ${t}`} selected={travelPercentage === t} onClick={() => setTravelPercentage(t)} />
                ))}
              </div>
            </Field>
          )}

          <Toggle
            checked={hasDriversLicense}
            onChange={setHasDriversLicense}
            label="Valid driver's license"
          />
        </Section>

        {/* Compensation */}
        <Section title="Compensation">
          <p style={{ fontSize: 14, color: '#6B6B6B', margin: '0 0 16px', lineHeight: 1.5 }}>
            We always answer salary questions with "Negotiable" — this protects your leverage. You can override if needed.
          </p>
          <Field label="Salary preference">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['Negotiable', 'Specify range'].map(s => (
                <Chip
                  key={s}
                  label={s}
                  selected={s === 'Negotiable' ? expectedSalary === 'negotiable' : expectedSalary !== 'negotiable'}
                  onClick={() => {
                    if (s === 'Negotiable') setExpectedSalary('negotiable')
                  }}
                />
              ))}
            </div>
          </Field>
          {expectedSalary !== 'negotiable' && (
            <Field label="Expected salary (annual)">
              <input
                style={inputStyle}
                value={expectedSalary}
                onChange={e => setExpectedSalary(e.target.value)}
                placeholder="e.g. $80,000 - $100,000"
              />
            </Field>
          )}
        </Section>

        {/* Languages */}
        <Section title="Languages">
          <p style={{ fontSize: 14, color: '#6B6B6B', margin: '0 0 16px' }}>
            Select all languages you speak. We'll check the right boxes on applications.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {LANGUAGES.map(lang => (
              <Chip
                key={lang}
                label={lang}
                selected={languages.includes(lang)}
                onClick={() => toggleLanguage(lang)}
              />
            ))}
          </div>
        </Section>

        {/* EEO */}
        <Section title="Identity & diversity" optional defaultOpen={false}>
          <p style={{ fontSize: 14, color: '#6B6B6B', margin: '0 0 16px', lineHeight: 1.5 }}>
            Used only for equal opportunity reporting. Entirely optional — we'll answer "prefer not to say" if you skip.
          </p>

          <Field label="Pronouns">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['He/Him', 'She/Her', 'They/Them', 'Ze/Zir', 'Prefer not to say'].map(p => (
                <Chip key={p} label={p} selected={pronouns === p} onClick={() => setPronouns(pronouns === p ? '' : p)} />
              ))}
            </div>
          </Field>

          <Field label="Gender">
            <select style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }} value={gender} onChange={e => setGender(e.target.value)}>
              <option value="">Prefer not to say</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Non-binary">Non-binary</option>
              <option value="Genderqueer">Genderqueer</option>
              <option value="Transgender">Transgender</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </Field>

          <Field label="Race / Ethnicity">
            <select style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }} value={ethnicity} onChange={e => setEthnicity(e.target.value)}>
              <option value="">Prefer not to say</option>
              <option value="American Indian or Alaska Native">American Indian or Alaska Native</option>
              <option value="Asian">Asian</option>
              <option value="Black or African American">Black or African American</option>
              <option value="Hispanic or Latino">Hispanic or Latino</option>
              <option value="Native Hawaiian or Pacific Islander">Native Hawaiian or Pacific Islander</option>
              <option value="White">White</option>
              <option value="Two or more races">Two or more races</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </Field>

          <Field label="Veteran status">
            <select style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }} value={veteranStatus} onChange={e => setVeteranStatus(e.target.value)}>
              <option value="">Prefer not to say</option>
              <option value="I am not a protected veteran">Not a veteran</option>
              <option value="I identify as one or more of the classifications of a protected veteran">Protected veteran</option>
              <option value="I am a disabled veteran">Disabled veteran</option>
              <option value="I don't wish to answer">Prefer not to say</option>
            </select>
          </Field>

          <Field label="Disability status">
            <select style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }} value={disabilityStatus} onChange={e => setDisabilityStatus(e.target.value)}>
              <option value="">Prefer not to say</option>
              <option value="I do not have a disability">No disability</option>
              <option value="I have a disability">Yes, I have a disability</option>
              <option value="I don't wish to answer">Prefer not to say</option>
            </select>
          </Field>
        </Section>

        {/* Legal */}
        <Section title="Background & legal" optional defaultOpen={false}>
          <p style={{ fontSize: 14, color: '#6B6B6B', margin: '0 0 8px', lineHeight: 1.5 }}>
            Defaults are fine for most people. Change only if needed.
          </p>
          <Toggle checked={backgroundCheckOk} onChange={setBackgroundCheckOk} label="Consent to background check" />
          <Toggle checked={drugTestOk} onChange={setDrugTestOk} label="Consent to drug screening" />
          <Toggle
            checked={felonyConviction}
            onChange={setFelonyConviction}
            label="Have a felony conviction"
            sublabel="If yes, you may need to explain in some applications"
          />
        </Section>

      </div>

      {/* Sticky footer */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(245,244,240,0.95)', backdropFilter: 'blur(12px)',
        borderTop: '1px solid #E0DED8', padding: '16px 24px'
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => router.back()} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 15, color: '#6B6B6B', fontFamily: 'inherit'
          }}>← Back</button>
          <button
            onClick={save}
            disabled={saving || !name || !phone}
            style={{
              padding: '12px 28px', borderRadius: 12, border: 'none',
              background: name && phone ? '#2D5219' : '#E0DED8',
              color: name && phone ? 'white' : '#ADADAD',
              fontSize: 15, fontWeight: 600, cursor: name && phone ? 'pointer' : 'default',
              transition: 'all 0.15s', fontFamily: 'inherit'
            }}
          >
            {saving ? 'Saving...' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  )
}