# NOTES — Ascension Logs (Darkmoon Rankings)

Stand: 2026-08-22. Read-only public research, hoeflich sequentiell.
Keine erfundenen Spell-Koeffizienten. Snapshot: `data/logmeta.json`
(`pipeline/logmeta.py` → assemble `D.lmeta`).

Live-UI: https://darkmoon.ascensionlogs.gg/rankings
API-Host: `https://darkmoon.ascensionlogs.gg` (Vite-SPA, Bundle
`/assets/index-*.js`, Axios-Base unter `/api/…`).

Tenant-Geschwister (nicht gemined): `coa.`, `dawnrise.`, `bb.`,
ascensionlogs.gg Portal.

## Was die Seite oeffentlich ausliefert

Kein Auth noetig fuer Rankings-, Phasen-, Armory- und Search-JSON.
HTML-Routen ohne `/api` sind die SPA (3426 Byte Shell). JSON nur unter
`/api/…` (Axios `zt("/encounters/…")` → `/api/encounters/…`).

### Phasen / Orte

| Endpoint | Felder |
|---|---|
| `GET /api/phases` | `phases[]`: `phase_number`, `name`, `start_date`, `end_date`, `is_active`, `locations[]` (`location`, `is_main`, `track_progression`, `is_world_boss`) |
| `GET /api/phases/active` | aktuelle Phase (2026-08-22: **Phase 3** = „Phase 2 - Molten Core / Onyxia“) |
| `GET /api/home/phases` | kompakte Home-Karten |
| `GET /api/creatures/bosses` | 25 Locations, Boss-`id` / `boss_id` / `instance_type` (raid/dungeon), `mplusLevels` 1–20 |
| `GET /api/creatures/class-specs` | Darkmoon: nur `{Hero: {specs:["Hero"]}}` — **classless Wildcard** |
| `GET /api/creatures/bosses/{location}` | Bosse einer Zone |

### Player-Rankings (DPS / HPS)

Filter (aus SPA `getRankings`): `difficulty`, `class`, `phase`,
`playerCount`, `spec`, `page`, `limit`, `damageMode` (standard/…),
`realm`, `role`, `primaryStat`, `location`, `metric`, `cohort=global`.

| Endpoint | Nutzen |
|---|---|
| `GET /api/encounters/phase-rankings?phase=N` | **dichteste Meta-Quelle.** `metric` default `avg_dps`. Pro `boss_id` (MC 2010–2019, Onyxia 3019/3020): `rankingsByDifficulty.{normal,heroic,mythic,ascended}[]` Top-10 |
| dieselbe URL `&metric=avg_hps` | Healing-Board, gleiche Struktur |
| `GET /api/encounters/rankings/overall?phase=N` | All-Stars je Zone (wenige Zeilen, alle Paths inkl. Healing) |
| `GET /api/encounters/rankings/all-dungeons?phase=N&limit=` | flache DPS-Liste (4639 Zeilen in P3) — `avg_dps` kann Dungeon-Burst sein, nicht Raid-DPS |
| `GET /api/encounters/rankings/complete-raids?location=&difficulty=&phase=` | Full-Clear DPS; `location` **und** `difficulty` Pflicht |
| `GET /api/encounters/rankings/all` | in der SPA; Live-GET timeoutete (schwer) — nicht fuer Snapshot noetig |
| `GET /api/home/world-bosses` | All-Stars je WB: `dps`/`tank`/`healing` mit `class`/`spec`/`value`/`reportId` |
| `GET /api/home/world-boss-rankings?phase=` | All-Stars kompakt |
| `GET /api/home/all-dungeons?phase=` | Dungeon-Home |
| `GET /api/home/phase-rankings/{phaseNumber}` | Home-Karten, Query `difficulty`/`location`/`board` |

**Zeilenfelder (phase-rankings):** `character_id`, `character_name`,
`class` (fast immer `Hero`), `spec`, `avg_dps`, `avg_hps`,
`total_damage`, `total_healing`, `effective_healing`, `duration`,
`guild_name`, `raid_size`, `encounter_date`, `encounter_id`,
`report_id`, `tricks_count`, `pi_count`, `total_buff_count`,
**`primary_stat`**.

