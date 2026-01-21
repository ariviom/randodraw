# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RandoDraw is an Astro-based web app that displays random images synced from a Google Drive folder. Users click a button to show a different random image. Deployed on Netlify with SSR.

## Commands

- `npm run dev` - Start development server (uses existing local images)
- `npm run dev:sync` - Start dev server after syncing images from Google Drive
- `npm run build` - Production build (syncs images from Google Drive first)
- `npm run preview` - Preview production build locally
- `npm run generate-images` - Manually sync images from Google Drive

## Architecture

**Image Sync Flow (build-time):**
1. `scripts/generate-image-list.ts` fetches file list from Google Drive API
2. Downloads all images to `public/images/`
3. Writes filenames to `public/images-list.json`
4. Runs automatically before dev/build via npm scripts

**Frontend:**
- `src/pages/index.astro` - Main gallery page, client-side JS fetches image list and displays random images
- `src/pages/publish.astro` - Password-protected page to trigger Netlify rebuild
- Tailwind CSS v4 via Vite plugin

**Environment Variables (see `.env.example`):**
- `GOOGLE_DRIVE_FOLDER_ID` - Google Drive folder ID from share link
- `GOOGLE_API_KEY` - Google Cloud API key with Drive API enabled
- `PUBLISH_PASSWORD` - Password for /publish route
- `NETLIFY_BUILD_HOOK_URL` - Netlify deploy hook URL
- `NETLIFY_SITE_ID` - Netlify site ID (for deploy status)
- `NETLIFY_API_TOKEN` - Netlify personal access token (for deploy status)

**Deployment:**
- Netlify with SSR adapter (`@astrojs/netlify`)
- Set environment variables in Netlify dashboard
- Create a Build Hook in Netlify for the /publish feature
