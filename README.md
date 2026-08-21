# Aldi Ehrfürchtig — Buildschmiede

Zwei Seiten und ein Addon für Project Ascension, Season 10 Wildcard.

- **[Buildschmiede](https://lzra2000.github.io/aldi-buildschmiede/)** — interaktiver Builder.
  3.071 Fähigkeiten und Talente durchsuchbar, 30 Ability- und 25 Talent-Plätze.
  Warnt vor doppelten Skills, fehlenden Voraussetzungen und fehlender Skalierung,
  empfiehlt dir den passenden Path und begründet das mit deinen konkreten Skills.
  Builds lassen sich per Link teilen.
- **[Synergiekompendium](https://lzra2000.github.io/aldi-buildschmiede/synergien.html)** —
  Nachschlagewerk: was mit was zusammenspielt, woraus Schaden und Heilung skalieren.
- **[Companion-Addon](AscBuildschmiede.zip)** — `/bs` im Spiel exportiert deinen
  echten Charakter (Abilities, Talente, Path, Stats, Gear, Seltenheits-Budget) als
  Text. Auf der Seite einfügen, dann sagt sie dir, was an deinem tatsächlichen
  Build kritisch ist. `/bs target` liest den Build deines Ziels aus — den kannst
  du auf der Seite unter *Vergleich* gegen deinen eigenen stellen.

## Addon installieren

1. `AscBuildschmiede.zip` herunterladen.
2. Nach `Interface\AddOns\` entpacken. Es muss danach
   `Interface\AddOns\AscBuildschmiede\AscBuildschmiede.toc` geben.
3. Spiel neu starten, dann `/bs`.

| Befehl | Wirkung |
|---|---|
| `/bs` | Fenster auf oder zu |
| `/bs target` | Build des angeklickten Spielers auslesen |
| `/bs gear` | Gear im Export an/aus |
| `/bs stats` | Stats und Waffen im Export an/aus |

Das Addon schickt nichts ins Internet. Es liest den Charakter aus und schreibt
Text in ein Fenster — kopieren musst du selbst.

## Technisch

Beide Seiten sind eigenständige HTML-Dateien: kein Server, keine Datenbank,
keine externen Anfragen außer Google Fonts. Öffnen reicht.

Datenbasis: Season-10-Katalog (1.321 Abilities, 1.750 Talente). Die Stat-Zahlen
sind an einem Charakter der Stufe 51 auf Path of Intelligence gemessen, die
Path-Tooltips wortgetreu aus dem Client übernommen.
