---
name: OIHOME Project Status
description: Current build status, decisions made, and what to do next
type: project
---

## Current State (2026-03-20)

The scaffold is live at **https://oihome.vercel.app/**

**Why:** Single Vercel deployment for both frontend and backend (no separate backend host needed — all free, no credit card).

**How to apply:** Keep everything in `frontend/` — React app in `src/`, serverless functions in `api/`.

---

## Stack decisions

- **Frontend:** React + TypeScript + Vite, hosted on Vercel (root dir: `frontend/`)
- **Backend:** Vercel Serverless Functions in `frontend/api/` — no separate server
- **No Railway/Render** — tried both, both require credit card on free tier
- **Monaco Editor** (`@monaco-editor/react`) for the code editor
- **MathJax** loaded via CDN in `index.html` for CF LaTeX math (`$$$...$$$` syntax)
- **node-html-parser** for scraping CF problem HTML

## Repo
- GitHub: https://github.com/SupersonicMan12/OIHOME
- Shell alias `gcp "message"` set up in `~/.zshrc` — does `git add -A && git commit -m "..." && git push`

---

## What's implemented

### Frontend (`frontend/src/`)
- `pages/ProblemsPage.tsx` — fetches real CF problem list from `/api/problems`, paginated 50/page, search, OJ filter tabs, difficulty color-coded by rating
- `pages/ProblemPage.tsx` — fetches real CF problem page via scraping, renders HTML statement with MathJax, Monaco editor, submit button (proxies to `/api/submit`)
- `pages/DashboardPage.tsx` — placeholder stats page
- `components/Navbar.tsx` — sticky navbar with Problems + Dashboard links
- Routes: `/` (problems), `/problem/:oj/:contestId/:index?rating=` (problem page), `/dashboard`

### API (`frontend/api/`)
- `health.ts` → `GET /api/health`
- `problems/index.ts` → `GET /api/problems?oj=codeforces&page=1&limit=50&search=` — fetches full CF problemset, filters, paginates, caches 5min
- `problems/[oj]/[contestId]/[problemIndex].ts` → `GET /api/problems/:oj/:contestId/:index` — scrapes CF problem page HTML, returns title/limits/statementHtml, caches 1hr
- `submit/index.ts` → `POST /api/submit` — stub, returns mock submission ID
- `submit/[id].ts` → `GET /api/submit/:id` — stub verdict poller

---

## Known issues / recent fixes
- `vercel.json` rewrite was blocking API functions — fixed to only apply SPA fallback to non-API paths
- CF scraping uses `User-Agent` header to avoid blocks
- Old `api/problems/[oj]/[id].ts` was deleted and replaced with nested `[contestId]/[problemIndex].ts`

---

## What to build next (Phase 2+)
1. **Real submission proxy** — log into CF on behalf of user and submit code, poll for verdict
2. **User accounts** — store CF handle, session cookies per user
3. **Add more OJs** — Luogu, AtCoder, UVA (each needs its own scraper adapter)
4. **Progress dashboard** — solved problems, submission history, stats across OJs
5. **Local test runner** — run code against sample cases in browser or edge function sandbox
