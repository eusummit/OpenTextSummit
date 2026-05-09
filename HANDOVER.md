# OpenTextSummit — Technical Handover Document by QXMBG - Monty Bagati

> **Prepared for:** KOMBIT A/S
> **Project:** OpenTextSummit (EU Summit conference website)
> **How the code was delivered:** ZIP archive of the repository

---

## Table of Contents

0. [Before You Deploy — Replace These Values](#0-before-you-deploy--replace-these-values)
1. [Project Overview](#1-project-overview)
2. [Repository Structure](#2-repository-structure)
3. [Architecture](#3-architecture)
4. [How the Build Pipeline Works](#4-how-the-build-pipeline-works)
5. [Step 1 — Create a GitHub Repository](#5-step-1--create-a-github-repository)
6. [Step 2 — Enable GitHub Pages](#6-step-2--enable-github-pages)
7. [Step 3 — Create a Supabase Project](#7-step-3--create-a-supabase-project)
8. [Step 4 — Configure Supabase Auth](#8-step-4--configure-supabase-auth)
9. [Step 5 — Set Up Google OAuth](#9-step-5--set-up-google-oauth)
10. [Step 6 — Set Up GitHub OAuth](#10-step-6--set-up-github-oauth)
11. [Step 7 — Add GitHub Actions Secrets](#11-step-7--add-github-actions-secrets)
12. [Step 8 — Deploy](#12-step-8--deploy)
13. [Secrets Reference](#13-secrets-reference)
14. [Verification Checklist](#14-verification-checklist)
15. [Local Development Setup](#15-local-development-setup)
16. [Ongoing Maintenance Notes](#16-ongoing-maintenance-notes)

---

## 0. Before You Deploy — Replace These Values

> **Read this before doing anything else.**

The ZIP contains two values that are hardcoded to the original developer's personal Umami Analytics account. If you deploy without replacing them, your site's analytics data will be sent to the wrong account.

### What needs replacing

| File | What to find | What it is | Action |
|---|---|---|---|
| `index.html` line 5 | `data-website-id="4146a71b-3238-4a74-be59-c9a8d300212b"` | Personal Umami website ID | Replace with your own (see below) |
| `index.html` line 1433 | `src="https://cloud.umami.is/p/O69iZhcEV"` | Personal Umami tracking pixel | Replace with your own (see below) |

### How to get your own Umami values

1. Sign up for a free account at [cloud.umami.is](https://cloud.umami.is)
2. Add a new website — enter your GitHub Pages URL as the domain
3. Umami will give you a tracking script tag. Copy:
   - The `data-website-id` value (a UUID like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
   - The pixel URL from the script tag (looks like `https://cloud.umami.is/p/XXXXXXXXX`)
4. Open `index.html` and replace both values

### If you don't want analytics

Remove these two lines from `index.html` entirely:

```html
<!-- Line 3-6: delete the entire Umami script tag -->
<script defer src="https://cloud.umami.is/script.js"
        data-website-id="4146a71b-3238-4a74-be59-c9a8d300212b"
        crossorigin="anonymous"></script>

<!-- Line 1433: delete the tracking pixel -->
<img src="https://cloud.umami.is/p/O69iZhcEV" class="tracking-pixel" alt=""/>
```

### What you do NOT need to change

The following strings in the source files look like placeholders but are **not** hardcoded credentials — they are substituted automatically by the GitHub Actions pipeline using the secrets you add in Step 7:

- `process.env.SUPABASE_URL` — in `index.html`, `login.html`, `methodology.html`
- `process.env.SUPABASE_KEY` — in `index.html`, `login.html`, `methodology.html`

Do not edit these manually.

---

## 1. Project Overview

OpenTextSummit is a static website for the EU Summit conference. It is login-gated: visitors must create an account or sign in before they can access the main content.

### Pages

| File | Access | Purpose |
|---|---|---|
| `login.html` | Public | Sign-in, sign-up, password recovery, OAuth |
| `index.html` | Authenticated users only | Main landing page; redirects to login if not signed in |
| `methodology.html` | Authenticated users only | QA cost estimation methodology |
| `privacy.html` | Public | GDPR privacy policy |
| `terms.html` | Public | Terms of service |

### Tech Stack

| Component | Detail |
|---|---|
| Hosting | GitHub Pages (free, via GitHub Actions) |
| Auth backend | Supabase Auth (your own account — see steps below) |
| Auth methods | Email/password, Google OAuth, GitHub OAuth, Magic Link |
| Analytics | Umami (cloud.umami.is — cookieless, GDPR-friendly) |
| Languages | HTML, vanilla JavaScript, CSS |
| CSS framework | Tailwind CSS v3.4.17 |
| Supabase JS SDK | @supabase/supabase-js v2.105.1 |

---

## 2. Repository Structure

```
OpenTextSummit/
├── index.html                  # Main landing page (auth-gated)
├── login.html                  # Authentication UI (public)
├── methodology.html            # Methodology page (auth-gated)
├── privacy.html                # Privacy policy (public)
├── terms.html                  # Terms of service (public)
├── tailwind.config.js          # Tailwind CSS theme (brand colours)
├── tailwind.css                # Generated CSS — built by CI, not edited manually
├── _headers                    # Per-page HTTP security headers (CSP, HSTS, etc.)
├── scripts/
│   └── inject-csp-hashes.js   # Computes SHA-256 hashes of inline scripts/styles
│                               # and writes them into _headers — runs after minification
└── .github/
    └── workflows/
        └── deploy.yml          # GitHub Actions build and deploy pipeline
```

---

## 3. Architecture

```
                        ┌─────────────┐
                        │   Browser   │
                        └──────┬──────┘
                               │ HTTPS
                               ▼
                    ┌──────────────────────┐
                    │    GitHub Pages      │
                    │  (static HTML/CSS/JS)│
                    └──────────┬───────────┘
                               │ Supabase JS SDK (loaded from CDN)
                               ▼
                    ┌──────────────────────┐
                    │   Supabase Auth      │
                    │  (your company acct) │
                    └──────────┬───────────┘
                               │ OAuth redirect
                    ┌──────────┴───────────┐
                    │                      │
             ┌──────▼──────┐       ┌───────▼──────┐
             │ Google OAuth│       │ GitHub OAuth  │
             └─────────────┘       └──────────────┘
```

**Key facts:**

- There is **no server** — all logic runs in the browser using the Supabase JS client.
- Supabase is used **for authentication only**. There are no custom database tables.
- The two Supabase credentials (`SUPABASE_URL` and `SUPABASE_KEY`) are stored as GitHub Actions secrets and are injected into the HTML files at build time. They are never committed to the repository — the source files contain placeholder strings.
- A Content Security Policy (CSP) with per-file SHA-256 hashes is computed automatically on every deployment to prevent XSS attacks.

---

## 4. How the Build Pipeline Works

The pipeline is defined in `.github/workflows/deploy.yml` and runs automatically on every push to the `main` branch.

| Step | What it does |
|---|---|
| **1. Checkout** | Fetches the source code |
| **2. Build Tailwind CSS** | Generates `tailwind.css` from all HTML files |
| **3. Inject secrets** | Replaces `process.env.SUPABASE_URL` and `process.env.SUPABASE_KEY` in HTML with real values from GitHub Actions secrets |
| **4. Narrow CSP** | Replaces the wildcard `*.supabase.co` in CSP directives with your exact Supabase project hostname |
| **5. Verify secrets** | Fails the build immediately if any placeholder was not replaced — catches missing secrets early |
| **6. Minify HTML** | Minifies all 5 HTML files including their inline JS and CSS |
| **7. Compute CSP hashes** | Runs `scripts/inject-csp-hashes.js` to SHA-256 hash every inline `<script>` and `<style>` block and write them into `_headers` |
| **8. Deploy to Pages** | Uploads the build artifact and publishes to GitHub Pages |

> **Important:** Step 7 must run after Step 6. Minification changes the content of inline scripts and styles, so hashes must be computed on the minified output.

---

## 5. Step 1 — Create a GitHub Repository

1. In your company's GitHub organisation, create a new repository named `OpenTextSummit` (public or private — your choice).
2. Clone it to your local machine:
   ```bash
   git clone https://github.com/<your-org>/OpenTextSummit.git
   cd OpenTextSummit
   ```
3. Extract the contents of the ZIP archive into this folder (all files should sit at the root, not inside a subfolder).
4. Stage and push all files:
   ```bash
   git add .
   git commit -m "chore: initial commit from ZIP handover"
   git push origin main
   ```

---

## 6. Step 2 — Enable GitHub Pages

1. Go to your repository on GitHub.
2. Navigate to **Settings → Pages**.
3. Under **Source**, select **GitHub Actions**.
4. Save.

Your site will be published at: `https://<your-org>.github.io/OpenTextSummit/`

Note this URL — you will need it in the next steps.

---

## 7. Step 3 — Create a Supabase Project

1. Sign up for a free account at [supabase.com](https://supabase.com).
2. Click **New project** and fill in a name and password (the password is for direct database access; it is not used by this application).
3. Wait for the project to finish provisioning (~2 minutes).
4. Go to **Project Settings → API** and note down:
   - **Project URL** — this is your `SUPABASE_URL` (e.g. `https://abcdefghij.supabase.co`)
   - **anon public** key — this is your `SUPABASE_KEY`

> The anon key is designed to be used in browser-side JavaScript. It is not a secret in the traditional sense — it is scoped to public read-only access and is safe to expose. Do **not** use the `service_role` key here.

---

## 8. Step 4 — Configure Supabase Auth

1. In the Supabase dashboard, go to **Authentication → Providers**.
2. Enable **Email** (toggle on). Leave the defaults unless you want to disable email confirmations for testing.
3. Go to **Authentication → URL Configuration**.
4. Set **Site URL** to your GitHub Pages URL from Step 2 (e.g. `https://<your-org>.github.io/OpenTextSummit/`).
5. Under **Redirect URLs**, add your GitHub Pages URL.

---

## 9. Step 5 — Set Up Google OAuth

You need a Google Cloud project with an OAuth 2.0 credential.

**In the Supabase dashboard:**
1. Go to **Authentication → Providers → Google**.
2. Note the **Callback URL** shown on this page — it looks like:
   ```
   https://<your-supabase-project-id>.supabase.co/auth/v1/callback
   ```

**In Google Cloud Console ([console.cloud.google.com](https://console.cloud.google.com)):**
1. Create a project (or use an existing one).
2. Go to **APIs & Services → OAuth consent screen** — configure it (External, fill in app name and email).
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**.
4. Application type: **Web application**.
5. Under **Authorised redirect URIs**, add the Supabase Callback URL from above.
6. Click **Create** and copy the **Client ID** and **Client Secret**.

**Back in Supabase:**
1. Paste the Client ID and Client Secret into the Google provider settings.
2. Toggle Google **on** and save.

---

## 10. Step 6 — Set Up GitHub OAuth

You need a GitHub OAuth App registered under your company's GitHub organisation.

**In the Supabase dashboard:**
1. Go to **Authentication → Providers → GitHub**.
2. Note the **Callback URL** shown on this page (same format as Google: `https://<project-id>.supabase.co/auth/v1/callback`).

**In GitHub:**
1. Go to your organisation's **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Fill in:
   - **Application name:** OpenTextSummit (or any name)
   - **Homepage URL:** your GitHub Pages URL
   - **Authorization callback URL:** the Supabase Callback URL from above
3. Click **Register application**.
4. On the next screen, copy the **Client ID**.
5. Click **Generate a new client secret** and copy the **Client Secret**.

**Back in Supabase:**
1. Paste the Client ID and Client Secret into the GitHub provider settings.
2. Toggle GitHub **on** and save.

---

## 11. Step 7 — Add GitHub Actions Secrets

The build pipeline reads two secrets at deploy time. Without these, the build will fail.

1. In your repository, go to **Settings → Secrets and variables → Actions**.
2. Click **New repository secret** and add:

| Secret name | Value |
|---|---|
| `SUPABASE_URL` | The Project URL from Supabase (e.g. `https://abcdefghij.supabase.co`) |
| `SUPABASE_KEY` | The anon public key from Supabase |

---

## 12. Step 8 — Deploy

1. Push a commit to `main` to trigger the pipeline — or go to the **Actions** tab and click **Run workflow** manually.
2. Watch the workflow run; all steps should go green. If any step fails, the error message will tell you which secret or configuration is missing.
3. Once the workflow completes, open your GitHub Pages URL to confirm the site is live.

---

## 13. Secrets Reference

| Secret name | Where to get the value | What it does |
|---|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API → **Project URL** | Injected into `index.html`, `login.html`, `methodology.html` at build time; also used to set the exact CSP `connect-src` hostname |
| `SUPABASE_KEY` | Supabase → Project Settings → API → **anon public** | Injected into `index.html`, `login.html`, `methodology.html` at build time; this is the public browser key |

---

## 14. Verification Checklist

Work through this after completing all 8 steps.

- [ ] GitHub Actions workflow run is green (no red steps)
- [ ] GitHub Pages URL opens and the landing page loads
- [ ] `login.html` loads and the sign-in form renders correctly
- [ ] Email/password sign-up and sign-in work
- [ ] "Sign in with Google" completes the full OAuth flow
- [ ] "Sign in with GitHub" completes the full OAuth flow
- [ ] Opening `index.html` while signed out redirects to `login.html`
- [ ] Opening `methodology.html` while signed out redirects to `login.html`
- [ ] Both pages load correctly after signing in
- [ ] Browser DevTools → Console shows no `Content-Security-Policy` violation errors
- [ ] Leaving the site idle for 5 minutes shows a warning banner, then signs out automatically

---

## 15. Local Development Setup

For any developer who wants to run the site locally:

**Prerequisites:** Node.js 20+

```bash
# Clone your company's repository
git clone https://github.com/<your-org>/OpenTextSummit.git
cd OpenTextSummit

# Generate the CSS (required for correct styling)
npx tailwindcss@3.4.17 -c tailwind.config.js --content "*.html" -o tailwind.css

# Substitute Supabase credentials locally (do NOT commit these changes)
sed -i "s|process.env.SUPABASE_URL|https://your-project.supabase.co|g" index.html login.html methodology.html
sed -i "s|process.env.SUPABASE_KEY|your-anon-key|g" index.html login.html methodology.html

# Serve locally
npx serve .
```

Open `http://localhost:3000/login.html` in your browser.

> **Before committing:** restore the placeholder strings so credentials are not accidentally committed:
> ```bash
> git checkout index.html login.html methodology.html
> ```

> **Note:** Google and GitHub OAuth will not work on `localhost` unless you add `http://localhost:3000` to the Supabase Redirect URLs and to each OAuth app's allowed callback URLs. For local development, email/password login is the easiest method to test.

---

## 16. Ongoing Maintenance Notes

### Supabase SDK version and SRI hash

The Supabase JS SDK is loaded from a CDN with a pinned version and integrity hash in `index.html`, `login.html`, and `methodology.html`:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.105.1/dist/umd/supabase.js"
        integrity="sha384-pNDx8ebKKncqRMS1aZKjmB1T1jdd6psogvE0+sPrwW/Sy94M6geGuQpYXQnLCdRq"
        crossorigin="anonymous"></script>
```

To upgrade the SDK: update both the version number **and** the `integrity` hash in all three files. Compute the new hash with:

```bash
curl -s https://cdn.jsdelivr.net/npm/@supabase/supabase-js@<new-version>/dist/umd/supabase.js | \
  openssl dgst -sha384 -binary | openssl base64 -A | sed 's/^/sha384-/'
```

### Tailwind CSS version

Tailwind is pinned in the workflow: `tailwindcss@3.4.17`. To upgrade, update the version string in `.github/workflows/deploy.yml`. Do not upgrade to Tailwind v4 without testing — it has a completely different configuration API.

### CSP hashes

The CSP hashes in `_headers` are **recomputed automatically on every deployment** by `scripts/inject-csp-hashes.js`. You never need to manage them manually. Any change to inline `<script>` or `<style>` content in the HTML files will produce correct hashes on the next push.

### Adding new pages

If you add a new HTML page that contains inline scripts or needs authentication:
1. Add it to the minification step in `.github/workflows/deploy.yml`
2. Add it to the `HTML_FILES` array at the top of `scripts/inject-csp-hashes.js`
3. Add appropriate CSP header entries to `_headers`

### GitHub Actions action pins

All `uses:` directives in `deploy.yml` are pinned to commit SHAs (not version tags). This is a supply-chain security measure. To update an action, find the new SHA for the desired release tag in that action's GitHub repository and update the reference in `deploy.yml`.
