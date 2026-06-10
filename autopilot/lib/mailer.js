import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendApplicationEmail(userEmail, applications) {
  try {
    const appList = applications.map(app => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0">
          <strong style="color:#0A0A0A">${app.company}</strong>
          <br>
          <span style="color:#6B6B6B;font-size:13px">${app.role}</span>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;text-align:right">
          <span style="background:#F4F9F0;color:#2D5219;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">
            ${app.match_score}% match
          </span>
        </td>
      </tr>
    `).join('')

    await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: userEmail,
      subject: `GoWork applied to ${applications.length} job${applications.length > 1 ? 's' : ''} for you`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;background:#F7F6F2">
          <div style="background:white;border-radius:16px;padding:32px;border:1px solid #E5E5E5">
            
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
              <div style="width:28px;height:28px;background:#0A0A0A;border-radius:8px"></div>
              <span style="font-size:16px;font-weight:600;color:#0A0A0A">GoWork</span>
            </div>

            <h1 style="font-size:20px;font-weight:600;color:#0A0A0A;margin:0 0 8px">
              Applied to ${applications.length} job${applications.length > 1 ? 's' : ''} while you were away
            </h1>
            <p style="color:#6B6B6B;font-size:14px;margin:0 0 24px">
              Here's what GoWork submitted on your behalf
            </p>

            <table style="width:100%;border-collapse:collapse">
              ${appList}
            </table>

            <a href="${process.env.APP_URL}/dashboard/tracker" 
               style="display:block;text-align:center;background:#2D5219;color:white;padding:12px;border-radius:12px;text-decoration:none;font-size:14px;font-weight:500;margin-top:24px">
              View in tracker →
            </a>

            <p style="color:#ADADAD;font-size:12px;text-align:center;margin-top:20px">
              <a href="${process.env.APP_URL}/dashboard/auto-pilot" style="color:#ADADAD">
                Adjust settings
              </a>
              &nbsp;·&nbsp;
              <a href="${process.env.APP_URL}/dashboard/auto-pilot" style="color:#ADADAD">
                Turn off autopilot
              </a>
            </p>

          </div>
        </div>
      `
    })
  } catch (err) {
    console.error('Email error:', err.message)
  }
}

export async function sendFallbackEmail(userEmail, job) {
  try {
    await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: userEmail,
      subject: `Action needed — ${job.company} application needs you`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;background:#F7F6F2">
          <div style="background:white;border-radius:16px;padding:32px;border:1px solid #E5E5E5">
            
            <h1 style="font-size:20px;font-weight:600;color:#0A0A0A;margin:0 0 8px">
              One application needs your help
            </h1>
            <p style="color:#6B6B6B;font-size:14px;margin:0 0 24px">
              GoWork hit a CAPTCHA on this one. Everything is pre-filled — just submit.
            </p>

            <div style="background:#FEF3C7;border-radius:12px;padding:16px;margin-bottom:24px">
              <p style="margin:0;font-weight:600;color:#92400E">${job.company}</p>
              <p style="margin:4px 0 0;color:#B45309;font-size:13px">${job.role}</p>
            </div>

            <a href="${job.job_url}" 
               style="display:block;text-align:center;background:#B45309;color:white;padding:12px;border-radius:12px;text-decoration:none;font-size:14px;font-weight:500">
              Finish application →
            </a>

          </div>
        </div>
      `
    })
  } catch (err) {
    console.error('Fallback email error:', err.message)
  }
}