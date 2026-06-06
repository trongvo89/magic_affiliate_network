import axios from 'axios'

export function isMailConfigured(): boolean {
  return !!(process.env.BREVO_API_KEY)
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('BREVO_API_KEY not configured')

  const raw = process.env.EMAIL_FROM || 'Magic Affiliate <noreply@magicaffiliate.com>'
  const match = raw.match(/^(.*?)\s*<(.+?)>$/)
  const senderName = match ? match[1].trim() || 'Magic Affiliate' : 'Magic Affiliate'
  const senderEmail = match ? match[2] : raw

  await axios.post(
    'https://api.brevo.com/v3/smtp/email',
    {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject: 'Reset your Magic Affiliate password',
      htmlContent: `
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
    },
    {
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    }
  )
}
