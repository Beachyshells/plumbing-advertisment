# Accounts & Access

This is the master map of every online account that runs the business — what each one is, what it's for, who owns it, and where to find the login.

> ## ⚠️ IMPORTANT — Passwords are NOT in this file
>
> Passwords are stored in a **password manager** (e.g. Bitwarden — free), shared with Michael.
> The "Password location" column below tells you *where* the password lives, never the password itself.
> Never type real passwords into this document.

---

## If you are a new developer taking over

The website code is straightforward — unzip the `code` folder, open it in VS Code, run `npm install`, then `npm run dev` (see the main README). **The hard part of a handoff is not the code — it's account access.** The accounts below are what actually control the live site, the domain, and the email. Make sure you can get into Cloudflare and Vercel first; those two control whether the site stays online.

---

## Accounts

| Account | What it's for | Login email / username | In whose name | Password location |
|---------|---------------|------------------------|---------------|-------------------|
| **Cloudflare** | Owns the domain name AND manages all DNS records. The single most important account. | michelle.durham.dev@gmail.com | Michael (registrant) | _______ |
| **Google Workspace (admin)** | The business email system. Admin console controls all email addresses. | _______ | Michael / business | _______ |
| **Business email — contact@** | Primary inbox for customer leads & appointments | contact@adkadvancedwatersolutions.com | Business | _______ |
| **Business email — mike@** | Michael's personal business address (alias) | mike@adkadvancedwatersolutions.com | Michael | _______ |
| **Google Business Profile** | The local map / search listing ("plumber near me") | _______ | Michael / business | _______ |
| **Vercel** | Hosts the live website; auto-deploys from GitHub | (Michelle's account) | Michelle | _______ |
| **GitHub** | Where the website source code lives (working copy) | (Michelle's account) | Michelle | _______ |
| **EmailJS** | Routes the contact form to the business inbox | _______ | _______ | _______ |
| **Google Search Console** | Tells Google to index the site; SEO monitoring | _______ | Michael / business | _______ |
| **Domain registrar** | _Same as Cloudflare above — domain is registered there_ | — | — | — |

_Add any others: Canva, decal shop, social media (Facebook/Nextdoor), Bitwarden itself, etc._

---

## Who owns what (important)

- **Domain, Google Workspace, Business Profile, and email** are in **Michael's name / the business**. These are the core business assets and should stay his.
- **The website hosting (Vercel) and source code (GitHub)** are currently under **Michelle's personal accounts**. This is normal — she built it — but it means:
  - If Michelle **steps down**: transfer the GitHub repo to the new developer, and add them to (or transfer) the Vercel project.
  - If Michelle is **unavailable**: the new developer can rebuild/redeploy from the `code` folder included in this handoff. They do not strictly need Michelle's GitHub — the code folder is self-contained.

---

## The single most critical account

**Cloudflare.** It controls both the domain registration AND the DNS records that point the domain at the website and route the email. If access to Cloudflare is lost, the site and email can go down with no easy fix. Guard this login above all others.

---

## To do when the LLC is filed

- Update the domain registrant and Google Business Profile to the LLC name.
- Revisit any "licensed / insured" claims on the website.
- Update the business name in the website footer/header if it changes.

---

_Last updated: _____________________
_Maintained by: _____________________