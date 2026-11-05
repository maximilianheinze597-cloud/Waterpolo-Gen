# Wasserball Arena

Vollständiges Wasserballspiel für den Browser. **Starten: `index.html` doppelklicken** (Chrome, Edge, Firefox – keine Installation, kein Internet nötig).

## Enthalten
- 10 Nationalteams mit unterschiedlicher Stärke, 13er-Kader (Nr. 1–13) mit Rollen (Torwart, Center, Außen, Distanz, Punkt)
- Kappen: Weiß/Blau für Heim/Gast, rote Torhüterkappen, 6 Farben und 3 Designs wählbar, Ohrenschützer, Nummern
- 4 Viertel, Schwimmduell zum Anwurf, Seitenwechsel, 30-s-/20-s-Angriffszeit
- Regeln: Fouls, Hinausstellung (20 s, Überzahl), 3 persönliche Fehler, Brutalität (rote Karte), Strafwurf (5 m), 2-m-Regel, Eckball, Torabwurf, 6-m-Freiwurfregel, Auszeiten, Auswechslung
- 2 Schiedsrichter mit Pfiff und Flagge in Teamfarbe, 2 Torrichter
- Torwart-KI, Manndeckung, Pässe, Schüsse mit Kraft, Pfosten/Latte, Paraden, Blocks
- Penaltyschießen bei Unentschieden, Statistik am Ende, synthetische Sounds
- 3 Schwierigkeitsgrade, wählbare Spiellänge (1,5 bis 8 Min je Viertel)

## Steuerung
WASD/Pfeile schwimmen · Shift Sprint · Maus zielen · Linksklick (halten) Schuss · Rechtsklick/E Pass · Leertaste Ball stibitzen · F Täuschung · Q/Tab Spieler wechseln · X Auswechseln (bei Unterbrechung) · T Auszeit · P/Esc Pause
Strafwurf als Torwart: W/S = oben/unten, Leertaste = Mitte.

## Test
`node tests/simulation.js` simuliert komplette KI-gegen-KI-Spiele ohne Browser.

## Hinweis GitHub
`index.html` ist komplett eigenständig (CSS und JavaScript sind eingebaut) und läuft daher auch ohne die Ordner `js/` und `tests/`, z. B. über GitHub Pages. Der Ordner `js/` enthält nur den Quellcode.
