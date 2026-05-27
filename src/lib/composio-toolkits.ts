/**
 * Static metadata for the Composio toolkits we surface in the UI.
 * Backend authoritative status comes from /api/connectors/composio/toolkits;
 * this file owns presentation (display name, description, icon hint).
 */

export type ComposioScheme = "OAUTH2" | "API_KEY";

export type ComposioToolkitMeta = {
  /** lowercase id used in URLs and the backend TOOLKITS map. */
  id: string;
  /** Composio's uppercase slug (matches the SDK toolkit field). */
  slug: string;
  displayName: string;
  description: string;
  schemes: ComposioScheme[];
  /** Iconify reference in `set/name` form (e.g. `logos/gmail`). */
  iconKey: string;
};

export const COMPOSIO_TOOLKITS: ComposioToolkitMeta[] = [
  {
    id: "gmail",
    slug: "GMAIL",
    displayName: "Gmail",
    description: "Send and read emails on the user's behalf.",
    schemes: ["OAUTH2"],
    iconKey: "logos/google-gmail",
  },
  {
    id: "googlecalendar",
    slug: "GOOGLECALENDAR",
    displayName: "Google Calendar",
    description: "Create events, check availability, manage invites.",
    schemes: ["OAUTH2"],
    iconKey: "logos/google-calendar",
  },
  {
    id: "notion",
    slug: "NOTION",
    displayName: "Notion",
    description: "Read pages, create entries, manage databases.",
    schemes: ["OAUTH2"],
    iconKey: "logos/notion-icon",
  },
  {
    id: "stripe",
    slug: "STRIPE",
    displayName: "Stripe",
    description: "Customers, charges, invoices, payment intents.",
    schemes: ["OAUTH2", "API_KEY"],
    iconKey: "logos/stripe",
  },
  {
    id: "supabase",
    slug: "SUPABASE",
    displayName: "Supabase",
    description: "Query Postgres, manage tables, auth users.",
    schemes: ["API_KEY"],
    iconKey: "logos/supabase-icon",
  },
  {
    id: "digitalocean",
    slug: "DIGITALOCEAN",
    displayName: "DigitalOcean",
    description: "Droplets, volumes, billing, monitoring.",
    schemes: ["API_KEY"],
    iconKey: "logos/digital-ocean-icon",
  },
  {
    id: "youtube",
    slug: "YOUTUBE",
    displayName: "YouTube",
    description: "Search videos, channels, playlists.",
    schemes: ["OAUTH2"],
    iconKey: "logos/youtube-icon",
  },
  {
    id: "miro",
    slug: "MIRO",
    displayName: "Miro",
    description: "Boards, sticky notes, frames.",
    schemes: ["OAUTH2"],
    iconKey: "logos/miro-icon",
  },
  {
    id: "canva",
    slug: "CANVA",
    displayName: "Canva",
    description: "Designs, brand templates, assets.",
    schemes: ["OAUTH2"],
    iconKey: "devicon/canva",
  },
  {
    id: "googlesheets",
    slug: "GOOGLESHEETS",
    displayName: "Google Sheets",
    description: "Read and write spreadsheets on the user's behalf.",
    schemes: ["OAUTH2"],
    iconKey: "/icons/google-sheets.svg",
  },
  {
    id: "googledocs",
    slug: "GOOGLEDOCS",
    displayName: "Google Docs",
    description: "Create, read, and edit documents.",
    schemes: ["OAUTH2"],
    iconKey: "/icons/google-docs.svg",
  },
  {
    id: "googleslides",
    slug: "GOOGLESLIDES",
    displayName: "Google Slides",
    description: "Build and edit slide decks.",
    schemes: ["OAUTH2"],
    iconKey: "/icons/google-slides.svg",
  },
  {
    id: "googlemeet",
    slug: "GOOGLEMEET",
    displayName: "Google Meet",
    description: "Schedule and manage video meetings.",
    schemes: ["OAUTH2"],
    iconKey: "logos/google-meet",
  },
  {
    id: "instagram",
    slug: "INSTAGRAM",
    displayName: "Instagram",
    description: "Post media and read account insights.",
    schemes: ["OAUTH2"],
    iconKey: "skill-icons/instagram",
  },
  {
    id: "linkedin",
    slug: "LINKEDIN",
    displayName: "LinkedIn",
    description: "Share posts and read profile data.",
    schemes: ["OAUTH2"],
    iconKey: "logos/linkedin-icon",
  },
  {
    id: "twitter",
    slug: "TWITTER",
    displayName: "Twitter / X",
    description: "Post tweets and read timelines.",
    schemes: ["OAUTH2"],
    iconKey: "simple-icons/x?color=ffffff",
  },
  {
    id: "reddit",
    slug: "REDDIT",
    displayName: "Reddit",
    description: "Read subreddits and submit posts.",
    schemes: ["OAUTH2"],
    iconKey: "logos/reddit-icon",
  },
  {
    id: "shopify",
    slug: "SHOPIFY",
    displayName: "Shopify",
    description: "Products, orders, customers, inventory.",
    schemes: ["OAUTH2"],
    iconKey: "logos/shopify",
  },
  {
    id: "excel",
    slug: "EXCEL",
    displayName: "Excel",
    description: "Read and write Microsoft Excel workbooks.",
    schemes: ["API_KEY"],
    iconKey: "vscode-icons/file-type-excel",
  },
  {
    id: "elevenlabs",
    slug: "ELEVENLABS",
    displayName: "ElevenLabs",
    description: "Text-to-speech and voice cloning.",
    schemes: ["API_KEY"],
    iconKey: "simple-icons/elevenlabs?color=ffffff",
  },
  {
    id: "figma",
    slug: "FIGMA",
    displayName: "Figma",
    description: "Files, frames, comments, exports.",
    schemes: ["API_KEY"],
    iconKey: "logos/figma",
  },
  {
    id: "cloudflare",
    slug: "CLOUDFLARE",
    displayName: "Cloudflare",
    description: "DNS, Workers, R2, caching, analytics.",
    schemes: ["API_KEY"],
    iconKey: "logos/cloudflare-icon",
  },
  {
    id: "clickup",
    slug: "CLICKUP",
    displayName: "ClickUp",
    description: "Tasks, lists, docs, time tracking.",
    schemes: ["API_KEY"],
    iconKey: "simple-icons/clickup?color=7B68EE",
  },
  {
    id: "apollo",
    slug: "APOLLO",
    displayName: "Apollo",
    description: "Sales prospecting and contact enrichment.",
    schemes: ["API_KEY"],
    iconKey: "simple-icons/apollographql?color=ffffff",
  },
  {
    id: "dropbox",
    slug: "DROPBOX",
    displayName: "Dropbox",
    description: "Files, folders, shared links.",
    schemes: ["API_KEY"],
    iconKey: "logos/dropbox",
  },
  {
    id: "coinbase",
    slug: "COINBASE",
    displayName: "Coinbase",
    description: "Accounts, balances, transactions.",
    schemes: ["API_KEY"],
    iconKey: "token-branded/coinbase",
  },
  {
    id: "posthog",
    slug: "POSTHOG",
    displayName: "PostHog",
    description: "Events, dashboards, feature flags.",
    schemes: ["API_KEY"],
    iconKey: "logos/posthog-icon",
  },
];

export function findToolkitMeta(id: string): ComposioToolkitMeta | undefined {
  return COMPOSIO_TOOLKITS.find((t) => t.id === id);
}
