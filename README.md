# Minimal Personal Blog & Writing Website

An editorial, typography-focused personal website designed for writing and publishing essays, technical notes, and personal reflections. Built with **Astro**, **TypeScript**, and **Vanilla CSS**.

---

## Aesthetic & Design Principles

- **Typography First:** Uses **Newsreader** (an editorial serif) for comfortable long-form reading, **Plus Jakarta Sans** for crisp navigational accents, and **JetBrains Mono** for technical code blocks.
- **Warm Archival Palette:** Natural paper backgrounds (`#fcfbf9`) paired with high-contrast warm ink (`#1c1917`) and a subtle terracotta accent (`#a83f21`).
- **Reading Comfort:** Generous line heights (1.75–1.8), optimal reading column width (~680px / 65–75 characters per line), and dual-theme dark mode support.
- **Zero Client Bloat:** 100% static HTML generation, minimal client JavaScript, and zero external UI component libraries.

---

## Website Structure

- **Home (`/`)**: Wordmark, understated personal introduction, recent writing section, and minimal footer.
- **Writing (`/writing`)**: Complete chronological archive with instant, zero-dependency search and tag filtering.
- **Individual Post (`/writing/[slug]`)**: Reading-optimized layout with breadcrumb navigation, publication metadata, automatic reading time, syntax-highlighted code blocks, tables, blockquotes, and previous/next article navigation.
- **About (`/about`)**: Biography, core interests, stack colophon, and contact links (GitHub and LinkedIn).
- **404 (`/404`)**: Clean, helpful page for missing URLs.
- **Sitemap (`/sitemap-index.xml`)**: Automatic search engine sitemap.

---

## Getting Started

### Prerequisites

- Node.js (v18.17.0 or v20+)
- npm

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the local development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:4321](http://localhost:4321) in your browser.

3. Build for production:
   ```bash
   npm run build
   ```

4. Preview the static production build locally:
   ```bash
   npm run preview
   ```

---

## Publishing Workflow: How to Add a New Post

Writing an article requires only creating a Markdown file in `src/content/blog/`:

1. Create a new `.md` file, e.g. `src/content/blog/my-new-essay.md`:
   ```markdown
   ---
   title: "Your Essay Title Here"
   description: "A one or two sentence summary of your piece."
   pubDate: 2026-10-23
   tags: ["Engineering", "Reflections"]
   featured: false
   draft: false
   ---

   Write your article in standard Markdown here.

   ## Section Heading

   Paragraph text with comfortable typography, **bold text**, *italic text*, and [links](https://example.com).

   > Blockquotes for reflections or quotes.

   ```typescript
   // Code blocks automatically get syntax highlighting
   const greeting = "Hello, world!";
   ```
   ```

2. **Frontmatter fields**:
   - `title` *(required)*: The post's title.
   - `description` *(required)*: A concise summary used in post listings and Open Graph SEO tags.
   - `pubDate` *(required)*: Publication date (format: `YYYY-MM-DD`).
   - `updatedDate` *(optional)*: Last modified date.
   - `tags` *(optional)*: List of tags for categorization (e.g. `["Architecture", "Notes"]`).
   - `featured` *(optional)*: Set `true` to highlight on the homepage.
   - `draft` *(optional)*: Set `true` to hide the post from production builds.

3. Reading time is automatically calculated for every article based on word count.

---

## Google Analytics 4 (GA4) Configuration

The website includes native support for Google Analytics 4 that remains completely inactive unless you provide an ID.

### 1. Create a GA4 Property
1. Go to [Google Analytics](https://analytics.google.com/) and sign in.
2. Click **Admin** (gear icon in the bottom left) &rarr; **Create** &rarr; **Property**.
3. Name your property (e.g. *Personal Blog*) and select your reporting time zone and currency.
4. Under **Data Streams**, choose **Web**.
5. Enter your website URL (e.g. `https://raviutsav.github.io`) and a stream name (e.g. *Personal Blog Web*).
6. Click **Create Stream**. Copy the **Measurement ID** (it starts with `G-`, e.g. `G-XXXXXXXXXX`).

### 2. Configure the Measurement ID

- **Locally:** Create a `.env` file in the root directory:
  ```env
  PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
  ```
- **In GitHub Actions (Deployment):**
  1. In your GitHub repository, go to **Settings** &rarr; **Secrets and variables** &rarr; **Actions**.
  2. Click **New repository secret**.
  3. Name: `PUBLIC_GA_MEASUREMENT_ID`, Value: `G-XXXXXXXXXX`.

*Note: If no Measurement ID is set, the website builds normally and zero Google tracking scripts or cookies are loaded.*

### 3. Verify Analytics Reports
Once deployed with your Measurement ID:
- Visit your website in a browser.
- In Google Analytics, go to **Reports** &rarr; **Realtime** to verify active visitor counts.
- Within 24–48 hours, standard reports will populate:
  - **Page views & top content:** *Engagement &rarr; Pages and screens*
  - **Traffic sources:** *Acquisition &rarr; Traffic acquisition*
  - **Geographic distribution:** *User &rarr; Demographic details*

---

## Deployment to GitHub Pages

This repository includes a pre-configured GitHub Actions workflow in `.github/workflows/deploy.yml`.

### Setup Instructions

1. Push your code to your GitHub repository on branch `main`.
2. In your repository on GitHub, go to **Settings** &rarr; **Pages**.
3. Under **Build and deployment** &rarr; **Source**, select **GitHub Actions**.
4. That's it! Every push to `main` will automatically build the static site and deploy it.

### Custom Domain or Repository Subpath

- If deploying to a root custom domain (e.g., `raviutsav.com`) or a user page (`raviutsav.github.io`), the default settings work out of the box.
- If deploying to a project subdirectory (e.g., `raviutsav.github.io/personalpage/`), set the following in your GitHub Actions workflow or `.env`:
  ```env
  BASE_PATH=/personalpage/
  SITE_URL=https://raviutsav.github.io
  ```

---

## Customizing Site Details

Global configuration settings are located in [src/config/site.ts](file:///d:/Work/personalpage/src/config/site.ts):
- Author name and wordmark
- Social links (GitHub, LinkedIn)
- Site description and title format
- Navigation links
