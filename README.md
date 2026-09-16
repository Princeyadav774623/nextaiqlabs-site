# nextaiQlabs

Marketing site for nextaiQlabs, a seven-studio AI and maker programme that runs
inside schools in Dehradun.

Live site: (add the Netlify URL here once deployed)

## What is in here

| File | What it is |
|---|---|
| `index.html` | The entire site. One file, no build step, no dependencies. |
| `kit.jpg` | Full-bleed hero image, the equipment we bring to a school. |
| `prince.jpg` | Founder portrait. |
| `apps-script.gs` | Runs inside the Google Sheet, not on this host. Kept here for version history. |
| `_headers` | Security headers applied by Netlify. |
| `robots.txt` | Allows search engines to index the site. |
| `netlify.toml` | Tells Netlify to publish the repo root and run no build. |

## How the enquiry form works

The site is static and stores nothing. The form posts to a Google Apps Script
web app, which does two things:

1. Appends a row to the "nextaiQlabs requests" Google Sheet
2. Emails prince324yadav@gmail.com with the details

Because the backend is Google, the form behaves identically on any host, and on
a local file too.

### Guards on the endpoint

- Hidden honeypot field, dropped if filled
- Shared token that must match `FORM_TOKEN` in both `index.html` and `apps-script.gs`
- Rate limit of 25 submissions per 10 minute window
- Indian mobile validation, 10 digits starting 6 to 9, checked in the browser
  and again server side because browser checks are bypassable
- Duplicate guard on the same school and number within 10 minutes

### Changing the Apps Script

Editing the script does **not** update the live endpoint. After saving:

`Deploy > Manage deployments > pencil > Version: New version > Deploy`

Using "New deployment" instead issues a different `/exec` URL and the form
silently stops working.

## Deploying

Netlify builds from `main` automatically. Push to `main` and the site updates.
