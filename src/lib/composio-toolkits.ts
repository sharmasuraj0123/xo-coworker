/**
 * Static metadata for the Composio toolkits we surface in the UI.
 * Backend authoritative status comes from /api/connectors/composio/toolkits;
 * this file owns presentation (display name, description, icon hint).
 */

export type ComposioScheme = "OAUTH2" | "API_KEY";

/** Tool category used by the connectors grid filter. Presentation-only. */
export type ConnectorCategory =
  | "productivity"
  | "communication"
  | "social"
  | "design"
  | "dev"
  | "storage"
  | "finance"
  | "ai"
  | "analytics"
  | "other";

/** Ordered labels for the category dropdown (insertion order = display order). */
export const CONNECTOR_CATEGORY_LABELS: Record<ConnectorCategory, string> = {
  productivity: "Productivity",
  communication: "Communication",
  social: "Social & Media",
  design: "Design",
  dev: "Dev & Cloud",
  storage: "Storage",
  finance: "Finance & Commerce",
  ai: "AI & Media",
  analytics: "Analytics & Sales",
  other: "Other",
};

/** Category for the hardcoded custom connector tiles, keyed by their tile id. */
export const CUSTOM_CONNECTOR_CATEGORY: Record<string, ConnectorCategory> = {
  gdrive: "storage",
  onedrive: "storage",
  github: "dev",
  vercel: "dev",
  manus: "ai",
};

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
  category: ConnectorCategory;
};

