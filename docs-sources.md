# Event Sources

Status as of 2026-07-16.

## Active (no key needed)

| Source | What it covers | Notes |
|---|---|---|
| Resident Advisor | Electronic/DJ | ~450 events, reliable |
| jazz-nyc.com | All NYC jazz listings | ~1100 events; capped at 20/day in feed |
| DoNYC | Indie concerts, comedy, film, theatre | today + 14 days |
| Songkick | Touring bands/artists | Bot detection limits to ~150 events (first 3 pages); browser headers + slow pacing keep page 1 alive |
| Thought Gallery | Talks, readings, cultural | 14-day window |
| The Skint | Free/cheap events digest | Parsed from daily RSS digests |
| Film Forum, Metrograph, IFC, Anthology, Nitehawk | Repertory/indie cinema | Nitehawk uses per-date venue pages |

## Available with an API key (free to obtain)

Set these as GitHub Actions **repository secrets** — the build picks them up
automatically and enables the source:

- `TICKETMASTER_API_KEY` — register at https://developer.ticketmaster.com
  (free tier: 5000 calls/day). Adds major-venue concerts.
- `BANDSINTOWN_APP_ID` — request at https://www.bandsintown.com/api/requests
  (approval takes a few days). Adds artist-targeted tracking: the scraper
  queries the top 100 artists from your taste profile and surfaces their NYC
  dates. This is the closest thing to "concerts from my Spotify library."

## Investigated, not viable (2026-07)

- **DICE** — `unified_search` API responds but no request shape found that
  returns event listings without an authenticated partner key; browse pages
  are a JS app with no embedded event data.
- **Oh My Rockness** — API domain no longer resolves; site bot-blocked (403).
- **Bandsintown without key** — hard 403 (identity policy).
- **AdHoc Presents** — bot-blocked (403 challenge).
- **NYC Parks events** — bot-blocked (403).
- **Spotify concerts** — no public API; the Bandsintown artist scraper is the
  practical substitute (it reads the Spotify-derived taste profile).
