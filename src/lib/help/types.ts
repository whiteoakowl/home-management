import type { Module } from "@/db/schema/_shared";

/**
 * Help Center content model. Articles are plain data (src/lib/help/articles/*),
 * so adding or updating help never needs new code. Text may use **bold** for
 * button and menu names.
 */
export type HelpCategoryKey =
  | "getting-started"
  | "account"
  | "family"
  | "calendar"
  | "chores"
  | "food"
  | "lists"
  | "communication"
  | "activities"
  | "home"
  | "memories"
  | "garden-pets"
  | "health"
  | "personal"
  | "spiritual"
  | "trips"
  | "money"
  | "notifications"
  | "billing"
  | "troubleshooting";

export type HelpCategory = { key: HelpCategoryKey; title: string; description: string; icon: string };

/** Who an article is for. "parents": parent accounts; "owner": the family's account holder. */
export type HelpAudience = "everyone" | "parents" | "owner";

export type HelpSection = {
  heading: string;
  body?: string;
  steps?: string[];
  bullets?: string[];
};

export type HelpArticle = {
  slug: string;
  category: HelpCategoryKey;
  title: string;
  /** One line shown in lists and search results. */
  summary: string;
  /** Extra words people might search for. */
  keywords?: string[];
  audience?: HelpAudience;
  /** Shown only to people who can open at least one of these sections. Omit for everyone. */
  modules?: Module[];
  /** Main numbered steps. */
  steps?: string[];
  /** Further sections: options on the screen, tips, privacy notes. */
  sections?: HelpSection[];
  /** A button to open the right place in the app. */
  openIn?: { label: string; href: string };
  related?: string[];
};

export type HelpFaq = { q: string; a: string; slug?: string; audience?: HelpAudience; modules?: Module[] };
