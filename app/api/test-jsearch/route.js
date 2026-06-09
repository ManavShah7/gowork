import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch(
      `https://jsearch.p.rapidapi.com/search?query=software+engineer+intern+USA&page=1&num_pages=1`,
      {
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
        },
      }
    )

    const text = await res.text()
    return NextResponse.json({ 
      status: res.status, 
      key_exists: !!process.env.RAPIDAPI_KEY,
      key_preview: process.env.RAPIDAPI_KEY?.slice(0, 8) + '...',
      response: text.slice(0, 500) 
    })
  } catch (err) {
    return NextResponse.json({ error: err.message })
  }
}