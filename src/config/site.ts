export interface SiteConfig {
  name: string;
  title: string;
  description: string;
  author: string;
  url: string;
  navLinks: { href: string; label: string }[];
  socialLinks: {
    github: string;
    linkedin: string;
  };
  googleAnalyticsId?: string;
}

export const siteConfig: SiteConfig = {
  name: "Ravi Utsav",
  title: "Ravi Utsav — Essays, Notes & Writing",
  description: "A personal corner of the internet for essays, technical notes, and reflections on building enduring software and thoughtful living.",
  author: "Ravi Utsav",
  url: import.meta.env.SITE_URL || "https://raviutsav.github.io",
  navLinks: [
    { href: "/", label: "Home" },
    { href: "/writing", label: "Writing" },
    { href: "/about", label: "About" },
  ],
  socialLinks: {
    github: "https://github.com/raviutsav",
    linkedin: "https://linkedin.com/in/raviutsav",
  },
  // GA4 Measurement ID: Configured via environment variable (or GitHub Secret in CI)
  // Never hardcoded in git to prevent accidental exposure or unauthorized usage
  googleAnalyticsId: import.meta.env.PUBLIC_GA_MEASUREMENT_ID || undefined,
};
