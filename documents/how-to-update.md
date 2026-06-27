# How to Update the Website

A practical guide for making common changes. Written for a developer (or a technically comfortable person) who needs to edit the site.

---

## Quick start

1. Make sure you have [Node.js](https://nodejs.org) installed.
2. Open the project folder in [VS Code](https://code.visualstudio.com) (or any editor).
3. In a terminal, install dependencies (first time only):
   ```bash
   npm install
   ```
4. Start the local preview:
   ```bash
   npm run dev
   ```
5. Open the URL it prints (usually `http://localhost:5173`). Edits save live.

---

## Where everything lives

Almost the entire site is in **one file**: `src/App.jsx`. Text, sections, services, contact info — it's all there. Other files:

| File | What's in it |
|------|--------------|
| `src/App.jsx` | All page content and layout |
| `src/App.css` / `src/index.css` | Global styles |
| `src/assets/hero-image.webp` | The hero (faucet) image |
| `public/` | Files served directly (hero copy for social sharing, favicon) |
| `index.html` | Page title, description, social-share (Open Graph) tags |

The site is styled with **Tailwind CSS** — the styling is written as `className="..."` directly on the elements, not in a separate CSS file.

---

## Common edits

### Change text on the page
Open `src/App.jsx`, find the text (use Ctrl/Cmd+F to search), edit it, save.

### Change the phone number
Search `src/App.jsx` for `5185349949`. It appears in several places (header, hero, contact, footer) — update each. The format `tel:+15185349949` is for the tap-to-call links; the displayed `(518) 534-9949` is separate text. Update both.

### Change the displayed email
Search for `contact@adkadvancedwatersolutions.com` and replace it. (Changing where the contact form *delivers* is separate — see below.)

### Edit a service or product card
The services and products are written as lists (arrays) near the top of each section in `src/App.jsx`. Each card is an object with a title and items. Add, remove, or edit entries in the list and the cards update automatically.

### Replace the hero image
Put the new image in `src/assets/`, then update the import line at the very top of `App.jsx`:
```js
import heroImage from './assets/your-new-image.webp'
```

### Change the social-share preview (when a link is shared)
Edit the `og:image`, `og:title`, `og:description` tags in `index.html`. The share image must be a real file in the `public/` folder, referenced by full URL.

---

## Changing where the contact form sends

**This is NOT in the code.** The contact form uses a service called **EmailJS**. Where submissions are delivered is set in the **EmailJS dashboard**, not in the website files:

1. Log into [emailjs.com](https://www.emailjs.com) (see the accounts document for the login).
2. Go to **Email Templates** → open the template.
3. Change the **"To Email"** field.
4. Save. No code change or redeploy needed.

---

## Publishing your changes (deployment)

The site is hosted on **Vercel** and deploys **automatically** — there is no manual "upload" step.

1. Save your changes.
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "describe what you changed"
   git push
   ```
3. Vercel detects the push and rebuilds the live site within a minute or two.

- Pushing to the **`main`** branch updates the **live site**.
- Pushing to **any other branch** creates a private **preview** deployment (a test URL) without touching the live site — use this to test before going live, then merge the branch into `main`.

---

## A note on the hero image fade

The hero image is intentionally **fixed in place** and fades out as you scroll, while the page content scrolls over it. If you edit the hero and it behaves oddly (jumping on mobile, wrong crop), the relevant settings are: `position: fixed` on the image layer, `object-cover object-right` on the image, and a scroll-driven opacity. This was carefully tuned — change it cautiously and test on a real phone, not just desktop.