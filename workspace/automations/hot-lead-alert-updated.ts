import { defineAutomation, z } from '~/automation'

// Speed-to-lead, half 2 of 2: when a Leads row becomes Hot on an update,
// ping the strategist at once with the summary and a link to the chat. Its
// twin, hot-lead-alert-created, covers a row created already Hot. The row's
// "alerted" flag keeps the pair (and our own write-back, which fires
// row.updated again) from alerting twice for one lead.
const LEADS = 'tbl:tjfacuh0u0ru'
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

    const who = [f.contact_name, f.company].filter(Boolean).join(' at ') || 'A new lead'
    const facts = [f.service, f.budget_band && `budget ${f.budget_band}/mo`, f.timeline, f.decision_role]
      .filter(Boolean)
      .join(' · ')
    const message = `🔥 Hot lead: ${who}${facts ? ` (${facts})` : ''}. ${f.summary ?? ''} Reply within 1 working day.`.trim()
    const conv = (f.conversation ?? '').trim()
    const conversationId = /^(cnv:)?[a-z0-9]{8,}$/.test(conv) ? conv : undefined

    await ctx.volty.staff.notify({ userId: STRATEGIST, message, conversationId })
    await ctx.volty.rows.update({ tableId: LEADS, rows: [{ id: input.rowId, fields: { alerted: true } }] })
    return { alerted: true, reason: 'hot lead' }
  },
})
