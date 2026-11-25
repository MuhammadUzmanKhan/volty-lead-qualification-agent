import { defineAutomation, z } from '~/automation'

// Speed-to-lead, half 2 of 2: when a Leads row becomes Hot on an update,
// ping the strategist at once with the summary and a link to the chat. Its
// twin, hot-lead-alert-created, covers a row created already Hot. The row's
// "alerted" flag keeps the pair (and our own write-back, which fires
// row.updated again) from alerting twice for one lead.
const LEADS = 'tbl:tjfacuh0u0ru'

// Hardening: the row's "conversation" field is written by the model, so treat it
// as untrusted. Accept only a well-formed id, and only act on a customer
// conversation in the Lumen Lane web chat inbox or the Sandbox (where tests run).
const ALLOWED_INBOXES = ['bfsmumi2ntux', 'd2xquq5v16ld']
const CONV_ID = /^(?:cnv:)?([a-z0-9]{8,32})$/
const STRATEGIST = 'usr:lm8n2gdqq19jo26'

type LeadFields = {
  contact_name?: string | null
  company?: string | null
  service?: string | null
  budget_band?: string | null
  timeline?: string | null
  decision_role?: string | null
  fit?: string | null
  summary?: string | null
  conversation?: string | null
  alerted?: boolean | null
}

export default defineAutomation({
  id: 'hot-lead-alert-updated',
  trigger: { kind: 'event', name: 'row.updated', filter: { tableId: 'tjfacuh0u0ru' } },
  input: z.object({ tableId: z.string(), rowId: z.string() }),
  output: z.object({ alerted: z.boolean(), reason: z.string() }),
  async run({ input, ctx }) {
    const res = (await ctx.volty.rows.get({ tableId: LEADS, rowId: input.rowId })) as {
      row?: { id: string; fields: LeadFields }
      fields?: LeadFields
    }
    const f: LeadFields = res.row?.fields ?? res.fields ?? {}
    if (f.fit !== 'Hot') return { alerted: false, reason: 'not hot' }
    if (f.alerted === true) return { alerted: false, reason: 'already alerted' }

    // Model-written text goes into a staff notification: strip control
    // characters, redact credential-shaped strings, cap the length.
    const clean = (v: string | null | undefined, max: number) =>
      (v ?? '')
        .replace(/[\u0000-\u001f\u007f]+/g, ' ')
        .replace(/(password|passwd|pwd|login|token|api[ _-]?key)\s*[:=]?\s*\S+/gi, '$1 [redacted]')
        .trim()
        .slice(0, max)
    const who = [clean(f.contact_name, 60), clean(f.company, 60)].filter(Boolean).join(' at ') || 'A new lead'
    const facts = [clean(f.service, 30), f.budget_band ? `budget ${clean(f.budget_band, 12)}/mo` : '', clean(f.timeline, 20), clean(f.decision_role, 20)]
      .filter(Boolean)
      .join(' · ')
    const message = `🔥 Hot lead: ${who}${facts ? ` (${facts})` : ''}. ${clean(f.summary, 300)} Reply within 1 working day.`.trim()

    const m = CONV_ID.exec((f.conversation ?? '').trim())
    let conversationId: string | undefined
    if (m) {
      const conv = (await ctx.volty.conversations.get({ conversationId: m[1] })) as { inboxId?: string | null; lane?: string | null }
      if (conv.inboxId && ALLOWED_INBOXES.includes(conv.inboxId) && conv.lane === 'contact') conversationId = m[1]
    }

    await ctx.volty.staff.notify({ userId: STRATEGIST, message, conversationId })
    await ctx.volty.rows.update({ tableId: LEADS, rows: [{ id: input.rowId, fields: { alerted: true } }] })
    return { alerted: true, reason: 'hot lead' }
  },
})