`spec` auf Darkmoon = Path (+ Rolle): `Intelligence`, `Duality`,
`Strength`, `Agility`, `Healing`, plus `* Tank`, oder unaufgeloest
`Hero` / (M+) `Talents`.

`primary_stat` Tokens: `intellect`, `duality`, `strength`, `agility`,
`spirit` (Healing-Board). Fast 1:1 zu `spec`.

### Mythic+

`GET /api/home/mythic-plus` — `classless: true`, Season/Week/Recent Runs,
Top-Spieler/Teams, Affixe mit `spell_id` (z. B. 80023 Resistant — Text
hat `$s1`, **kein** ersetzter Wert → nicht als Tooltip-Zahl uebernehmen).

`GET /api/mythic-plus/meta` — 18 Dungeons, Timer-Schaetzung, Affix-Sets
+ Run-Counts.

`GET /api/mythic-plus/class-presence` — 1182× Hero, 54 unattributed,
1236 Characters, Key bis 20 (2026-08-22).

`GET /api/mythic-plus/characters?limit=&withBests=1` — Scoreboard;
`spec` oft `Talents`/`Hero` → **kein Path**.

Attribution: `Leaderboard data: ascension.gg`.

### Reports / Combat

`GET /api/reports/public?limit=` — oeffentliche Reports (M+ Keys, Zeiten,
Affixe mit `id`/`school`/`icon`).

`GET /api/reports/{id}/encounters/{encounter_id}/combatants-info` —
gross (1,5 MB/Fight), oeffentlich. Nicht einbetten.

`GET /api/encounters/{encounter_id}/damage-by-ability` — **Enemy**-Spells
des Fights (Lucifron: Suppressing Shadows, Shadow Bolt…), nicht Player-Rotation.

`GET /api/reports/{id}/encounters/{encounter_id}/rankings-damage` —
Parse-Regeln + Target-Breakdown (inkl. Pets).

Encounter-Table-`id` (z. B. 122 Lucifron) ≠ Fight-`encounter_id`
(z. B. 21148). Rankings-URL mit Table-id → 404.

### Armory / Path (build-relevant)

| Endpoint | Felder |
|---|---|
| `GET /api/armory/by-name/{Name}` | `character.id/class/spec`, `has_armory`, latest capture |
| `GET /api/armory/character/{id}` | Inspect: `ci_resolved.primary_stat` `{id, token}`, `specialization.hero_build` (`entry_id`+`rank`), `talents.trees.abilities/talents` (Namen, `entry_id`, Tooltip-Text der **Seite**), `gear[]` `item_id`/enchant/gems, `stats_summary` (AP/SP/Hit/Haste/Expertise, Rating-Divisoren der **Seite**) |
| `GET /api/characters/{Name}/primary-stat` | `current.stat`, `totals[]`, `timeline[]`, `by_boss[]`, `coverage` |
| `GET /api/armory/talent-grid/hero` | leer (classless) |
| `GET /api/characters/search?q=` | Namenssuche |
| `GET /api/gearplanner/ep-weights?class=Hero&spec=Duality` | 404 — keine EP-Weights fuer Hero |

**Path-IDs** im Inspect: Strength **1**, Duality **6**. Passt zu
`C_PrimaryStat` / Addon `PATH|` (1 Str, 2 Agi, 3 Int, 4 Spirit=Healing,
6 Duality). Healing-Parses tragen Token **`spirit`**.

Effort (Duality, L60, Onyxia mythic Inspect): Gear mit AP **und** etwas
SP; Faehigkeit **Volt Spike** („65% weapon damage as Stormstrike“) —
genau der `wm`-Fall fuer Duality. **Nicht** als Katalog-Koeffizient
neu erfinden: Zahl steht schon im Katalogtext.

Blix: Rankings-Zeilen mal Duality, mal Strength; Inspect-Capture war
Strength. Path wechselt — ein Inspect ist kein Dauerzustand.

`GET /api/armory/talent-grid` und Vanilla-Talentbäume helfen auf
Darkmoon nicht. Ability-Listen kommen aus `hero_build` / `entry_id`
(unser `D.eid`).

### Sonstiges (wenig Builder-Nutzen)

