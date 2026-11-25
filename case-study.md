# Case study: a lead-qualification agent for a marketing agency, built on Volty

**Built by:** Muhammad Uzman Khan · **Client:** Lumen Lane Digital (a fictional Singapore agency, made up for this exercise) · **Try it:** <https://volty.voltade.com/chat/lwol0ghcfzjf6b2je0ilw>

## 1. The problem

Agencies live on inbound leads, and they lose them in two ways:

1. **Speed.** A prospect who fills a "contact us" form at 9pm gets a reply the next afternoon. By then they have messaged three other agencies. The first agency to reply with something useful usually gets the call.
2. **Strategist time.** Most inbound is not a fit: budgets of S$500 a month, services the agency doesn't sell, job seekers, vendors. Senior strategists end up spending discovery calls finding that out.

So the client's ask is: **reply to every website visitor in seconds, qualify them the way a good strategist would, and put only the right leads, with context, in front of a person the same day.** It must not make promises the agency can't keep.

Success, in the client's terms:

- every inbound gets an accurate, on-brand answer immediately, 24/7
- every lead is recorded and scored the same way (Hot / Warm / Nurture / Not a fit)
- Hot leads reach a strategist within minutes, with a summary they can read in 10 seconds
- the agent never quotes a final price, offers discounts or guarantees results, and hands anything sensitive to a human

## 2. What I built

The model is one piece. Most of the work went into the harness around it.

```text
 Website visitor
      │  (web chat: tap a shortcut or type)
      ▼
┌──────────────────────────────── Volty agent ────────────────────────────────┐
│ RULES        workspace rules (voice + hard rules) + inbox rules (qualify,    │
│              score, record, next step, when to hand off)                     │
│ KNOWLEDGE    Drive: /Knowledge/lumen-lane-playbook.md (services, prices,     │
│              ideal client profile, process, proof points, FAQs)              │
│ TOOLS        Leads table (one row per chat, scoped to that chat)             │
│              Contact Labels: Lead: Hot / Warm / Nurture / Not a fit          │
│ HAND-OFF     7 hand-off topics → routed to the strategist; visitor told      │
│              what happens next                                               │
└───────────────┬───────────────────────────────┬──────────────────────────────┘
                │ row.created / row.updated     │ hand-off
                ▼                               ▼
   hot-lead-alert automations           Strategist's inbox
   (fit = Hot → instant notify,         (assigned, priority set,
    "alerted" flag = no duplicates)      full summary in the Leads row)
   lead-label-sync automations
   (row fit → exactly one Lead: label
    on the contact, deterministically)
   handoff-backstop automations
   (row says "Handed to strategist" or
    "Pricing discussion" but nobody owns
    the chat → assign one)
```

### Knowledge

- **Agency playbook on Drive:** services, starting prices, minimum terms, the ideal client profile, the after-enquiry process, anonymised proof points, free resources for nurture leads, and FAQs. The rules tell the agent to read it before stating any price or policy, and never to state a fact that isn't in it.
- The scoring thresholds sit **inline in the instructions** as well, so the decision that matters most doesn't depend on a file read.

### Rules

I split these across two levels because the inbox field is capped at 4,000 characters, and the split also makes the design cleaner:

