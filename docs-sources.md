# Event Sources

Status as of 2026-08-07.

> **Testing note:** these hosts are unreachable from the Claude dev sandbox
> (egress allowlist returns `403 Host not in allowlist` for *every* event
> site). A 403 seen locally therefore says nothing about whether a source is
> bot-blocked. Scrapers can only be exercised from CI — push to a `claude/**`
> branch and read the "Full build" step, or run the workflow with `mode: probe`
> to hit `scripts/dev/probe-sources.js`.

## Active (no key needed)

| Source | What it covers | Notes |
|---|---|---|
| Resident Advisor | Electronic/DJ | ~450 events, reliable |
| jazz-nyc.com | All NYC jazz listings | ~1100 events; capped at 20/day in feed |
| DoNYC | Indie concerts, comedy, film, theatre | today + 14 days |
| Songkick | Touring bands/artists | Yields only ~40 events — far below the ~150 the scraper is written for. See "The live-band gap" below. |
| Thought Gallery | Talks, readings, cultural | 14-day window |
| The Skint | Free/cheap events digest | Parsed from daily RSS digests |
| Screen Slate | Repertory/arthouse screenings | Covers the one-off 16mm/microcinema long tail the venue scrapers miss |
| Film Forum, Metrograph, IFC, Anthology, Nitehawk | Repertory/indie cinema | Nitehawk uses per-date venue pages |

## The live-band gap

Songkick and DICE are both weak, which leaves touring/indie bands
underrepresented relative to jazz and electronic. Options, cheapest first:

1. **`TICKETMASTER_API_KEY`** — the scraper is already written
   (`scrapers/ticketmaster.js`) and enables itself the moment the secret
   exists. Free tier, 5000 calls/day, instant signup. Biggest win for the
   least effort; covers MSG, Barclays, Radio City, Forest Hills, Brooklyn
   Steel, Terminal 5 and most mid-size rooms.
2. **`SEATGEEK_CLIENT_ID`** — free and issued instantly at
   <https://seatgeek.com/account/develop>. Good coverage of exactly the
   mid-size venues Songkick is missing. Needs a scraper writing.
3. **Venue-direct scrapers** — no key, most durable, best matched to the taste
   profile: the Bowery Presents network (Bowery Ballroom, Mercury Lounge,
   Music Hall of Williamsburg, Brooklyn Steel), Elsewhere, Baby's All Right,
   Le Poisson Rouge, Knockdown Center. Slower to write, one parser each, but
   they don't depend on an aggregator's goodwill.
4. **`BANDSINTOWN_APP_ID`** — scraper already written, but access is now
   restricted to artists and their representatives; a non-artist request goes
   to biz@bandsintown.com and may be declined. Treat as unlikely.

## Investigated, not viable (2026-07/08)

- **DICE** — `unified_search` API responds but no request shape found that
  returns listings without an authenticated partner key; browse pages are a JS
  app with no embedded event data.
- **Songkick official API** — no longer issuing new public keys; existing
  integrations are partner-only.
- **Oh My Rockness** — API domain no longer resolves; site bot-blocked.
- **Bandsintown without key** — hard 403 (identity policy).
- **AdHoc Presents**, **NYC Parks events** — bot-blocked (403 challenge).
- **Spotify concerts** — no public API; the Bandsintown artist scraper is the
  practical substitute (it reads the Spotify-derived taste profile).
