# OpenTextSummit — Technical Handover Document

> **Prepared for:** Company technical team  
> **Project:** OpenTextSummit (EU Summit conference website)  
> **Date:** May 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Structure](#2-repository-structure)
3. [Architecture](#3-architecture)
4. [Build & Deploy Pipeline](#4-build--deploy-pipeline)
5. [Local Development Setup](#5-local-development-setup)
6. [GitHub Repository Handover Options](#6-github-repository-handover-options)
7. [Supabase Handover Options](#7-supabase-handover-options)
8. [Step-by-Step Handover Procedure (Recommended Path)](#8-step-by-step-handover-procedure-recommended-path)
9. [GitHub Actions Secrets Reference](#9-github-actions-secrets-reference)
10. [OAuth Provider Configuration](#10-oauth-provider-configuration)
11. [Post-Transfer Verification Checklist](#11-post-transfer-verification-checklist)
12. [Ongoing Maintenance Notes](#12-ongoing-maintenance-notes)

---

## 1. Project Overview

OpenTextSummit is a static website for the EU Summit conference. It provides:

- A public-facing landing page with summit information and video demo
- User authentication (sign-up, sign-in, OAuth, magic link)
- A gated methodology page with QA cost estimation documentation
- Privacy policy and terms of service pages

| Item | Detail |
|---|---|
| **Live URL** | Hosted on GitHub Pages (visible in repo Settings → Pages) |
| **Hosting** | GitHub Pages (free, served directly from the repository) |
| **Auth backend** | Supabase (cloud-hosted, personal account — see handover sections below) |
| **Analytics** | Umami (cloud.umami.is — cookieless, GDPR-friendly) |
| **Languages** | HTML, vanilla JavaScript, CSS |
| **CSS framework** | Tailwind CSS v3.4.17 |
| **Supabase SDK** | @supabase/supabase-js v2.105.1 |

### Pages

| File | Access | Purpose |
|---|---|---|
| `index.html` | Authenticated users only | Main landing page; redirects to login if not signed in |
| `login.html` | Public | Sign-in, sign-up, password recovery, OAuth |
| `methodology.html` | Authenticated users only | QA cost estimation methodology |
| `privacy.html` | Public | GDPR privacy policy |
| `terms.html` | Public | Terms of service |

---

## 2. Repository Structure

```
OpenTextSummit/
├── index.html                  # Main landing page (auth-gated)
├── login.html                  # Authentication UI
├── methodology.html            # Methodology page (auth-gated)
├── privacy.html                # Privacy policy
├── terms.html                  # Terms of service
├── tailwind.config.js          # Tailwind CSS theme (brand colours)
├── tailwind.css                # Generated CSS (not committed; built in CI)
├── _headers                    # HTTP security headers per page (CSP, HSTS, etc.)
├── scripts/
│   └── inject-csp-hashes.js   # Computes SHA-256 hashes of inline scripts/styles
│                               # and writes them into _headers (runs after minification)
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
                               │ Supabase JS SDK (CDN)
                               ▼
                    ┌──────────────────────┐
                    │   Supabase Auth      │
                    │  (personal account)  │
                    └──────────┬───────────┘
                               │ OAuth redirect
                    ┌──────────┴───────────┐
                    │                      │
             ┌──────▼──────┐       ┌───────▼──────┐
             │ Google OAuth│       │ GitHub OAuth  │
             └─────────────┘       └──────────────┘
```

**Key design decisions:**

- There is **no server** — all logic runs in the browser via the Supabase JS client.
- Supabase is used **for auth only**; there are no custom database tables.
- Supabase credentials (`SUPABASE_URL` and `SUPABASE_KEY`) are injected into the HTML at build time by GitHub Actions — they are never committed to the repository.
- Content Security Policy (CSP) is computed at build time with SHA-256 hashes of every inline script/style block to prevent XSS.

---

## 4. Build & Deploy Pipeline

The pipeline is defined in `.github/workflows/deploy.yml` and runs automatically on every push to the `main` branch.

### Pipeline Steps (in order)

| Step | What it does |
|---|---|
| **1. Checkout** | Fetches the source code |
| **2. Build Tailwind CSS** | Runs `tailwindcss` CLI to generate `tailwind.css` from all HTML files |
| **3. Inject secrets** | Replaces `process.env.SUPABASE_URL` and `process.env.SUPABASE_KEY` placeholders in HTML with real values from GitHub Actions secrets |
| **4. Narrow CSP** | Extracts the exact Supabase project hostname from `SUPABASE_URL` and replaces the wildcard `*.supabase.co` in CSP `connect-src` directives |
| **5. Verify secrets** | Fails the build if any placeholder was not replaced (catches missing secrets early) |
| **6. Minify HTML** | Uses `html-minifier-terser` to minify all 5 HTML files including inline JS and CSS |
| **7. Compute CSP hashes** | Runs `scripts/inject-csp-hashes.js` to compute SHA-256 hashes of all inline `<script>` and `<style>` blocks and write them into `_headers` |
| **8. Deploy to Pages** | Uploads the build artifact and deploys to GitHub Pages |

> **Why this order matters:** CSP hashes must be computed *after* minification because minification changes the content of inline scripts/styles.

### Required GitHub Actions Secrets

Two secrets must be set in the repository before the pipeline will succeed:

| Secret name | Description |
|---|---|
| `SUPABASE_URL` | The Supabase project URL (e.g. `https://abcdefghij.supabase.co`) |
| `SUPABASE_KEY` | The Supabase anon/public API key |

Set these at: **Repository → Settings → Secrets and variables → Actions → New repository secret**

---

## 5. Local Development Setup

There is no local server required — the site is static HTML. However, you need to substitute the Supabase credentials manually for local testing.

### Prerequisites

- Node.js 20+
- A Supabase project (see [supabase.com](https://supabase.com))

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/<org-or-user>/OpenTextSummit.git
cd OpenTextSummit

# 2. Install Tailwind CSS (for CSS rebuilds only — optional for just viewing the site)
npx tailwindcss@3.4.17 -c tailwind.config.js --content "*.html" -o tailwind.css --watch

# 3. Substitute Supabase credentials in the HTML files locally
#    Replace YOUR_SUPABASE_URL and YOUR_SUPABASE_KEY with real values
sed -i "s|process.env.SUPABASE_URL|YOUR_SUPABASE_URL|g" index.html login.html methodology.html
sed -i "s|process.env.SUPABASE_KEY|YOUR_SUPABASE_KEY|g" index.html login.html methodology.html

# 4. Open in browser (any static file server works)
npx serve .
# or just open index.html directly in your browser
```

> **Important:** Do not commit the HTML files after substituting credentials locally. Use `git checkout index.html login.html methodology.html` to restore the placeholders before committing.

---

## 6. GitHub Repository Handover Options

The repository currently lives on a personal GitHub account. There are three ways to give the company ownership or access.

---

### Option A — Transfer the repository to the company org (Recommended)

GitHub's built-in transfer feature moves the repo permanently to the company's GitHub organisation.

**Pros:**
- Company owns the repo entirely (billing, settings, branch protection)
- All git history, issues, pull requests, and releases are preserved
- GitHub automatically sets up a redirect from the old URL so existing clones still work
- GitHub Actions workflows carry over (but secrets do **not** — see step 8)
- GitHub Pages will need to be re-enabled under the new org

**Cons:**
- Irreversible without the company transferring it back
- The original owner loses admin access unless the company adds them back

**How to do it:**  
Repo → **Settings** → **Danger Zone** → **Transfer ownership** → enter the company org name.

---

### Option B — Fork to the company org

The company creates a fork of the repository under their GitHub org.

**Pros:**
- The personal repo is kept intact
- Company gets their own independent copy

**Cons:**
- GitHub Actions secrets are not copied — must be re-added
- No URL redirect from old to new
- The fork relationship shows in GitHub UI (can be confusing)
- Any changes made to the personal repo after forking are not automatically in the company fork

---

### Option C — Add company members as collaborators

Add individual company GitHub accounts (or the whole org team) as collaborators on the personal repo.

**Pros:**
- Immediate access without moving anything
- No secrets or settings need changing

**Cons:**
- Repo stays on personal billing and account
- If the personal account is closed or leaves, access is lost
- Company does not own the repo — only has contributor access
- Not suitable as a permanent arrangement

---

**Recommendation: Option A** (transfer to company org). It gives the company full ownership and is the cleanest long-term arrangement.

---

## 7. Supabase Handover Options

The Supabase project (which handles authentication) is currently on a personal supabase.com account. There are three ways to give the company access.

---

### Option A — Transfer the Supabase project to a company Supabase organisation (Recommended)

Supabase supports transferring a project from one organisation to another.

**Pros:**
- Company owns the project, its billing, and all user data
- Existing `SUPABASE_URL` and `SUPABASE_KEY` values stay the same — no secrets need updating in GitHub
- All registered users and auth settings carry over seamlessly

**Cons:**
- Requires the company to have a Supabase organisation (free to create)
- Personal account loses ownership

**How to do it:**
1. Ask the company to create a Supabase account and organisation at [supabase.com](https://supabase.com)
2. In your Supabase dashboard: **Project → Settings → General → Transfer project**
3. Enter the destination organisation name and confirm

---

### Option B — Create a new Supabase project under the company account

The company creates a brand-new Supabase project and the application is pointed at it.

**Pros:**
- Company starts with a clean, company-owned project
- No dependency on the personal account at all

**Cons:**
- All existing registered users will be lost (they cannot be migrated without a paid Supabase plan and manual export/import)
- OAuth redirect URLs must be re-configured in Google Cloud Console and GitHub OAuth app settings
- `SUPABASE_URL` and `SUPABASE_KEY` secrets in GitHub must be updated to the new project values
- A new deployment must be triggered after updating secrets

**Steps if taking this option:**
1. Company creates a new Supabase project
2. Enable the same auth providers: **Email**, **Google**, **GitHub** (see section 10)
3. Copy the new `SUPABASE_URL` and `SUPABASE_ANON_KEY` from Supabase → **Project Settings → API**
4. Update GitHub Actions secrets (repo → Settings → Secrets) with the new values
5. Update OAuth redirect URLs in Google and GitHub (see section 10)
6. Push a commit to `main` to trigger a fresh deployment

---

### Option C — Add company team members to the existing personal Supabase project

Invite company members as members of your Supabase organisation so they can access the project dashboard.

**Pros:**
- Immediate shared access with no migration
- Existing users and credentials unchanged

**Cons:**
- Project stays on personal billing
- If the personal account is closed, the project is at risk
- Not suitable as a permanent arrangement

**How to do it:**  
Supabase dashboard → **Organisation Settings → Members → Invite** → enter company email(s) with Owner or Admin role.

---

**Recommendation: Option A** (transfer to company Supabase org). It preserves all existing users and keeps credentials unchanged, meaning no re-deployment is needed.

---

## 8. Step-by-Step Handover Procedure (Recommended Path)

This procedure follows **GitHub Option A** (repo transfer) + **Supabase Option A** (project transfer).

### Pre-Transfer Checklist

- [ ] Confirm the company has a GitHub organisation set up
- [ ] Confirm the company has a Supabase account and organisation set up
- [ ] Note down the current `SUPABASE_URL` and `SUPABASE_KEY` values (you will need to re-add them as secrets after the GitHub transfer)
- [ ] Confirm the live site is working before starting

### Step 1 — Transfer the GitHub Repository

1. Go to the repository on GitHub
2. Navigate to **Settings → Danger Zone → Transfer ownership**
3. Type the company's GitHub organisation name and confirm
4. The repo is now at `https://github.com/<company-org>/OpenTextSummit`
5. Your old URL (`https://github.com/<you>/OpenTextSummit`) will redirect automatically

### Step 2 — Re-add GitHub Actions Secrets

The transfer does **not** carry over repository secrets. You must re-add them:

1. Go to the transferred repo: **Settings → Secrets and variables → Actions**
2. Add `SUPABASE_URL` — the Supabase project URL (e.g. `https://abcdefghij.supabase.co`)
3. Add `SUPABASE_KEY` — the Supabase anon/public API key

Both values can be found in: Supabase dashboard → **Project Settings → API**

### Step 3 — Re-enable GitHub Pages

GitHub Pages may need to be re-enabled under the new org:

1. Repo → **Settings → Pages**
2. Set **Source** to **GitHub Actions**
3. Save

### Step 4 — Transfer the Supabase Project

1. In your Supabase dashboard, open the project
2. Go to **Settings → General**
3. Scroll to **Transfer project** and enter the company's Supabase organisation name
4. Confirm the transfer

The `SUPABASE_URL` and `SUPABASE_KEY` values do **not** change — no secrets update needed.

### Step 5 — Trigger a Fresh Deployment

Push a trivial commit to `main` (or manually re-run the GitHub Actions workflow) to confirm the pipeline runs successfully with the new org's secrets.

```bash
git commit --allow-empty -m "chore: trigger post-handover deployment"
git push origin main
```

### Step 6 — Update OAuth Redirect URLs (if the Pages URL changed)

If the GitHub Pages URL changed because the org name changed (e.g. from `<you>.github.io/OpenTextSummit` to `<company>.github.io/OpenTextSummit`), you must update the OAuth callback URLs. See section 10.

---

## 9. GitHub Actions Secrets Reference

| Secret name | Where to find the value | What it's used for |
|---|---|---|
| `SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL | Injected into index.html, login.html, methodology.html at build time; also used to narrow the CSP to the exact Supabase hostname |
| `SUPABASE_KEY` | Supabase dashboard → Project Settings → API → `anon` `public` key | Injected into index.html, login.html, methodology.html at build time; this is the public/anon key, safe to expose in browser JS |

> The `SUPABASE_KEY` here is the **anon/public** key — it is designed to be used in browser-side JavaScript. It is not the `service_role` key, which must never be used client-side.

---

## 10. OAuth Provider Configuration

The application supports Google and GitHub OAuth sign-in. These are configured in two places: the Supabase dashboard, and the OAuth app registration on each provider.

### Supabase Dashboard

In Supabase → **Authentication → Providers**:

- **Google** — requires a Google OAuth Client ID and Client Secret (from Google Cloud Console)
- **GitHub** — requires a GitHub OAuth App Client ID and Client Secret (from GitHub Developer Settings)

The Supabase callback URL to register with each provider is shown in the Supabase dashboard when you enable the provider. It looks like:

```
https://<your-supabase-project-id>.supabase.co/auth/v1/callback
```

### Google OAuth App

Managed at: [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth 2.0 Client IDs

After a transfer, if the **Supabase project URL did not change** (i.e. you used Option A for Supabase), the Google OAuth callback URL does not need updating.

If you created a **new Supabase project** (Option B), update the **Authorized redirect URIs** to the new Supabase callback URL.

### GitHub OAuth App

Managed at: [github.com/settings/developers](https://github.com/settings/developers) → OAuth Apps

Same rule applies: if the Supabase project URL did not change, no update is needed. If a new Supabase project was created, update the **Authorization callback URL** to the new Supabase callback URL.

---

## 11. Post-Transfer Verification Checklist

Run through these checks after completing the handover to confirm everything is working.

- [ ] **GitHub Actions pipeline passes** — check the Actions tab in the transferred repo; the latest run should be green
- [ ] **Live site loads** — open the GitHub Pages URL and confirm the landing page appears
- [ ] **Redirect from old URL works** — open the old personal GitHub URL and confirm it redirects to the new org URL
- [ ] **Login page loads** — navigate to `login.html` and confirm the sign-in form renders
- [ ] **Email/password login works** — sign in with an existing account
- [ ] **Google OAuth works** — click "Sign in with Google" and complete the flow
- [ ] **GitHub OAuth works** — click "Sign in with GitHub" and complete the flow
- [ ] **Auth-gated pages redirect correctly** — open `index.html` without being logged in; should redirect to `login.html`
- [ ] **Methodology page is accessible after login**
- [ ] **No CSP errors in browser console** — open DevTools → Console and look for any `Content-Security-Policy` violations
- [ ] **Inactivity timeout works** — leave a logged-in page idle for 5 minutes and confirm the warning banner appears, then logout occurs

---

## 12. Ongoing Maintenance Notes

### Supabase SDK version

The Supabase JS SDK is loaded from a CDN with a pinned version and SRI hash in each HTML file:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.105.1/dist/umd/supabase.js"
        integrity="sha384-..."
        crossorigin="anonymous"></script>
```

To upgrade the SDK version: update the version number **and** the `integrity` hash in all HTML files. The new hash can be computed with:

```bash
curl -s https://cdn.jsdelivr.net/npm/@supabase/supabase-js@<new-version>/dist/umd/supabase.js | \
  openssl dgst -sha384 -binary | openssl base64 -A | sed 's/^/sha384-/'
```

### Tailwind CSS version

Tailwind is pinned in the GitHub Actions workflow (`tailwindcss@3.4.17`). To upgrade, update the version in `.github/workflows/deploy.yml`.

### CSP hashes

The CSP script and style hashes in `_headers` are **automatically recomputed on every deployment** by `scripts/inject-csp-hashes.js`. You do not need to manage them manually. However, if you add a new inline `<script>` or `<style>` block to any HTML file, the hash will be updated automatically on the next deployment.

### Adding new pages

If you add a new HTML page that requires authentication or has inline scripts:
1. Add the page to the minification step in `.github/workflows/deploy.yml`
2. Add the page to `scripts/inject-csp-hashes.js` (the `HTML_FILES` array at the top of the file)
3. Add any required CSP header entries to `_headers`

### Supabase Auth settings

The Supabase project's auth settings (allowed email domains, JWT expiry, session length, etc.) are managed in the Supabase dashboard under **Authentication → Settings**. These are not stored in the repository.

### Analytics

Umami analytics is loaded from `cloud.umami.is`. The website ID is embedded in the `<script>` tag in each HTML file. If you need to transfer the Umami account or create a new one, update the `data-website-id` attribute and the `src` URL in each HTML file.
