'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase'

const ALL_ROLES = [
  // Design
  { id: 'product-design', label: 'Product Designer', category: 'Design' },
  { id: 'ux-design', label: 'UX Designer', category: 'Design' },
  { id: 'ui-design', label: 'UI Designer', category: 'Design' },
  { id: 'interaction-design', label: 'Interaction Designer', category: 'Design' },
  { id: 'design-research', label: 'Design Researcher', category: 'Design' },
  { id: 'visual-design', label: 'Visual Designer', category: 'Design' },
  { id: 'motion-design', label: 'Motion Designer', category: 'Design' },
  { id: 'graphic-design', label: 'Graphic Designer', category: 'Design' },
  { id: 'brand-design', label: 'Brand Designer', category: 'Design' },
  // Engineering
  { id: 'software-engineering', label: 'Software Engineer', category: 'Engineering' },
  { id: 'frontend-engineering', label: 'Frontend Engineer', category: 'Engineering' },
  { id: 'backend-engineering', label: 'Backend Engineer', category: 'Engineering' },
  { id: 'full-stack-engineering', label: 'Full Stack Engineer', category: 'Engineering' },
  { id: 'mobile-engineering', label: 'Mobile Engineer', category: 'Engineering' },
  { id: 'ios-engineering', label: 'iOS Engineer', category: 'Engineering' },
  { id: 'android-engineering', label: 'Android Engineer', category: 'Engineering' },
  { id: 'devops', label: 'DevOps / Platform', category: 'Engineering' },
  { id: 'machine-learning', label: 'ML Engineer', category: 'Engineering' },
  { id: 'ai-engineering', label: 'AI Engineer', category: 'Engineering' },
  // Data
  { id: 'data-science', label: 'Data Scientist', category: 'Data' },
  { id: 'data-engineering', label: 'Data Engineer', category: 'Data' },
  { id: 'data-analysis', label: 'Data Analyst', category: 'Data' },
  { id: 'business-intelligence', label: 'Business Intelligence', category: 'Data' },
  // Product
  { id: 'product-management', label: 'Product Manager', category: 'Product' },
  { id: 'program-management', label: 'Program Manager', category: 'Product' },
  { id: 'technical-program-management', label: 'Technical PM', category: 'Product' },
  // Business
  { id: 'consulting', label: 'Consulting', category: 'Business' },
  { id: 'strategy', label: 'Strategy', category: 'Business' },
  { id: 'business-analysis', label: 'Business Analyst', category: 'Business' },
  { id: 'operations', label: 'Operations', category: 'Business' },
  { id: 'business-development', label: 'Business Development', category: 'Business' },
  // Finance
  { id: 'investment-banking', label: 'Investment Banking', category: 'Finance' },
  { id: 'financial-analysis', label: 'Financial Analyst', category: 'Finance' },
  { id: 'corporate-finance', label: 'Corporate Finance', category: 'Finance' },
  { id: 'accounting', label: 'Accounting', category: 'Finance' },
  { id: 'venture-capital', label: 'Venture Capital', category: 'Finance' },
  { id: 'private-equity', label: 'Private Equity', category: 'Finance' },
  // Marketing
  { id: 'marketing', label: 'Marketing', category: 'Marketing' },
  { id: 'product-marketing', label: 'Product Marketing', category: 'Marketing' },
  { id: 'growth', label: 'Growth', category: 'Marketing' },
  { id: 'content', label: 'Content', category: 'Marketing' },
  { id: 'digital-marketing', label: 'Digital Marketing', category: 'Marketing' },
  // Research
  { id: 'ux-research', label: 'UX Researcher', category: 'Research' },
  { id: 'market-research', label: 'Market Researcher', category: 'Research' },
  { id: 'research', label: 'Research', category: 'Research' },
  // Other
  { id: 'cybersecurity', label: 'Cybersecurity', category: 'Other' },
  { id: 'sales', label: 'Sales', category: 'Other' },
  { id: 'human-resources', label: 'Human Resources', category: 'Other' },
  { id: 'legal', label: 'Legal', category: 'Other' },
  { id: 'healthcare', label: 'Healthcare', category: 'Other' },
  { id: 'biotech', label: 'Biotech', category: 'Other' },
]

