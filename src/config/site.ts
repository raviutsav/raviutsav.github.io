export interface SiteConfig {
  name: string;
  title: string;
  description: string;
  author: string;
  url: string;
  locale: string;
  navLinks: { href: string; label: string }[];
  socialLinks: {
    github: string;
    linkedin: string;
  };
  googleAnalyticsId?: string;
  googleSiteVerification?: string;
  buttondownUsername?: string;
}

export const siteConfig: SiteConfig = {
  name: "Ravi Utsav",
  title: "Ravi Utsav — Essays, Notes & Writing",
  description: "A personal corner of the internet for essays, technical notes, and reflections on building enduring software and thoughtful living.",
  author: "Ravi Utsav",
  url: import.meta.env.SITE_URL || "https://raviutsav.github.io",
  locale: "en_US",
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
  // Google Search Console HTML meta tag verification token (optional)
  googleSiteVerification: import.meta.env.PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  // Buttondown newsletter username (set PUBLIC_BUTTONDOWN_USERNAME to override)
  buttondownUsername: import.meta.env.PUBLIC_BUTTONDOWN_USERNAME || "raviutsav",
};
