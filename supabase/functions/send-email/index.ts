// Sends queued emails from public.email_outbox through Resend, then marks them sent.
// Triggered by a Database Webhook on INSERT into email_outbox (see README in supabase/).
// Secrets: RESEND_API_KEY, EMAIL_FROM (e.g. "Daaduna <hello@yourdomain.com>"), APP_URL (e.g. https://daaduna.pages.dev).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically to Edge Functions.
import { createClient } from 'npm:@supabase/supabase-js@2.50.0'

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const RESEND = Deno.env.get('RESEND_API_KEY')
const FROM = Deno.env.get('EMAIL_FROM') ?? 'Daaduna <onboarding@resend.dev>'
const APP_URL = Deno.env.get('APP_URL') ?? ''

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

function html(subject: string, body: string) {
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#2b2520">
  <p style="font-size:28px;color:#8b5a3c;margin:0 0 16px" dir="rtl">ضادُنا</p>
  <h1 style="font-size:18px;margin:0 0 12px">${esc(subject)}</h1>
  <p style="font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(body)}</p>
  ${APP_URL ? `<p style="margin-top:24px"><a href="${APP_URL}" style="background:#8b5a3c;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none">Open Daaduna</a></p>` : ''}
</div>`
}

Deno.serve(async () => {
  if (!RESEND) return new Response('RESEND_API_KEY is not set', { status: 500 })
  const { data: mails, error } = await sb.from('email_outbox').select('*').is('sent_at', null).order('created_at').limit(50)
  if (error) return new Response(error.message, { status: 500 })
  let sent = 0
  for (const m of mails ?? []) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: m.to_email, subject: m.subject, text: `${m.body}\n\n${APP_URL}`, html: html(m.subject, m.body) }),
    })
    if (res.ok) {
      await sb.from('email_outbox').update({ sent_at: new Date().toISOString() }).eq('id', m.id)
      sent++
    } else {
      console.error('resend failed', m.id, res.status, await res.text())
    }
  }
  return Response.json({ sent, pending: (mails?.length ?? 0) - sent })
})