export const COMPOSIO_TOOLKITS: ComposioToolkitMeta[] = [
  {
    id: "gmail",
    slug: "GMAIL",
    displayName: "Gmail",
    description: "Send and read emails on the user's behalf.",
    schemes: ["OAUTH2"],
    iconKey: "logos/google-gmail",
    category: "communication",
  },
  {
    id: "googlecalendar",
    slug: "GOOGLECALENDAR",
    displayName: "Google Calendar",
    description: "Create events, check availability, manage invites.",
    schemes: ["OAUTH2"],
    iconKey: "logos/google-calendar",
    category: "productivity",
  },
  {
    id: "notion",
    slug: "NOTION",
    displayName: "Notion",
    description: "Read pages, create entries, manage databases.",
    schemes: ["OAUTH2"],
    iconKey: "logos/notion-icon",
    category: "productivity",
  },
  {
    id: "stripe",
    slug: "STRIPE",
    displayName: "Stripe",
    description: "Customers, charges, invoices, payment intents.",
    schemes: ["OAUTH2", "API_KEY"],
    iconKey: "logos/stripe",
    category: "finance",
  },
  {
    id: "supabase",
    slug: "SUPABASE",
    displayName: "Supabase",
    description: "Query Postgres, manage tables, auth users.",
    schemes: ["API_KEY"],
    iconKey: "logos/supabase-icon",
    category: "dev",
  },
  {
    id: "digitalocean",
    slug: "DIGITALOCEAN",
    displayName: "DigitalOcean",
    description: "Droplets, volumes, billing, monitoring.",
    schemes: ["API_KEY"],
    iconKey: "logos/digital-ocean-icon",
    category: "dev",
  },
  {
    id: "youtube",
    slug: "YOUTUBE",
    displayName: "YouTube",
    description: "Search videos, channels, playlists.",
    schemes: ["OAUTH2"],
    iconKey: "logos/youtube-icon",
    category: "social",
  },
  {
    id: "miro",
    slug: "MIRO",
    displayName: "Miro",
    description: "Boards, sticky notes, frames.",
    schemes: ["OAUTH2"],
    iconKey: "logos/miro-icon",
    category: "design",
  },
  {
    id: "canva",
    slug: "CANVA",
    displayName: "Canva",
    description: "Designs, brand templates, assets.",
    schemes: ["OAUTH2"],
    iconKey: "devicon/canva",
    category: "design",
  },
  {
    id: "googlesheets",
    slug: "GOOGLESHEETS",
    displayName: "Google Sheets",
    description: "Read and write spreadsheets on the user's behalf.",
    schemes: ["OAUTH2"],
    iconKey: "/icons/google-sheets.svg",
    category: "productivity",
  },
  {
    id: "googledocs",
    slug: "GOOGLEDOCS",
    displayName: "Google Docs",
    description: "Create, read, and edit documents.",
    schemes: ["OAUTH2"],
    iconKey: "/icons/google-docs.svg",
    category: "productivity",
  },
  {
    id: "googleslides",
    slug: "GOOGLESLIDES",
    displayName: "Google Slides",
    description: "Build and edit slide decks.",
    schemes: ["OAUTH2"],
    iconKey: "/icons/google-slides.svg",
    category: "productivity",
  },
  {
    id: "googlemeet",
    slug: "GOOGLEMEET",
    displayName: "Google Meet",
    description: "Schedule and manage video meetings.",
    schemes: ["OAUTH2"],
    iconKey: "logos/google-meet",
    category: "communication",
  },
  {
    id: "instagram",
    slug: "INSTAGRAM",
    displayName: "Instagram",
    description: "Post media and read account insights.",
    schemes: ["OAUTH2"],
    iconKey: "skill-icons/instagram",
    category: "social",
  },
  {
    id: "linkedin",
    slug: "LINKEDIN",
    displayName: "LinkedIn",
    description: "Share posts and read profile data.",
    schemes: ["OAUTH2"],
    iconKey: "logos/linkedin-icon",
    category: "social",
  },
  {
    id: "twitter",
    slug: "TWITTER",
    displayName: "Twitter / X",
    description: "Post tweets and read timelines.",
    schemes: ["OAUTH2"],
    iconKey: "simple-icons/x?color=ffffff",
    category: "social",
  },
  {
    id: "reddit",
    slug: "REDDIT",
    displayName: "Reddit",
    description: "Read subreddits and submit posts.",
    schemes: ["OAUTH2"],
    iconKey: "logos/reddit-icon",
    category: "social",
  },
  {
    id: "shopify",
    slug: "SHOPIFY",
    displayName: "Shopify",
    description: "Products, orders, customers, inventory.",
    schemes: ["OAUTH2"],
    iconKey: "logos/shopify",
    category: "finance",
  },
  {
    id: "excel",
    slug: "EXCEL",
    displayName: "Excel",
    description: "Read and write Microsoft Excel workbooks.",
    schemes: ["OAUTH2"],
    iconKey: "vscode-icons/file-type-excel",
    category: "productivity",
  },
  {
    id: "elevenlabs",
    slug: "ELEVENLABS",
    displayName: "ElevenLabs",
    description: "Text-to-speech and voice cloning.",
    schemes: ["API_KEY"],
    iconKey: "simple-icons/elevenlabs?color=ffffff",
    category: "ai",
  },
  {
    id: "figma",
    slug: "FIGMA",
    displayName: "Figma",
    description: "Files, frames, comments, exports.",
    schemes: ["OAUTH2"],
    iconKey: "logos/figma",
    category: "design",
  },
  {
    id: "cloudflare",
    slug: "CLOUDFLARE",
    displayName: "Cloudflare",
    description: "DNS, Workers, R2, caching, analytics.",
    schemes: ["API_KEY"],
    iconKey: "logos/cloudflare-icon",
    category: "dev",
  },
  {
    id: "clickup",
    slug: "CLICKUP",
    displayName: "ClickUp",
    description: "Tasks, lists, docs, time tracking.",
    schemes: ["OAUTH2"],
    iconKey: "simple-icons/clickup?color=7B68EE",
    category: "productivity",
  },
  {
    id: "apollo",
    slug: "APOLLO",
    displayName: "Apollo",
    description: "Sales prospecting and contact enrichment.",
    schemes: ["API_KEY"],
    iconKey: "simple-icons/apollographql?color=ffffff",
    category: "analytics",
  },
  {
    id: "dropbox",
    slug: "DROPBOX",
    displayName: "Dropbox",
    description: "Files, folders, shared links.",
    schemes: ["OAUTH2"],
    iconKey: "logos/dropbox",
    category: "storage",
  },
  {
    id: "coinbase",
    slug: "COINBASE",
    displayName: "Coinbase",
    description: "Accounts, balances, transactions.",
    schemes: ["API_KEY"],
    iconKey: "token-branded/coinbase",
    category: "finance",
  },
  {
    id: "posthog",
    slug: "POSTHOG",
    displayName: "PostHog",
    description: "Events, dashboards, feature flags.",
    schemes: ["API_KEY"],
    iconKey: "logos/posthog-icon",
    category: "analytics",
  },
];

export function findToolkitMeta(id: string): ComposioToolkitMeta | undefined {
  return COMPOSIO_TOOLKITS.find((t) => t.id === id);
}
