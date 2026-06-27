# Maintenance & Ongoing Upkeep

The things that need occasional attention to keep the website and email running. Most of this is "check once in a while," not daily work.

---

## Recurring — don't let these lapse

### Domain renewal (once a year)
The domain `adkadvancedwatersolutions.com` is registered at **Cloudflare** and must be renewed annually. **If it lapses, the website AND email both go down**, and the domain could be lost.
- Make sure **auto-renew is ON** in Cloudflare.
- Make sure the **payment card on file is valid**.
- The renewal notice goes to the email on the Cloudflare account — make sure that inbox is monitored.

### Google Workspace (monthly)
The business email is a paid Google Workspace subscription (~$7–8/month per user). If the payment fails, email stops.
- Keep a valid card on file.
- The bill goes to the Workspace admin account.

### Email card / billing
Both Cloudflare (domain) and Google (email) bill automatically. If a card expires or is replaced, **update it in both places** or services will interrupt.

---

## Periodic — good to check

### Google Business Profile
- Once verified, keep the **hours, phone, and service area** accurate.
- **Reviews matter most** for showing up in local search — encourage happy customers to leave Google reviews.
- Add/refresh **photos** (van, team, completed work) occasionally.

### Contact form
- Every so often, submit a test through the form to confirm leads are still arriving in the `contact@` inbox.
- The form runs on **EmailJS** (free tier). If EmailJS ever changes plans or limits, the form could be affected.

### Dependencies (developer task, optional)
The site uses npm packages that occasionally get security updates. A developer can run `npm outdated` and `npm update` periodically. Not urgent for a simple marketing site, but good hygiene yearly.

---

## If something breaks

| Symptom | Likely cause | Where to look |
|---------|-------------|---------------|
| Whole site is down | Domain lapsed, or DNS changed | Cloudflare (domain + DNS) |
| Site loads but looks broken | A bad code change was deployed | Vercel deployments — roll back to a previous deployment |
| Email not arriving | Workspace billing, or DNS (MX) records changed | Google Workspace + Cloudflare DNS |
| Contact form not delivering | EmailJS issue or "To" address changed | EmailJS dashboard |
| Not showing up in Google search | Normal for new sites; needs time + reviews + verified profile | Google Business Profile + Search Console |

**Vercel has a rollback feature** — if a bad change goes live, you can revert to a previous working deployment in the Vercel dashboard without touching code. This is the fastest fix for "the site suddenly looks wrong after an update."

---

## Updates pending (as of handoff)

- **LLC**: when filed, update the domain registrant, Business Profile, and any "licensed/insured" wording on the site to reflect the LLC.
- **Logo**: a professional vector logo is being produced. When available, it can replace the text logo in the header, become the social-share image, and be used on business cards and the Business Profile.
- **Business cards**: a QR-code business card design exists; needs a real generated QR code (pointing to the website) before printing.

---

_Last updated: _____________________