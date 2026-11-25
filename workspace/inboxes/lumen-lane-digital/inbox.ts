// The Lumen Lane Digital inbox: hours, reply targets, hand-off, priority guide, routing, Volty's reply mode and its web chat.
// Written by volty pull from the live inbox. Who works the inbox, team members and channels stay in the app.
import { defineInbox } from '~/inbox'

export default defineInbox({
  name: "Lumen Lane Digital",
  icon: {
    kind: "emoji",
    value: "💡",
  },
  autoEnrollOrgMembers: false,
  businessHours: null,
  idleClose: {
    afterMinutes: 1440,
    owned: false,
  },
  firstResponseMinutes: 60,
  handoff: {
    targetMinutes: 240,
    topics: [
      "Hot or Warm lead (never a Not a fit one)",
      "Visitor asks for a human, a call or a named person",
      "Existing client: billing, campaign, report or complaint",
      "Discount, guarantee or price negotiation request",
      "Legal, privacy (PDPA), data deletion or disputes",
      "Press, partnership, sponsorship or speaking enquiry",
      "Upset or angry visitor",
    ],
    tellContact: true,
  },
  priority: {
    smartPriority: "on",
    smartSegments: "on",
    guide: {
      high: "A Hot lead (S$8k+/month or a S$15k+ project, starting within 3 months, decision maker), or an upset existing client.",
      medium: "A Warm lead, or an existing client's routine question, or a partnership or press enquiry.",
      low: "Nurture leads, Not a fit enquiries, job seekers, vendors and spam.",
    },
  },
  routing: {
    mode: "rules_only",
    policy: null,
    openCap: null,
    rules: [
      {
        enabled: true,
        condition: {
          kind: "always",
        },
        action: {
          kind: "assign_member",
          member: "muzmankh@gmail.com",
        },
      },
    ],
  },
  volty: {
    agent: "Volty",
    defaultResponder: true,
    replyMode: "live",
    afterHoursReplyMode: null,
    window: null,
    liveForNewContacts: false,
    stepBackMinutes: 30,
    newContactWindowDays: null,
    waitExtends: false,
    selfStepDown: null,
  },
  webChat: {
    name: "Lumen Lane Digital",
    cardTitle: "Lumen Lane Digital",
    launcherLabel: "Talk to us",
    icon: "chat",
    greeting: "Hi there 👋 How can we help?",
    prefillBody: "Hi, I saw {page} on your website and would like to know more.",
    prefillFallback: "Hi, I saw your website and would like to know more.",
    primaryColor: "#5B4CF5",
    position: "bottom-right",
    defaultCountry: "SG",
    allowedDomains: [
      "lumenlane.example.com",
    ],
    font: "dm-sans",
    showBranding: true,
    googleAnalytics: false,
    logo: null,
    requireEmailCode: false,
    verifyPhone: false,
    verifyEmail: false,
    handoffWhatsapp: true,
    handoffEmail: true,
    askTiming: "after",
    headline: {
      first: null,
      second: "Planning your next campaign? Tell us what you're working on.",
    },
    openingStyle: "letter",
    heroImage: null,
    lookMatched: false,
    startName: "off",
    startEmail: "off",
    startPhone: "off",
    startFields: [],
    handoffWhatsappNumber: null,
    handoffEmailAddress: null,
  },
  quickPaths: {
    enabled: false,
    channels: [
      "web",
    ],
  },
})
