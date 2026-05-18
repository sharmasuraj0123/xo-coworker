/**
 * Static metadata for the nine Composio toolkits we surface in the UI.
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
];

export function findToolkitMeta(id: string): ComposioToolkitMeta | undefined {
  return COMPOSIO_TOOLKITS.find((t) => t.id === id);
}
