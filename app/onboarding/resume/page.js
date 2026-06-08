'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ResumePage() {
  const router = useRouter()
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  const handleFile = (f) => {
    if (!f) return
    if (f.type !== 'application/pdf') {
      setError('Please upload a PDF file.')
      return
    }
    setFile(f)
    setError('')
  }

  const handleContinue = async () => {
    if (!file) return
    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('resume', file)

      const res = await fetch('/api/parse-resume', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to parse resume')

      router.push('/onboarding/details')
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F6F2] flex items-center justify-center px-4">
      <div className="w-full max-w-[560px]">

        {/* Steps */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {['Resume', 'Details', 'Autopilot'].map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 ${i === 0 ? 'opacity-100' : 'opacity-30'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-medium ${i === 0 ? 'bg-[#2D5219] text-white' : 'bg-[#E5E5E5] text-[#888]'}`}>
                  {i + 1}
                </div>
                <span className="text-[13px] text-[#0A0A0A]">{step}</span>
              </div>
              {i < 2 && <div className="w-8 h-px bg-[#E5E5E5]" />}
            </div>
          ))}
        </div>

        <div className="text-center mb-8">
          <h1 className="text-[28px] font-semibold text-[#0A0A0A] tracking-tight mb-2">
            Upload your resume
          </h1>
          <p className="text-[14px] text-[#6B6B6B]">
            We'll use this to build your profile and apply to jobs for you.
          </p>
        </div>

        {/* Upload box */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
          onClick={() => !file && document.getElementById('resume-input').click()}
          className={`w-full min-h-[220px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${
            file ? 'border-[#2D5219] bg-[#F4F9F0]' :
            dragging ? 'border-[#2D5219] bg-[#F4F9F0]' :
            'border-[#E5E5E5] bg-white hover:border-[#ADADAD]'
          }`}
        >
          <input
            id="resume-input"
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={e => handleFile(e.target.files[0])}
          />

          {file ? (
            <div className="flex flex-col items-center gap-3 p-6">
              <div className="w-12 h-12 rounded-full bg-[#2D5219] flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="text-[15px] font-medium text-[#0A0A0A]">{file.name}</p>
                <p className="text-[13px] text-[#6B6B6B] mt-1">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); setFile(null) }}
                className="text-[12px] text-[#6B6B6B] hover:text-[#0A0A0A] underline"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 p-6">
              <div className="w-12 h-12 rounded-full bg-[#F5F4F0] flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="17 8 12 3 7 8" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="12" y1="3" x2="12" y2="15" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="text-[15px] font-medium text-[#0A0A0A]">Drop your resume here</p>
                <p className="text-[13px] text-[#6B6B6B] mt-1">PDF only · Click to browse</p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="text-[13px] text-red-500 mt-3 text-center">{error}</p>
        )}

        <button
          onClick={handleContinue}
          disabled={!file || loading}
          className={`w-full h-12 rounded-xl text-[14px] font-medium mt-6 transition-colors ${
            file && !loading
              ? 'bg-[#2D5219] text-white hover:bg-[#3A6B22]'
              : 'bg-[#E5E5E5] text-[#ADADAD] cursor-not-allowed'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
              </svg>
              Analyzing your resume...
            </span>
          ) : 'Continue'}
        </button>

      </div>
    </div>
  )
}