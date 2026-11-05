// Konfiguration: Spielfeld, Regeln, Teams, Kappen, Rollen, Schwierigkeit
(function () {
  const WP = (globalThis.WP = globalThis.WP || {});

  WP.C = {
    W: 30, H: 20,             // Becken in Metern (Herren: 30 x 20)
    GOAL_W: 3, GOAL_H: 0.9,   // Tor 3 m breit, 0,9 m über Wasser
    L2: 2, L5: 5, L6: 6,      // 2-m (rot), 5-m (gelb), 6-m (grün) Linie
    PR: 0.42, BR: 0.11,       // Spieler- und Ballradius
    SWIM: 3.2, SPRINT: 4.3,   // Schwimmtempo m/s (Arcade-skaliert)
    QUARTER_S: 480,           // 8 Minuten Spielzeit pro Viertel
    QUARTERS: 4,
    SHOT_CLOCK: 30, SHOT_CLOCK_SHORT: 20,
    EXCL_S: 20,               // Hinausstellung 20 s
    BRUTAL_S: 240,            // Brutalität: 4 Minuten Ersatz-Sperre
    MAX_FOULS: 3,             // 3 persönliche Fehler = Ausschluss fürs Spiel
    TIMEOUTS: 2, TIMEOUT_S: 60,
  };

  // Kappenfarben (Heim = weiß, Gast = blau, Torhüter = rot, Nr. 1 und 13)
  WP.CAPS = [
    { id: 'white',  name: 'Weiß',    hex: '#f3f6fb', ink: '#14275c' },
    { id: 'blue',   name: 'Blau',    hex: '#1f46c8', ink: '#ffffff' },
    { id: 'navy',   name: 'Dunkelblau', hex: '#14246a', ink: '#ffffff' },
    { id: 'red',    name: 'Rot',     hex: '#d7262e', ink: '#ffffff' },
    { id: 'green',  name: 'Grün',    hex: '#1f9a4a', ink: '#ffffff' },
    { id: 'yellow', name: 'Gelb',    hex: '#f2c81c', ink: '#222222' },
    { id: 'black',  name: 'Schwarz', hex: '#1b1b20', ink: '#ffffff' },
    { id: 'orange', name: 'Orange',  hex: '#ee7d1a', ink: '#ffffff' },
  ];
  WP.CAP_STYLES = [
    { id: 'classic', name: 'Klassisch (einfarbig)' },
    { id: 'stripe',  name: 'Längsstreifen' },
    { id: 'panels',  name: 'Zweifarbig' },
  ];
  WP.GK_CAP = { hex: '#d7262e', ink: '#ffffff' };

  // Rollen im Angriff: Position als Anteil (tiefe = Meter von der Torlinie, seite = -1..1)
  WP.ROLES = {
    GK: { name: 'Torwart',            short: 'TW', depth: 0.5, side: 0 },
    CF: { name: 'Center (Lochspieler)', short: 'CF', depth: 2.6, side: 0 },
    LW: { name: 'Außen links',        short: 'AL', depth: 2.3, side: -0.62 },
    RW: { name: 'Außen rechts',       short: 'AR', depth: 2.3, side: 0.62 },
    LD: { name: 'Distanz links',      short: 'DL', depth: 6.6, side: -0.38 },
    RD: { name: 'Distanz rechts',     short: 'DR', depth: 6.6, side: 0.38 },
    PT: { name: 'Punkt',              short: 'PT', depth: 8.6, side: 0 },
  };
  // Kappennummern: 1 Torwart, 2-7 Feldspieler, 8-12 Bank, 13 Ersatztorwart
  WP.LINEUP = [
    { num: 1, role: 'GK' }, { num: 2, role: 'LW' }, { num: 3, role: 'LD' },
    { num: 4, role: 'PT' }, { num: 5, role: 'RD' }, { num: 6, role: 'RW' },
    { num: 7, role: 'CF' },
    { num: 8, role: 'CF' }, { num: 9, role: 'LD' }, { num: 10, role: 'RD' },
    { num: 11, role: 'LW' }, { num: 12, role: 'RW' }, { num: 13, role: 'GK' },
  ];

  // Mannschaften (fiktive Spielernamen, nur Namen der Länder)
  WP.TEAMS = [
    { id: 'ger', name: 'Deutschland', short: 'GER', rating: 74, home: 'white', away: 'blue',  style: 'classic', names: ['Brandt','Kessler','Lindner','Voss','Hartmann','Reuter','Falk','Schuster','Amsel','Weigand','Roth','Seidel','Berger'] },
    { id: 'hun', name: 'Ungarn',      short: 'HUN', rating: 90, home: 'white', away: 'blue',  style: 'stripe',  names: ['Nagy','Kovács','Tóth','Szabó','Horváth','Varga','Molnár','Farkas','Papp','Lakatos','Fekete','Balogh','Juhász'] },
    { id: 'srb', name: 'Serbien',     short: 'SRB', rating: 92, home: 'white', away: 'blue',  style: 'panels',  names: ['Jovanović','Petrović','Nikolić','Ilić','Marković','Đorđević','Stojanović','Pavlović','Savić','Lazić','Kostić','Milić','Tomić'] },
    { id: 'cro', name: 'Kroatien',    short: 'CRO', rating: 86, home: 'white', away: 'blue',  style: 'classic', names: ['Horvat','Kovačić','Babić','Marić','Jurić','Novak','Knežević','Vuković','Perić','Bošnjak','Kralj','Matić','Šarić'] },
    { id: 'esp', name: 'Spanien',     short: 'ESP', rating: 88, home: 'white', away: 'blue',  style: 'stripe',  names: ['García','Martínez','López','Sánchez','Pérez','Gómez','Ruiz','Díaz','Moreno','Álvarez','Romero','Navarro','Torres'] },
    { id: 'ita', name: 'Italien',     short: 'ITA', rating: 87, home: 'white', away: 'blue',  style: 'classic', names: ['Rossi','Russo','Ferrari','Esposito','Bianchi','Romano','Colombo','Ricci','Marino','Greco','Bruno','Gallo','Conti'] },
    { id: 'gre', name: 'Griechenland',short: 'GRE', rating: 85, home: 'white', away: 'blue',  style: 'panels',  names: ['Papadopoulos','Nikolaou','Georgiou','Dimitriou','Ioannou','Pappas','Vasiliou','Karras','Mavros','Alexiou','Stavrou','Leontis','Fotiou'] },
    { id: 'usa', name: 'USA',         short: 'USA', rating: 84, home: 'white', away: 'blue',  style: 'stripe',  names: ['Miller','Johnson','Davis','Wilson','Anderson','Taylor','Moore','Clark','Walker','Hall','Allen','Young','King'] },
    { id: 'aus', name: 'Australien',  short: 'AUS', rating: 78, home: 'white', away: 'blue',  style: 'classic', names: ['Smith','Jones','Brown','Cooper','Reid','Hughes','Fraser','Murray','Webb','Carter','Dunn','Ellis','Grant'] },
    { id: 'mne', name: 'Montenegro',  short: 'MNE', rating: 83, home: 'white', away: 'blue',  style: 'panels',  names: ['Vujović','Radović','Perović','Popović','Burić','Mitrović','Janković','Knežević','Brajović','Raičević','Šćepanović','Bećiri','Vlahović'] },
  ];

  WP.DIFFICULTY = {
    easy:   { name: 'Leicht',   speed: 0.86, react: 0.55, aim: 0.55, gk: 0.45, steal: 0.55, foul: 0.7 },
    normal: { name: 'Normal',   speed: 0.96, react: 0.8,  aim: 0.8,  gk: 0.7,  steal: 0.8,  foul: 1.0 },
    hard:   { name: 'Schwer',   speed: 1.04, react: 1.0,  aim: 1.0,  gk: 0.92, steal: 1.0,  foul: 1.2 },
  };

  // Viertel-Länge in echten Sekunden (Spielzeit läuft entsprechend schneller)
  WP.QUARTER_REAL = [
    { id: 90,  name: 'Kurz (1,5 Min je Viertel)' },
    { id: 180, name: 'Normal (3 Min je Viertel)' },
    { id: 300, name: 'Lang (5 Min je Viertel)' },
    { id: 480, name: 'Echtzeit (8 Min je Viertel)' },
  ];

  WP.RULES_TEXT = [
    ['Spielfeld', 'Becken 30 × 20 m, Tore 3 m breit. Linien: 2 m (rot), 5 m (gelb), 6 m (grün) und Mittellinie (weiß).'],
    ['Mannschaften', '7 Spieler im Wasser (1 Torwart + 6 Feldspieler), bis zu 13 im Kader. Kappen: Heim weiß, Gast blau, Torhüter rot (Nr. 1 und 13).'],
    ['Spielzeit', '4 Viertel à 8 Minuten effektive Spielzeit (hier auf deine Wunschlänge skaliert). Seitenwechsel zur Halbzeit.'],
    ['Schwimmduell', 'Jedes Viertel beginnt mit dem Sprint zum Ball in der Beckenmitte.'],
    ['Angriffszeit', '30 Sekunden pro Angriff, nach Eckball, Hinausstellung oder Abpraller nur noch 20 Sekunden. Läuft sie ab, bekommt der Gegner den Ball.'],
    ['Gewöhnliches Foul', 'Freiwurf für den Gegner. Innerhalb der 6-m-Zone darf nicht direkt aufs Tor geworfen werden – erst Pass oder Schwimmen über die 6-m-Linie.'],
    ['Hinausstellung', 'Schweres Foul (Halten, Untertauchen, Spritzen): 20 Sekunden raus. Der Gegner spielt in Überzahl (6 gegen 5). Rückkehr nach 20 s, nach einem Tor oder bei Ballgewinn.'],
    ['Persönliche Fehler', 'Beim 3. Fehler ist der Spieler für das Spiel gesperrt und wird nach der Hinausstellung durch einen Spieler der Bank ersetzt.'],
    ['Strafwurf (5 m)', 'Ein Foul, das ein sicheres Tor innerhalb der 5-m-Zone verhindert, ergibt einen Strafwurf von der 5-m-Linie gegen den Torwart allein.'],
    ['Brutalität', 'Absichtliche Tätlichkeit: roter Karton, 4 Minuten Sperre plus Strafwurf.'],
    ['2-m-Regel', 'Angreifer ohne Ball dürfen nicht vor der 2-m-Linie stehen (Abseits) – Freiwurf für die Verteidigung.'],
    ['Eckball', 'Lenkt die Verteidigung oder der Torwart den Ball über die eigene Torlinie, gibt es Eckball von der 2-m-Linie.'],
    ['Torabwurf', 'Schießt der Angreifer über die Torlinie, bekommt der Torwart den Abwurf.'],
    ['Torwart', 'Darf nur im eigenen Bereich mit beiden Händen spielen und die Mittellinie nicht überqueren.'],
    ['Auszeit', 'Jede Mannschaft hat 2 Auszeiten à 1 Minute, nur im eigenen Ballbesitz.'],
    ['Schiedsrichter', 'Zwei Schiedsrichter laufen an den Beckenseiten und zeigen mit Pfiff und Flagge in der Farbe des Ballbesitz-Teams an. Zwei Torrichter stehen an den Torlinien.'],
    ['Entscheidungsschießen', 'Steht es nach vier Vierteln unentschieden, folgen 5-m-Penaltys (5 Schützen je Team, danach Sudden Death).'],
  ];

  WP.CONTROLS_TEXT = [
    ['W A S D / Pfeiltasten', 'Schwimmen'],
    ['Shift', 'Sprint (kostet Ausdauer)'],
    ['Maus', 'Zielen'],
    ['Linke Maustaste (halten)', 'Schuss – länger halten = mehr Kraft'],
    ['Rechte Maustaste / E', 'Pass auf den Mitspieler in Zielrichtung'],
    ['Leertaste', 'Ball stibitzen / Gegner bedrängen (Risiko: Foul!)'],
    ['F', 'Schusstäuschung (lockt Verteidiger)'],
    ['Q / Tab', 'Spieler wechseln (nächster zum Ball)'],
    ['X', 'Auswechseln bei Spielunterbrechung'],
    ['T', 'Auszeit (nur im eigenen Ballbesitz)'],
    ['P / Esc', 'Pause'],
    ['Strafwurf: Schütze', 'Maus zielen, Klick = Wurf'],
    ['Strafwurf: Torwart', 'W / S oder ↑ / ↓ = Sprung nach oben / unten (vor dem Schuss drücken)'],
  ];
})();
