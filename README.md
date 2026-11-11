<img src="assets/icon.svg" width="64" height="64" alt="">

# priedangu-darbo-laikas

Find the nearest air-raid shelter (*priedanga*) in Lithuania in seconds and see whether it is actually open right now.

The site is in Lithuanian, English, Ukrainian, Russian and Polish. It works offline once it has been opened, and your location never leaves your phone.

## What's in here

| Part | What it does |
|---|---|
| `src/` | Pulls the official shelter register, keeps a SQLite copy with change history, and exports a compact dataset for the website |
| `web/` | The website: one screen with a map and a panel. The panel has the "find nearest" button, the nearest shelters with open/closed status and directions, the selected shelter, and filters. It is fully static. |
| `.github/workflows/deploy.yml` | Daily refresh and deploy to GitHub Pages |

## Data source

[Priedangų tinklas Lietuvoje](https://open.geodata.gov.lt/datasets/8a1e4b06ca714e2983b67c737c667abe_0), published by PAGD on open.geodata.gov.lt. It is an ArcGIS FeatureServer point layer covering all of Lithuania, republished every afternoon (about 14:45 UTC).

Things to know about it:

- **`object_id` is not stable.** It runs exactly 1..N, which suggests the layer is renumbered on every republish. The sync keeps its own `shelters.id` and matches records by content, then by address, then by name and distance (`src/sync/match.ts`).
- **Opening hours are mostly missing.** Only about 11% of shelters have `darbo_valandos`, and it is free text. `patekimas_visa_para` (24/7 access) is `null` for about 77%, and for every one of Vilnius's 2,037 shelters. In this project, `null` means "unknown", never "no".
- About 68 locations share coordinates with another shelter, and a few records are exact duplicates. They are kept as they are.

### Opening hours

`src/hours.ts` turns the free text into a weekly schedule. It handles 737 of the 741 published strings. It is strict on purpose: anything it does not fully understand becomes "unknown", never a guess. The website then shows one of:

| Colour | Meaning |
|---|---|
| Green | Officially 24/7, or open now by a schedule that names the days |
| Amber | Open now by time of day, but the source didn't say which days |
| Red | Closed now by its published hours, or marked as not in use |
| Pink | Officially **not** 24/7, but no hours were published |
| Grey | The operator filled in neither the 24/7 flag nor the hours (most shelters) |

The status list in the panel shows a live count for each colour, and each row toggles that colour on the map.

Times are always evaluated in Europe/Vilnius time, whatever the phone's time zone is.

## Institution hours (OpenStreetMap)

The official register rarely says when a shelter is open, but the shelter is often in a school, clinic, library or office whose hours are known. `pnpm enrich`:

1. Downloads every named place in Lithuania that has `opening_hours` (about 9,300) from Overpass.
2. Links a shelter to one of these places only when it is within 100 m and the names share a distinctive word. Lithuanian case endings are normalised, and town, municipality and eldership names don't count. A single shared word is only accepted when the place type fits the shelter type (`src/osm/match-hosts.ts`).
3. Parses OpenStreetMap hours strictly (`src/osm/opening-hours.ts`): about 98% of values parse, and the rest are ignored.

As of 2026-11-11 this links **48 shelters**, mostly clinics, schools, libraries and museums. 25 of them have no official hours. Coverage grows as people add `opening_hours` in OpenStreetMap, and the card links to the OSM object.

A shelter whose official data is empty or "not 24/7" turns **amber** while the institution is open, and says so ("Pastate esanti įstaiga dabar dirba", the institution in the building is open now). Institution hours never make a shelter green, and official data always wins.

## Usage

Requires Node ≥ 24, which runs the `.ts` files directly.

```sh
pnpm install
pnpm sync            # fetch + upsert into data/priedangos.sqlite
pnpm enrich          # refresh OpenStreetMap institution hours and re-link shelters
pnpm export          # write GeoJSON + web/public/data/shelters.json
pnpm dev             # website on http://localhost:5173
pnpm release         # sync + enrich + export + production build into web/dist
pnpm stats           # coverage numbers + last sync runs
pnpm test            # sync, hours parser and open/closed logic
pnpm typecheck
```

Useful URL parameters:

- `?lang=lt|en|uk|ru|pl` forces a language.
- `?at=54.6872,25.2797` opens the page with that point as the origin. Handy for QR codes on building doors.

On the map, double-click (mouse) or press and hold (touch) to set "I am here". A single tap only does that after pressing "Pasirinkti vietą žemėlapyje" (choose a place on the map), so panning never moves your location by accident.

Each sync:

1. Downloads every page and refuses to continue if the record count doesn't match the source's count.
2. Matches records to known shelters, then writes added, updated, removed and restored rows in a single transaction.
3. Logs every change with a per-field diff in `shelter_changes`.
4. Refuses to apply if the source suddenly has under 80% of the active shelters, to guard against a half-published layer.
5. Warns when the source schema gains or loses fields.

## Hosting

The site is static and runs on GitHub Pages. `.github/workflows/deploy.yml` runs every day at 15:30 UTC (after the afternoon publish), on every push to `main`, and on demand:

1. Restores `priedangos.sqlite` from the `data` branch. The database keeps shelter ids stable and holds the change history, so it must survive between runs. The branch holds a single commit that is replaced each run, so the repo doesn't grow.
2. Runs sync and enrich. If either fails (source down, safety check tripped, Overpass down), the previous data is kept.
3. Exports, builds with the Pages base path, and deploys.
4. Saves the database back to `data`, then fails the run if sync or enrich failed, so GitHub sends an email.

GitHub pauses scheduled workflows in a repository with no activity for 60 days and emails before it does; re-enable it from the Actions tab.

## Offline

The build writes `sw.js` with the exact file list. On first visit it caches the app, the fonts for all five scripts, and the shelter list (about 230 KB gzipped). Map tiles are cached as they are viewed. The nearest-shelter list works with no network at all, though the map background may not load.

## Safety wording

The two short notes in the panel follow lt72.lt, [Oro pavojus: ką svarbu žinoti?](https://lt72.lt/rekomendacijos-oro-pavojaus-atveju/). The red-alert note covers what to do if the shelter is far or locked, and the second note covers what to do if it's locked when you get there. The site links there for everything else.

## Reference material

- [LAR – rekomendacijos padidinto saugumo patalpų įrengimui](https://www.architekturumai.lt/wp-content/uploads/PSP-rekomendacijos.pdf): p.15, what to do when the building has no safe room.
- [LAR – Slėptuvės](https://www.architekturumai.lt/wp-content/uploads/SLEPTUVES-pask-TM-LAR.pdf): slide deck on shelter types and norms.
- [lt72.lt – priedangos ir KAS](https://lt72.lt/kolektyvines-apsaugos-statiniai-priedangos-ir-rusiai-3/)

## Before going public

- **Map tiles.** `tile.openstreetmap.org` is fine for testing, but [its usage policy](https://operations.osmfoundation.org/policies/tiles/) doesn't allow a site that could get a surge of traffic during an alert. Switch to a paid or self-hosted tile provider first.
- **HTTPS.** Geolocation and the service worker only work on HTTPS.
