# Lumen Lane lead-qualification agent (Volty)

An inbound lead-qualification agent for **Lumen Lane Digital**, a fictional Singapore marketing agency, built on [Volty](https://volty.voltade.com) as a take-home for Volty's customer-facing SWE role.

- **Try it:** <https://volty.voltade.com/chat/lwol0ghcfzjf6b2je0ilw>
- **Case study:** [case-study.md](case-study.md)
- **How to test it:** [TESTING.md](TESTING.md)

## Layout

| Path | What it is |
|---|---|
| `workspace/` | The Volty project folder (`volty pull` / `volty push`) |
| `workspace/instructions/org.md` | Workspace rules: voice and hard rules |
| `workspace/inboxes/lumen-lane-digital/instructions.md` | Inbox rules: qualify, score, record, hand off |
| `workspace/inboxes/**lumen**-lane-digital/inbox.ts` | Hand-off topics, **smart** priority and labels, routing, web chat look |
| `workspace/automations/hot-lead-alert-*.ts` | Speed-to-lead alert when a Leads row becomes Hot |
| `workspace/automations/lead-label-sync-*.ts` | Keeps the contact's `Lead: …` label in step with the row's fit |
| `knowledge/lumen-lane-playbook.md` | Agency knowledge, uploaded to Drive at `/Knowledge/` |
| `tests/run-scenarios.ts` | End-to-end scenario suite against the live agent |
| `tests/results/` | Transcripts and verdicts from each run |

Not held as files, because they were made with the CLI: the Leads table (`tbl:tjfacuh0u0ru`), the four `Lead: …` Contact Labels, the web chat widget and its shortcuts, the routing rule, the AI disclosure line, and the workspace time zone and business hours.

## Run it

```bash
bun add -g @voltade/volty && volty auth login --env prod
export VOLTY_ENV=prod VOLTY_ORG=vj51tetei79n

cd workspace && bun install && bunx tsc -p tsconfig.code.json
volty push --dry-run && volty push      # deploy rules, inbox settings, automations

cd .. && bun tests/run-scenarios.ts     # all scenarios
bun tests/run-scenarios.ts hot-dtc-ads  # one scenario
```

The tests talk to the real agent as synthetic web chat visitors. Their chats are filed in the Sandbox inbox, and no reply leaves Volty.
