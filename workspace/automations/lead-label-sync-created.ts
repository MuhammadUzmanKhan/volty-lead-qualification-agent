import { defineAutomation, z } from '~/automation'

// Deterministic backstop for lead status, half 1 of 2 (twin: lead-label-sync-updated).
// Volty scores each lead in the Leads table ("fit"). The contact's Contact Label
// must always match that score, exactly one of the four "Lead: ..." labels. The
// model is asked to set it too, but in testing it occasionally skipped the label
// after a failed tool call, so this routine makes the table the source of truth:
// on every Leads row change it reads the fit, finds the chat's contact, and adds
// the matching label and removes the other three. Idempotent: if the contact
// already carries exactly the right label it changes nothing.
const LEADS = 'tbl:tjfacuh0u0ru'
const LABELS: Record<string, string> = {
  Hot: 'Lead: Hot',
  Warm: 'Lead: Warm',
  Nurture: 'Lead: Nurture',
  'Not a fit': 'Lead: Not a fit',
}

export default defineAutomation({
  id: 'lead-label-sync-created',
  trigger: { kind: 'event', name: 'row.created', filter: { tableId: 'tjfacuh0u0ru' } },
  input: z.object({ tableId: z.string(), rowId: z.string() }),
  output: z.object({ changed: z.boolean(), reason: z.string() }),
  async run({ input, ctx }) {
    const res = (await ctx.volty.rows.get({ tableId: LEADS, rowId: input.rowId })) as {
      row?: { fields: { fit?: string | null; conversation?: string | null } }
      fields?: { fit?: string | null; conversation?: string | null }
    }
    const f = res.row?.fields ?? res.fields ?? {}
    const want = f.fit ? LABELS[f.fit] : undefined
    if (!want) return { changed: false, reason: 'not scored yet' }
    const conversationId = (f.conversation ?? '').trim().replace(/^cnv:/, '')
    if (!conversationId) return { changed: false, reason: 'no conversation on row' }

    const conv = (await ctx.volty.conversations.get({ conversationId })) as { contactId?: string | null }
    if (!conv.contactId) return { changed: false, reason: 'conversation has no contact' }
    const got = (await ctx.volty.contacts.get({ id: conv.contactId })) as {
      contact?: { segments?: string[] }
      segments?: string[]
    }
    const segments = got.contact?.segments ?? got.segments ?? []
    const remove = Object.values(LABELS).filter((l) => l !== want && segments.includes(l))
    if (segments.includes(want) && remove.length === 0) return { changed: false, reason: 'already correct' }

    await ctx.volty.contacts.update({ id: conv.contactId, addSegments: [want], removeSegments: remove })
    return { changed: true, reason: `set ${want}` }
  },
})
