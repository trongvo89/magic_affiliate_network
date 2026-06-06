import nodemailer from 'nodemailer'

function createTransport() {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return null
  const port = parseInt(process.env.SMTP_PORT || '587')
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

export function isMailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const transport = createTransport()
  if (!transport) throw new Error('SMTP not configured')
  const from = process.env.EMAIL_FROM || `Magic Affiliate <${process.env.SMTP_USER}>`
  await transport.sendMail({
    from,
    to,
    subject: 'Reset your Magic Affiliate password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="color:#1e293b;margin-top:0">Reset your password</h2>
        <p style="color:#475569">You requested a password reset for your Magic Affiliate account.</p>
        <p style="color:#475569">This link expires in <strong>1 hour</strong>. If you didn't request this, ignore this email.</p>
        <div style="margin:28px 0">
          <a href="${resetUrl}"
            style="display:inline-block;padding:13px 28px;background:#f97316;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">
            Reset Password
          </a>
        </div>
        <p style="color:#94a3b8;font-size:12px">Or copy this link into your browser:<br>
          <span style="color:#475569;word-break:break-all">${resetUrl}</span>
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0">
        <p style="color:#94a3b8;font-size:11px;margin:0">Magic Affiliate Network</p>
      </div>
    `,
  })
}