- `GET /api/rankings/manastorm?bracket=solo` — Waves, Roster `spec`/`item_level`
- Guild-Progression/Speed: braucht Guild-Id
- Gearplanner Builds: Auth
- `/api/analytics/*`, Auth, Upload: weglassen

## Gemessen 2026-08-22 (Phase 3, MC + Onyxia)

DPS-Board (`avg_dps`), 410 Parse-Slots, 88 Unique-Chars:

| Path | Parse-Slots | Unique-Chars (Mehrheit) | primary_stat |
|---|---|---|---|
| Intelligence | 144 | 37 | intellect 148 |
| Duality | 136 | 18 | duality 138 |
| Strength | 55 | 10 | strength 58 |
| Hero (ungeklaert) | 37 | 14 | — |
| Agility | 29 | 6 | agility 29 |
| Tank-Varianten | 9 | 3 | — |

HPS-Board: **337 / 410 Healing** mit `primary_stat=spirit`. Rest Reste
(Hero/Int/Duality).

World-Boss All-Stars (Rollen gemischt): Healing 43, Intelligence 41,
Duality 22, Strength Tank 21, Agility 13, Strength 10, Hero oft
unaufgeloest.

M+: classless Hero, Key 20, Path in der Board-Spec unbrauchbar.

Schwierigkeiten im Raid-Board: normal / heroic / mythic / ascended.

## Was wir daraus machen (und was nicht)

**Nuetzlich**

- Alle fünf Paths sind in L60-Top-Parses **real** (nicht nur Theorie).
- Duality erscheint haeufig; Armory zeigt Waffen-als-Element + AP/SP-Mix
  → bestaetigt `pathFlags.wm` / Duality-Wertung, **aendert sie nicht**.
- Healing-Parses = `spirit` = Path of Healing (Addon-Id 4).
- Classless `Hero` erklaert, warum Katalog-Archetypen (Stormbringer, …)
  **nicht** die Log-„Klasse“ sind.
- `entry_id` in Armory ist spaeter fuer Ability-Haeufigkeit minenbar
  (naechster Schritt) — Snapshot bleibt klein.

**Nicht nutzen / nicht erfinden**

- Keine SP/AP-Koeffizienten aus DPS-Zahlen.
- Keine Tooltip-Flats aus Parses oder aus Logs-Tooltip-Text (`$s1`).
- Rating-Divisoren der Logs-Armory (Hit 10, Crit 14, …) sind **deren**
  Gearplanner, nicht von uns aus DBC gemessen — nicht uebernehmen.
- Int „fuehrt“ die Slot-Zaehlung ≠ Int ist der richtige Path. Pets,
  Fightlaenge, wer loggt, Bias.
- All-Dungeon-`avg_dps` (z. B. 200k auf 5s) nicht als Raid-DPS lesen.
- Ein beliebter Parse ist kein Generator-Seed.

**Path-Scoring:** unveraendert. Meta ist Hinweis, kein Override.

## UI

Builder: Generator + Analyse-Path + Wissen-Paths + Archetypen-Hinweis,
jeweils hinter `details` („Log-Meta (Darkmoon, Rankings)“). Kein
Rankings-Wall. Synergien unangetastet (kein Chrome/Token/Nav).

## Remine

```bash
python3 pipeline/logmeta.py              # Live, ~5–6 GETs, 1,5 s Pause
python3 pipeline/logmeta.py --from-cache # _tmp_ascensionlogs/
```

`_tmp_*` nicht committen. Snapshot `data/logmeta.json` schon.

## Naechste Minen

1. Mehrere Armory-Inspects → `entry_id`-Haeufigkeit ∩ Katalog (`D.eid`),
   kompakt top-N je Path — erst wenn n ≥ ~20 Inspects, sonst Bias.
2. Player `damage_by_ability` (nicht Enemy-Fight-DBA), falls ein
   schlanker Public-Endpoint existiert (SPA: Report-Panels).
3. Healing-Board nach Boss (welche Heiler-Kits), ohne Koeffizienten.
4. M+ Captures mit Talents (UI hat `mplus-talent-strip`) — nur wenn
   JSON Path/entryId liefert, nicht aus „Talents“-Label raten.