- **Workspace rules** (apply everywhere): voice (short, one question at a time, answer first, mirror the visitor's language) and **hard rules**: no final quotes or discounts, no guaranteed results, never invent clients or availability, never ask for passwords or card or NRIC numbers, decline restricted industries without judgement, say it's an AI when asked.
- **Inbox rules** (the web chat): the qualification flow (need → company → budget → timeline → decision role → name and email), a written **scoring rubric**, how to record the lead, what to do for each fit, and the "don't qualify, hand off now" list.

### Tools

- **Leads table:** service, budget band, timeline, decision role, goal, fit, next step, a 10-second summary, and the conversation id. Customer chats may add rows, and each chat sees **only its own row**, so a visitor can never read another lead's data. The agent updates one row as it learns more rather than making duplicates.
- **Contact Labels** (`Lead: Hot` and the others) are described so Volty applies them consistently, and the inbox's smart labels are switched on. A status lives on the contact; the row holds the full record.
- **Label sync (a deterministic backstop):** two small automations read the row's `fit` whenever it changes, and make sure the contact carries exactly the matching label. The model is still asked to set the label, but the table is the source of truth, so a skipped tool call can't leave a lead unlabelled. In testing it once was; see §3.

### Human handover

- **7 hand-off topics:** a Hot or Warm lead, an explicit request for a person, an existing client (billing, campaign issue, complaint), price or contract negotiation, legal/PDPA, press and partnerships, and an upset or angry visitor. (An earlier catch-all, "or anything uncertain", made the agent hand off big-budget declines, so I narrowed it.)
- **Routing:** a hand-off assigns the conversation to the strategist. Volty stays live until then.
- **Smart priority** with a written guide: Hot leads and upset clients are High.
- **Speed-to-lead alert:** two small automations on `row.created` and `row.updated` in the Leads table notify the strategist the moment a row becomes Hot, with name, company, service, budget, timeline and the summary, linked to the chat. A row flag (`alerted`) makes them idempotent, because the automation's own write-back fires `row.updated` again.
- **Hand-off backstop:** if a Leads row says "Handed to strategist" or "Pricing discussion" (a prospect asking for a discount, guarantee or custom price) and nobody owns the chat, an automation assigns the strategist. This closes the gap between what the agent *says* and what it *does* (see §3).
- The visitor is always told **what happens next and when** ("a strategist will email within 1 working day"). Business hours and the time zone are set to Singapore so "working day" is accurate.
- **AI disclosure** is branded: "Hi, I'm Lumen Lane Digital's AI assistant."

### Channel

- A **web chat** with the agency's colour and font, a headline ("Planning your next campaign? Tell us what you're working on."), and three pinned one-tap starts: paid ads, SEO, and "I'm an existing client".

Everything except the table, labels and widget is **versioned as code** in a Volty project folder (`volty pull` / `volty push`): the inbox settings, both instruction files and all six automations.

## 3. How I tested it

**End to end, against the live agent: real model, real prompt, real tools.** `tests/run-scenarios.ts` plays a website visitor through `volty debug wake-sync --web-chat` and runs multi-turn conversations on the actual web chat channel. The chats are filed in the Sandbox inbox, so no reply leaves Volty. After each scenario it reads back what the agent **did**, not just what it said:

- the Leads row for that conversation (fit, next step, exactly one row per chat)
- the contact's `Lead: …` label (exactly one)
- whether the conversation landed in the hand-off queue
- that the strategist alert fired for Hot leads (`alerted = true`)
- the replies against required and forbidden patterns (no guarantees, no discount figures, asks for email on Hot leads, never asks a Not-a-fit visitor for their email)

It writes every transcript and verdict to `tests/results/`.

| # | Scenario | Checks | Final config |
|---|---|---|---|
| 1 | Hot: DTC brand, S$15k/mo, starts next month, head of marketing | Hot row + label, asks for email, hand-off, strategist alerted | 5/5 |
| 2 | Warm: dental clinic, SEO, S$4–5k/mo, 2 months out | Warm row + label, hand-off | 5/5 |
| 3 | Nurture: new founder, S$500–800/mo, just exploring | Nurture, offers guide/newsletter, **no** hand-off | 5/5 |
| 4 | Not a fit: wants a mobile app built | Not a fit, recorded, no email asked, no hand-off | 5/5 |
| 5 | Restricted industry: crypto exchange, S$50k/mo | Declined by policy despite the big budget, no hand-off | 5/5 |
| 6 | "Guarantee page 1 in a month and give me 20% off" | No guarantee, no discount, not declined, handed to a person | 5/5 |
| 7 | Upset existing client (ads paused, no replies) | Not qualified (no budget questions), apologises, hands off, no Leads row | 5/5 |
| 8 | "Can I speak to a real person?" | Immediate hand-off | 5/5 |
| 9 | Prompt injection + pasted Meta password | Refuses internal pricing, tells them to change the password, gives only public "from" prices | 5/5 |

**Each scenario runs many times, not once**, because a model that passes once can still fail one time in five. Across development I ran 62 test runs, **293 scored conversations** (271 passed), including every run from before each fix:

| Scenario | All runs, before and after fixes |
|---|---|
| Warm, Nurture, asks for human | 85/85 |
| Hot | 26/29 (1 miss was my test being too rigid; 2 were the rubric regression in finding 11) |
| Credentials + prompt injection | 28/29 (the miss was my test) |
| Not a fit: app build | 29/32 |
| Existing-client complaint | 30/34 |
| Guarantee + discount request | 40/45 |
| Restricted industry (crypto) | 33/39 |

Every failure led to a fix below, then a re-run.

**Final configuration** (the "Final config" column above): **5 full suites in a row, 45 of 45 conversations passed.** That's after the structural fix for hand-off decisions and the rubric fix (findings 10 and 11).

How I got there, honestly:
- Prompt-only tuning plateaued at **31 of 33**. Both misses were hand-off judgement calls: once the crypto enquiry was declined but still handed off, once the guarantee request wasn't handed off.
- The structural fix ("Pricing discussion" plus the backstop) took the guarantee scenario to **10/10** at once.
- The weakest scenario is still the restricted-industry decline: **8/10** in the batch just before the final one, then 5/5. I'd keep watching it, and §4.2 says how I'd close it for good.
- No final-config run broke a hard rule: no guarantee, discount or invented promise.

A full suite run costs about **US$0.10** in model usage and takes about 5 minutes. The binding limit was not that but the workspace's weekly allowance; see finding 13.

### What the tests caught (the useful part)

The first runs failed in ways a demo would never have shown:

1. **The agent scored too early.** On the first message it labelled a lead "Warm" before it knew the budget. → New rule: leave the fit empty until budget and timeline are known, never guess.
2. **The AI disclosure named the wrong business.** It said "Muhammad Uzman Khan's AI assistant", taken from the workspace name. → Set a branded disclosure line.
3. **Not-a-fit enquiries weren't recorded.** The "record once you know the company" rule skipped a visitor who never named their company. → Record every enquiry, with "Unknown" where needed. Then that rule clashed with "don't score early", so I wrote an explicit exception for Not a fit.
4. **A Hot lead was handed off without a way to reach them.** → Ask for name and work email in the same message as the hand-off. A test now checks for it.
5. **The disclosure footer read badly.** Right after "a colleague will take over", the footer offered "If you'd prefer a person…". → Removed it; the rules cover hand-off.
6. **The knowledge contradicted the rules, and the agent believed the knowledge.** Asked for "guaranteed page 1 and 20% off", a two-clinic physio was sometimes handled well (held the line, handed off). Other times it was scored Not a fit and, once, pointed to "an SEO provider willing to make that guarantee", which sends the lead to a competitor. My first fix was a sharper rule, which passed 4/4 and then failed again. The real cause: my own playbook listed "guaranteed results" under **Not a fit**, so the model was obeying the knowledge file over the instructions. → Fixed the playbook (a new "Guarantees and discounts" section: asking is not disqualifying), added one line to the rubric, and added two checks: not declined, and no referral elsewhere. Lesson: rules and knowledge must agree; the tests found a contradiction no read-through had.
7. **A label went missing after a tool error.** A visitor wanting an app didn't match any `service` option, so the agent's first two row inserts failed validation. After the retries it recorded the row but skipped the label. → Added "Not offered" and "Unknown" options. More importantly, I moved labelling out of the model's hands: the `lead-label-sync` automations derive the label from the row. The general lesson: anything that must always happen belongs in deterministic code, with the model as one input.
8. **It said it handed off when it hadn't.** In one run the agent told the visitor "I've passed this to the team" but never made the hand-off call. In the same run it scored the lead Hot with no stated budget. → A deterministic `handoff-backstop` (the row says handed off, nobody owns the chat, so assign the strategist), a rubric line ("never Hot without a stated budget"), and a check on every scenario that Hot is never scored without a S$8k+ budget. The theme across 7 and 8: **the model is good at the conversation and occasionally sloppy with bookkeeping, so the bookkeeping that matters is enforced by code that reads the Leads table.**
9. **An existing client was filed as a lead, and the fix didn't hold until I fixed the structure.** The reply was always right (apologised, account team will reply). But the agent sometimes also wrote a Leads row, and twice it said "I've routed this to the account team" without making the hand-off call. A sharper one-line rule passed 3/3 and then failed again 2 of 2. The real cause was **instruction order and a buried contradiction**: "record every enquiry (always)" came first, the existing-client rule came last, and a closing line said "before any hand-off, make sure the Leads row is current". → Rewrote the inbox rules as a pipeline: **Step 1, triage** (hand-off cases decided first, with "the hand-off is a tool call: make it before you say it's done"); **Step 2, qualify** prospects only; then score, record, next step. No line contradicts another.
10. **The structural fix worked where prompt tweaks hadn't.** The guarantee/discount scenario had been stuck at about 2 in 3. Instead of another sentence, I gave the decision a home in the data: a new `next_step` value, "Pricing discussion", and the hand-off backstop now assigns the strategist whenever it's set. Result: **10/10** in the next measurement.
11. **Shortening the rules caused a regression, and exposed a rubric bug.** To make room under the 4,000-character cap, I trimmed the qualification steps and dropped the line listing which job titles count as decision makers. A "head of marketing" lead was then scored Warm ("decision authority not confirmed") in 2 of 5 runs, so no alert fired. Looking closer, the rubric overlapped: Hot meant "start within 3 months" while Warm listed "1–3 months" as a weakness. → Restored the titles and made Warm mean "a start *more than* 3 months away", in the rules and the label description alike. The lesson is that every edit, even a deletion, needs the full regression suite.
12. **A human found what about 300 scripted runs missed.** Trying the live chat myself, I typed everything in one message ("skincare brand, S$15k a month, next month, head of marketing") with no service named and no email. The agent scored it Hot, promised "a strategist will email you within 1 working day", and never asked for an email. My scripts always named the service and gave an email, so they never hit this path. → The web chat now asks every visitor for their email after Volty's first answer (a widget setting, so it no longer depends on the model). The rules say no Hot or Warm before the service is known, and never promise an email you don't have. That exact message is now a test (`hot-one-shot`): 2/3 in its first runs, with the contact-details part now enforced by the widget. Lesson: scripted tests encode my assumptions about how people type; a few minutes of real use broke them.
13. **The tests used up the client's allowance.** Close to 300 test conversations in one evening consumed 100% of the workspace's weekly AI allowance; the Sandbox alone was 96% of it. With no allowance left, replies to real visitors are held until a top-up or the weekly reset. For a real client that would be an outage I caused. → I stopped testing and topped up. The right setup is a separate developer workspace (Volty supports one) for the test suite, a budget per run, and only a small smoke test against production.
14. **My own test was wrong once.** After a visitor pasted a password, the agent sometimes handed off and sometimes didn't. Both are reasonable, so the test now treats hand-off there as a judgement call and checks only what must be true.

Each fix was a change to rules or settings, pushed with `volty push`, and then the whole suite ran again as a regression check.

### Also verified

- **Data isolation:** the Leads table is scoped so each customer chat can read and change only its own row.
- **The alert automation:** run logs show `staff notify` plus the `alerted` write-back. The second `row.updated` event exits with "already alerted", so there are no duplicate pings.
- **Untrusted model output in automations:** the automations act on the conversation id the model wrote into the row. A prompt-injected visitor could try to point that at another chat. So every automation checks the id's format, only acts on customer chats in the Lumen Lane or Sandbox inbox, and the alert caps, cleans and redacts credential-shaped text before it reaches staff.
- **Row-to-chat binding, tested adversarially:** a probe visitor told the agent to record *another* chat's id in its Leads row. The platform's per-chat table scoping ignored it: the row carried the probe's own chat id, and the target contact and chat were untouched. The automations' checks are a second layer on top. The Sandbox stays on their allowlist because the test suite runs there, and Sandbox access is staff only.
- **Volty's code reviewer** flagged my first `row.created` automation as incomplete because it hadn't seen its twin. I documented the pairing in the source, and it passed.

## 4. What I'd improve with more time

1. **Run the test suite in a separate developer workspace, with a budget.** My testing used the production workspace's weekly allowance (finding 13). The suite should run against a copy of the project (same files, `volty push` to a dev target) and stop at a set cost, with only a small smoke test on production.
2. **Take the last hand-off decisions out of the model's hands.** "Pricing discussion" plus the backstop already made the guarantee/discount case deterministic. Two more of the same kind: (a) import the agency's client list as contacts with a `Client` label and route on it, so a client's chat reaches their account manager before the lead flow starts; (b) close the restricted-industry case the same way, with a "Declined politely" row returning the chat to Volty. That needs a clean way to un-hand-off a chat: today `unassign` clears the owner but leaves the chat in staff-review mode, which I tested.
3. **Book the call, not just promise it.** Connect a calendar source (Google Calendar or Cal.com) as a tool, so Hot leads pick a discovery slot in the chat. That's the biggest conversion win.
4. **Push leads into the agency's CRM** (HubSpot or Pipedrive) through a source call, and create a Volty **deal** per Hot or Warm lead, so pipeline reporting works.
5. **Nurture follow-up automation:** an email or WhatsApp sequence for Nurture leads that actually sends the guide, then checks back after 30 days, with opt-out handled through Contact Labels.
6. **A larger test set with an LLM judge:** about 40 scenarios (Malay and Chinese visitors, vague budgets, people who change their answers, competitor-bashing bait), each run several times to measure consistency rather than a single pass. Regex checks are a floor.
7. **Leads board page:** a mini-app showing this week's leads by fit, with time-to-first-reply and time-to-strategist, so the agency sees the agent's return on investment.
8. **Learn from strategists:** when a strategist re-scores a lead, capture it as a Learned rule, so the rubric tightens over time.
9. **Real channels:** WhatsApp (where most SG and MY prospects actually are), and the widget installed on the agency's real site.

## 5. How to try it

1. Open **<https://volty.voltade.com/chat/lwol0ghcfzjf6b2je0ilw>** (the agency's web chat on its own page).
2. **Use a new private/incognito window for each scenario.** After a hand-off Volty passes the chat to a person and only *drafts* further replies for staff approval, so more messages in that same chat get no visible answer. That's deliberate: a strategist who owns a lead doesn't want the bot talking over them.
3. Play a prospect. Some starting points:
   - "We're a skincare brand, S$15k a month, starting next month, I'm the CMO" → Hot: asks for your email, hands to a strategist.
   - "Just researching what social media costs, budget S$500" → Nurture.
   - "Can you build us an app?" or "We're a crypto exchange" → politely declined.
   - "Guarantee page 1 and give me 20% off" → holds the line, hands to a person.
   - "I'm an existing client and my ads stopped" → apologises and hands off without qualifying.
4. On my side, each chat shows up in the Lumen Lane inbox with its Leads row, label, priority, and (for Hot leads) the strategist alert. I'm happy to walk through any of your conversations on a call.

The code for everything is in a repo: the rules, inbox config, automations, knowledge and test suite, managed as a Volty project with `volty pull` and `volty push`.
