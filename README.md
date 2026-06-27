# Adirondack Advanced Water Solutions — Website

The marketing website for Adirondack Advanced Water Solutions, a plumbing and water-services business serving Clinton, Essex, and Franklin Counties in New York's North Country.

**Live site:** https://adkadvancedwatersolutions.com

---

## What this is

A single-page marketing site that introduces the business, lists its services (well & pump work, water filtration, drains, plumbing, and water-treatment products), and lets visitors get in touch through a contact form. It's built to look good and work smoothly on both phones and desktops.

## Tech stack

- **React** — the UI framework the site is built with
- **Vite** — the build tool and local development server
- **Tailwind CSS** — styling (utility classes written directly in the components)
- **EmailJS** — sends contact-form submissions to the business inbox without needing a backend server
- **Vercel** — hosts the live site and rebuilds it automatically on every push to GitHub

The entire site lives in a single main file: `src/App.jsx`.

---

## Running it locally

You'll need [Node.js](https://nodejs.org) installed (which includes `npm`).

1. Open a terminal in the project folder.
2. Install the dependencies (only needed the first time, or when they change):
   ```bash
   npm install
   ```
3. Start the local development server:
   ```bash
   npm run dev
   ```
4. Open the URL it prints (usually `http://localhost:5173`) in your browser. Changes you save will update live.

To build a production version locally (optional — Vercel does this automatically):
```bash
npm run build
```

---

## How it gets deployed

The site is connected to Vercel. **You don't deploy manually** — it happens automatically:

1. Make your changes and save.
2. Commit and push to GitHub.
3. Vercel detects the push, rebuilds the site, and publishes it — usually within a minute or two.

**Pushing to the `main` branch updates the live site.** Pushing to any other branch creates a separate **preview** deployment (a private test URL) without touching the live site — useful for testing changes before they go live.

---

## Where things live

| Thing | Location |
|-------|----------|
| All site content & layout | `src/App.jsx` |
| Global styles / Tailwind import | `src/App.css` and `src/index.css` |
| Hero image | `src/assets/hero-image.webp` |
| Page title, meta description, favicon | `index.html` |

---

## Common edits

- **Change text on the page** (services, descriptions, phone number, etc.) → edit `src/App.jsx`.
- **Change where the contact form sends** → this is set in the **EmailJS dashboard** (the email template's "To" field), *not* in the code.
- **Change the phone number or email shown** → search `src/App.jsx` for the current number/email and replace it.
- **Update the hero image** → replace `src/assets/hero-image.webp` and update the import at the top of `App.jsx` if the filename changes.

---

## Related documentation

- `02-accounts-and-access.md` — the map of all business accounts (domain, email, hosting, etc.)
- `03-how-to-update.md` — step-by-step for common content changes
- `04-maintenance.md` — domain renewal, email, and ongoing upkeep

> **Note:** Account passwords are NOT stored in these files. They live in a shared password manager. See the accounts document for details.