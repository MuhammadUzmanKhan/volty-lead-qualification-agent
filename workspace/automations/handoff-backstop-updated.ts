import { defineAutomation, z } from '~/automation'

// Hand-off backstop, half 2 of 2 (twin: handoff-backstop-created).
// When Volty marks a lead "Handed to strategist" in the Leads table, a person must
// actually own the chat. In testing the model once told a visitor "I've passed
// this to the team" without making the hand-off call, so this routine closes that
// say/do gap deterministically: if the row says handed off and nobody is assigned
// to the conversation, it assigns the strategist. Idempotent: an assigned chat is
// left alone.
const LEADS = 'tbl:tjfacuh0u0ru'
const STRATEGIST = 'lm8n2gdqq19jo26'

export default defineAutomation({
  id: 'handoff-backstop-updated',
  trigger: { kind: 'event', name: 'row.updated', filter: { tableId: 'tjfacuh0u0ru' } },
  input: z.object({ tableId: z.string(), rowId: z.string() }),
  output: z.object({ assigned: z.boolean(), reason: z.string() }),
  async run({ input, ctx }) {
    const res = (await ctx.volty.rows.get({ tableId: LEADS, rowId: input.rowId })) as {
      row?: { fields: { next_step?: string | null; conversation?: string | null } }
      fields?: { next_step?: string | null; conversation?: string | null }
    }
    const f = res.row?.fields ?? res.fields ?? {}
    if (f.next_step !== 'Handed to strategist') return { assigned: false, reason: 'not handed off' }
    const conversationId = (f.conversation ?? '').trim().replace(/^cnv:/, '')
    if (!conversationId) return { assigned: false, reason: 'no conversation on row' }

    const conv = (await ctx.volty.conversations.get({ conversationId })) as { assigneeUserId?: string | null }
    if (conv.assigneeUserId) return { assigned: false, reason: 'already owned' }

    await ctx.volty.conversations.reassignUser({ ids: [conversationId], toUserId: STRATEGIST })
    return { assigned: true, reason: 'assigned strategist' }
  },
})
