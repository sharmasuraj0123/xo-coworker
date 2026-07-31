/**
 * Static metadata for the nine Composio toolkits we surface in the UI.
 * Backend authoritative status comes from /api/connectors/composio/toolkits;
 * this file owns presentation (display name, description, icon hint).
 *
 * Ids here MUST exist in the backend `TOOLKITS` map
 * (xo-cowork-api services/composio/service.py). A card whose id the backend
 * does not return is filtered out by ComposioCards rather than rendered as a
 * dead "Connect" button.
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
    id: "googlesheets",
    slug: "GOOGLESHEETS",
    displayName: "Google Sheets",
    description: "Read and write spreadsheets, rows, and formulas.",
    schemes: ["OAUTH2"],
    iconKey: "selfhst/google-sheets",
  },
  {
    id: "googledocs",
    slug: "GOOGLEDOCS",
    displayName: "Google Docs",
    description: "Create and edit documents, insert and format content.",
    schemes: ["OAUTH2"],
    iconKey: "selfhst/google-docs",
  },
  {
    id: "googleslides",
    slug: "GOOGLESLIDES",
    displayName: "Google Slides",
    description: "Build decks, add slides, update shapes and text.",
    schemes: ["OAUTH2"],
    iconKey: "selfhst/google-slides",
  },
  {
    id: "googlemeet",
    slug: "GOOGLEMEET",
    displayName: "Google Meet",
    description: "Create meetings, fetch recordings and transcripts.",
    schemes: ["OAUTH2"],
    iconKey: "logos/google-meet",
  },
  {
    id: "figma",
    slug: "FIGMA",
    displayName: "Figma",
    description: "Read files, frames, comments, and component metadata.",
    schemes: ["OAUTH2"],
    iconKey: "logos/figma",
  },
  {
    id: "browserbase",
    slug: "BROWSERBASE_TOOL",
    displayName: "Browserbase",
    description: "Drive a headless browser session to scrape or automate.",
    schemes: ["API_KEY"],
    iconKey: "twemoji/globe-with-meridians",
  },
];

export function findToolkitMeta(id: string): ComposioToolkitMeta | undefined {
  return COMPOSIO_TOOLKITS.find((t) => t.id === id);
}