export default function RolesPage() {
  const router = useRouter()
  const supabase = createBrowserSupabase()

  const [selected, setSelected] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [aiSuggested, setAiSuggested] = useState([])

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('intelligence_profiles')
      .select('target_role_tags, primary_role, suggested_roles')
      .eq('user_id', user.id)
      .single()

    if (profile?.target_role_tags?.length) {
      setSelected(profile.target_role_tags)
      setAiSuggested(profile.target_role_tags)
    }
    setLoading(false)
  }

  function toggle(roleId) {
    setSelected(prev =>
      prev.includes(roleId)
        ? prev.filter(r => r !== roleId)
        : [...prev, roleId]
    )
  }

  const filtered = search
    ? ALL_ROLES.filter(r => r.label.toLowerCase().includes(search.toLowerCase()))
    : ALL_ROLES

  const selectedRoles = ALL_ROLES.filter(r => selected.includes(r.id))
  const suggestedNotSelected = ALL_ROLES.filter(r =>
    aiSuggested.includes(r.id) && !selected.includes(r.id)
  )
  const categories = [...new Set(filtered.map(r => r.category))]

  async function save() {
    if (selected.length === 0) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    await supabase
      .from('intelligence_profiles')
      .update({ target_role_tags: selected })
      .eq('user_id', user.id)

    router.push('/onboarding/details')
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
        .role-chip { cursor: pointer; padding: 8px 16px; border-radius: 100px; font-size: 14px; font-weight: 500; border: 1.5px solid #E0DED8; background: white; color: #3D3D3D; transition: all 0.15s; user-select: none; }
        .role-chip:hover { border-color: #2D5219; color: #2D5219; }
        .role-chip.selected { background: #2D5219; color: white; border-color: #2D5219; }
        .role-chip.suggested { border-color: #2D5219; color: #2D5219; background: #F0F5EC; }
      `}</style>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px 120px' }}>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 40 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: i <= 2 ? '#2D5219' : '#E0DED8' }} />
          ))}
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1A1A1A', margin: '0 0 8px' }}>
          What roles are you targeting?
        </h1>
        <p style={{ fontSize: 16, color: '#6B6B6B', margin: '0 0 32px', lineHeight: 1.5 }}>
          We pre-selected based on your resume. Add or remove anything.
        </p>

        {/* Selected chips */}
        {selected.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#6B6B6B', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 12px' }}>
              Selected ({selected.length})
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {selectedRoles.map(role => (
                <button key={role.id} className="role-chip selected" onClick={() => toggle(role.id)}>
                  {role.label} ✕
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 24 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search roles..."
            style={{
              width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid #E0DED8',
              background: 'white', fontSize: 15, color: '#1A1A1A', outline: 'none',
              boxSizing: 'border-box', fontFamily: 'inherit'
            }}
          />
        </div>

        {/* Role categories */}
        {categories.map(cat => {
          const catRoles = filtered.filter(r => r.category === cat && !selected.includes(r.id))
          if (!catRoles.length) return null
          return (
            <div key={cat} style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#6B6B6B', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 12px' }}>
                {cat}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {catRoles.map(role => (
                  <button
                    key={role.id}
                    className={`role-chip ${aiSuggested.includes(role.id) ? 'suggested' : ''}`}
                    onClick={() => toggle(role.id)}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Sticky footer */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(245,244,240,0.95)', backdropFilter: 'blur(12px)',
        borderTop: '1px solid #E0DED8', padding: '16px 24px'
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ margin: 0, fontSize: 14, color: '#6B6B6B' }}>
            {selected.length === 0 ? 'Select at least one role' : `${selected.length} role${selected.length > 1 ? 's' : ''} selected`}
          </p>
          <button
            onClick={save}
            disabled={selected.length === 0 || saving}
            style={{
              padding: '12px 28px', borderRadius: 12, border: 'none',
              background: selected.length > 0 ? '#2D5219' : '#E0DED8',
              color: selected.length > 0 ? 'white' : '#ADADAD',
              fontSize: 15, fontWeight: 600, cursor: selected.length > 0 ? 'pointer' : 'default',
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