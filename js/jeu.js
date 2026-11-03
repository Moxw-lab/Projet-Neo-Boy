// =====================================================
//  VOLT — Les gardiens de Néo-Cité
//  Fichier principal : boucle de jeu, joueur, ennemis, missions
// =====================================================

const LARGEUR = 160;
const HAUTEUR = 144;
const canvas = document.getElementById('ecran');
const ctx = canvas.getContext('2d');

const $ = (id) => document.getElementById(id);
const ui = {
  titre: $('titre'), menuTitre: $('menu-titre'),
  dialogue: $('dialogue'), dialogueNom: $('dialogue-nom'), dialogueTexte: $('dialogue-texte'),
  toast: $('toast'), pause: $('pause'), pauseObjectif: $('pause-objectif'), menuPause: $('menu-pause'),
  fin: $('fin'), mission: $('mission'),
};

const DIRECTIONS = {
  haut: { x: 0, y: -1 }, bas: { x: 0, y: 1 },
  gauche: { x: -1, y: 0 }, droite: { x: 1, y: 0 },
};

// ---------- Données des missions ----------
const CELLULES = [
  { id: 'labo', tx: 1, ty: 2 },   // cachée derrière le labo
  { id: 'parc', tx: 36, ty: 11 }, // près de l'étang
  { id: 'coin', tx: 38, ty: 18 }, // tout au sud-est
];
const DRONES_VILLE = [[8, 12], [26, 17], [34, 16], [16, 18], [30, 2]];
const DRONES_USINE = [[5, 23], [34, 23], [12, 27], [28, 27], [20, 22]];
const PORTES = {
  '4,4': 'Le labo du Dr Ohm. Pas le temps de faire la sieste !',
  '12,13': "L'atelier de Mira. Ça sent l'huile de moteur.",
  '25,4': 'La maison de Léo. Il y a des dessins de robots aux fenêtres.',
};

// ---------- État de la partie (ce qui est sauvegardé) ----------
const CLE_SAUVEGARDE = 'volt-sauvegarde';
let etat = nouvelEtat();

function nouvelEtat() {
  return { mission: 0, cellules: [], bossVu: false };
}

function sauver() {
  try { localStorage.setItem(CLE_SAUVEGARDE, JSON.stringify(etat)); } catch (e) { /* pas grave */ }
}

function charger() {
  try {
    const texte = localStorage.getItem(CLE_SAUVEGARDE);
    return texte ? { ...nouvelEtat(), ...JSON.parse(texte) } : null;
  } catch (e) {
    return null;
  }
}

// ---------- Variables du jeu ----------
let mode = 'titre'; // 'titre' | 'jeu' | 'pause' | 'fin'
let frame = 0;
let secousse = 0;   // tremblement de l'écran quand Volt est touché
let joueur, pnjs = [], ennemis = [], tirs = [], tirsEnnemis = [], particules = [], objets = [], boss = null;
let dialogue = null;
let choixTitre = [], selectionTitre = 0;

// =====================================================
//  Création des entités
// =====================================================

function creerJoueur() {
  // hb = "hitbox" : [décalage x, décalage y, largeur, hauteur]
  return { x: 5 * TILE, y: 7 * TILE, hb: [3, 8, 10, 8], dir: 'bas', hp: 3, hpMax: 3, invincible: 0, recharge: 0, marche: 0 };
}

function creerPnjs() {
  return [
    { id: 'ohm', nom: 'DR OHM', sprite: 'ohm', x: 4 * TILE, y: 5 * TILE, hb: [2, 4, 12, 12] },
    { id: 'mira', nom: 'MIRA', sprite: 'mira', x: 12 * TILE, y: 14 * TILE, hb: [2, 4, 12, 12] },
    { id: 'leo', nom: 'LÉO', sprite: 'leo', x: 25 * TILE, y: 5 * TILE, hb: [2, 4, 12, 12] },
  ];
}

function creerDrone(tx, ty, rapide = false) {
  return { x: tx * TILE, y: ty * TILE, hb: [2, 2, 12, 10], hp: 2, vitesse: rapide ? 0.7 : 0.5, dx: 0, dy: 0, timer: 0, flash: 0 };
}

function creerEnnemis() {
  const liste = [];
  if (etat.mission >= 1 && etat.mission <= 5) {
    for (const [tx, ty] of DRONES_VILLE) liste.push(creerDrone(tx, ty));
  }
  if (etat.mission === 5) {
    for (const [tx, ty] of DRONES_USINE) liste.push(creerDrone(tx, ty, true));
  }
  return liste;
}

function creerObjets() {
  if (etat.mission !== 1) return [];
  return CELLULES
    .filter((c) => !etat.cellules.includes(c.id))
    .map((c) => ({ type: 'cellule', id: c.id, x: c.tx * TILE, y: c.ty * TILE, hb: [4, 3, 8, 10] }));
}

function creerBoss() {
  return { x: 18 * TILE, y: 24 * TILE, hb: [2, 2, 28, 28], hp: 14, hpMax: 14, sens: 1, timer: 90, flash: 0, vaincu: false };
}

// =====================================================
//  Collisions
// =====================================================

function boite(e) {
  const [ox, oy, w, h] = e.hb;
  return { x: e.x + ox, y: e.y + oy, w, h };
}

function chevauche(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function solideA(px, py) {
  return estSolide(tuileA(Math.floor(px / TILE), Math.floor(py / TILE)));
}

function zoneBloquee(x, y, w, h) {
  return solideA(x, y) || solideA(x + w - 1, y) || solideA(x, y + h - 1) || solideA(x + w - 1, y + h - 1);
}

// L'entité e serait-elle bloquée à la position (nx, ny) ?
function bloque(e, nx, ny) {
  const [ox, oy, w, h] = e.hb;
  if (zoneBloquee(nx + ox, ny + oy, w, h)) return true;
  if (e === joueur) {
    const zone = { x: nx + ox, y: ny + oy, w, h };
    return pnjs.some((p) => chevauche(zone, boite(p)));
  }
  return false;
}

// Déplace e (axe par axe pour pouvoir glisser le long des murs)
function deplacer(e, dx, dy) {
  let ok = true;
  if (dx) {
    if (!bloque(e, e.x + dx, e.y)) e.x += dx;
    else ok = false;
  }
  if (dy) {
    if (!bloque(e, e.x, e.y + dy)) e.y += dy;
    else ok = false;
  }
  return ok;
}

// =====================================================
//  Joueur
// =====================================================

function majJoueur() {
  const j = joueur;
  let dx = 0, dy = 0;
  if (Touches.gauche) dx = -1; else if (Touches.droite) dx = 1;
  if (Touches.haut) dy = -1; else if (Touches.bas) dy = 1;

  if (dx || dy) {
    if (dy) j.dir = dy < 0 ? 'haut' : 'bas';
    if (dx) j.dir = dx < 0 ? 'gauche' : 'droite';
    const avant = { x: j.x, y: j.y };
    deplacer(j, dx, dy);
    // Aide aux coins : si on bute de justesse contre un angle, on glisse à côté
    if (j.x === avant.x && j.y === avant.y) aideCoin(j, dx, dy);
    j.marche++;
  } else {
    j.marche = 0;
  }

  if (j.recharge > 0) j.recharge--;
  if (j.invincible > 0) j.invincible--;

  if (appui('b')) tirer();
  if (appui('a')) interagir();
  if (appui('start')) ouvrirPause();
  if (appui('select')) basculerSon();
}

function aideCoin(j, dx, dy) {
  for (let k = 1; k <= 6; k++) {
    for (const s of [k, -k]) {
      if (dx && !dy && !bloque(j, j.x + dx, j.y + s)) { j.y += Math.sign(s); return; }
      if (dy && !dx && !bloque(j, j.x + s, j.y + dy)) { j.x += Math.sign(s); return; }
    }
  }
}

function tirer() {
  const j = joueur;
  if (j.recharge > 0 || tirs.length >= 3) return;
  const d = DIRECTIONS[j.dir];
  tirs.push({ x: j.x + 6 + d.x * 6, y: j.y + 9 + d.y * 6, dx: d.x * 3, dy: d.y * 3, vie: 45 });
  j.recharge = 14;
  Son.tir();
}

function interagir() {
  const j = joueur;
  const d = DIRECTIONS[j.dir];
  const px = j.x + 8 + d.x * 12;
  const py = j.y + 12 + d.y * 12;
  const point = { x: px - 2, y: py - 2, w: 4, h: 4 };

  const pnj = pnjs.find((p) => chevauche(point, boite(p)));
  if (pnj) return parler(pnj);

  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  const tuile = tuileA(tx, ty);
  if (tuile === 'A') return antenne();
  if (tuile === '=' && !monde.barriereOuverte) return dire('', ["Une barrière électrique bloque l'entrée de l'usine. BZZZ..."]);
  if (tuile === 'P') return dire('', [PORTES[tx + ',' + ty] || "C'est fermé à clé."]);
  if (tuile === '~') return dire('', ["L'eau est claire. Volt préfère ne pas rouiller."]);
}

function blesserJoueur(source) {
  const j = joueur;
  if (j.invincible > 0 || dialogue) return;
  j.hp--;
  j.invincible = 70;
  secousse = 8;
  Son.degats();
  // Recul : on repousse Volt dans la direction opposée à ce qui l'a touché
  const ax = j.x - source.x, ay = j.y - source.y;
  const n = Math.hypot(ax, ay) || 1;
  for (let i = 0; i < 10; i++) deplacer(j, ax / n, ay / n);
  j.x = Math.round(j.x);
  j.y = Math.round(j.y);
  if (j.hp <= 0) batterieVide();
}

function batterieVide() {
  dire('VOLT', ['Batterie... vide...', "Retour d'urgence au labo !"], () => {
    joueur = creerJoueur();
    ennemis = creerEnnemis();
    tirs = [];
    tirsEnnemis = [];
    if (etat.mission === 5) boss = creerBoss();
  });
}

// =====================================================
//  Dialogues avec les personnages
// =====================================================

function parler(p) {
  const m = etat.mission;
  const n = etat.cellules.length;

  if (p.id === 'ohm') {
    if (m === 0) {
      dire('DR OHM', [
        'Volt ! Te voilà enfin réveillé.',
        'Des drones détraqués envahissent Néo-Cité !',
        "Et la centrale a perdu ses 3 cellules d'énergie.",
        'Retrouve-les : elles brillent, tu ne peux pas les rater.',
        'Ton laser est chargé : touche J pour tirer. Bonne chance !',
      ], () => changerMission(1));
    } else if (m === 1 && n < 3) {
      dire('DR OHM', [`Il te manque encore ${3 - n} cellule(s).`, 'Fouille bien la ville... et même derrière mon labo !']);
    } else if (m === 1) {
      dire('DR OHM', [
        'Les 3 cellules ! Bravo Volt, la centrale redémarre.',
        "Mais l'antenne du nord-est est en panne.",
        'Sans elle, impossible de savoir qui contrôle les drones.',
        'Va voir Mira, la mécanicienne. Son atelier est au sud de la grande rue.',
      ], () => changerMission(2));
    } else if (m === 2) {
      dire('DR OHM', ['Mira est devant son atelier, au sud de la grande rue.']);
    } else if (m === 3) {
      dire('DR OHM', ["Avec la clé de Mira, répare l'antenne au nord-est !"]);
    } else if (m === 4) {
      dire('DR OHM', [
        "Le signal vient de la vieille usine, au sud !",
        "C'est Rouille, un vieux robot de chantier. Il a piraté les drones.",
        "J'ouvre la barrière électrique. Sois prudent, Volt.",
      ], () => changerMission(5));
    } else if (m === 5) {
      dire('DR OHM', ["Rouille se cache au fond de l'usine. Courage !"]);
    } else {
      dire('DR OHM', ['Néo-Cité te doit une fière chandelle, Volt.']);
    }
  }

  if (p.id === 'mira') {
    if (m < 2) dire('MIRA', ['Salut Volt ! Fais gaffe aux drones, ils mordent.']);
    else if (m === 2) {
      dire('MIRA', [
        "Une antenne en panne ? Ça, c'est mon rayon !",
        'Tiens, prends ma super-clé. Elle répare tout.',
        '>> Volt obtient la SUPER-CLÉ !',
      ], () => { Son.objet(); changerMission(3); });
    } else if (m === 3) dire('MIRA', ["Fonce à l'antenne, au nord-est !"]);
    else if (m < 6) dire('MIRA', ["Si tu croises Rouille, vise ses yeux. C'est là qu'il est fragile."]);
    else dire('MIRA', ['Je vais réparer Rouille. Il fera un super jardinier !']);
  }

  if (p.id === 'leo') {
    if (m === 1) dire('LÉO', ["J'ai vu une lumière briller dans le parc, près de l'étang !"]);
    else if (m === 5) dire('LÉO', ["Les drones viennent de l'usine... j'ai peur."]);
    else if (m === 6) dire('LÉO', ['Tu es mon héros, Volt !']);
    else dire('LÉO', ['Quand je serai grand, je serai un robot comme toi !']);
  }
}

function antenne() {
  const m = etat.mission;
  if (m < 3) dire('', ["L'antenne est en panne. Il faudrait un outil pour la réparer..."]);
  else if (m === 3) {
    dire('', [
      'Volt répare l\'antenne avec la super-clé... CLANG ! CLONG !',
      'BZZZT ! Signal capté ! Il vient du sud de la ville...',
      'Il faut prévenir le Dr Ohm !',
    ], () => changerMission(4));
  } else dire('', ["L'antenne clignote joyeusement."]);
}

// Afficher une boîte de dialogue. "apres" est appelé quand elle se ferme.
function dire(nom, lignes, apres) {
  dialogue = { lignes, index: 0, car: 0, apres };
  ui.dialogueNom.textContent = nom;
  ui.dialogue.hidden = false;
  ui.dialogue.classList.remove('complet');
  ui.dialogueTexte.textContent = '';
}

function majDialogue() {
  const ligne = dialogue.lignes[dialogue.index];
  if (dialogue.car < ligne.length) {
    dialogue.car++; // effet machine à écrire
    if (frame % 3 === 0) Son.texte();
    ui.dialogueTexte.textContent = ligne.slice(0, dialogue.car);
    if (dialogue.car >= ligne.length) ui.dialogue.classList.add('complet');
  }
  if (appui('a') || appui('b')) {
    if (dialogue.car < ligne.length) { // on affiche tout d'un coup
      dialogue.car = ligne.length;
      ui.dialogueTexte.textContent = ligne;
      ui.dialogue.classList.add('complet');
    } else if (++dialogue.index < dialogue.lignes.length) {
      dialogue.car = 0;
      ui.dialogue.classList.remove('complet');
    } else {
      const apres = dialogue.apres;
      dialogue = null;
      ui.dialogue.hidden = true;
      if (apres) apres();
    }
  }
}

// =====================================================
//  Missions
// =====================================================

function changerMission(n) {
  etat.mission = n;
  monde.barriereOuverte = n >= 5;
  monde.antenneReparee = n >= 4;
  if (n === 1) {
    ennemis = creerEnnemis();
    objets = creerObjets();
  }
  if (n === 5) {
    for (const [tx, ty] of DRONES_USINE) ennemis.push(creerDrone(tx, ty, true));
    boss = creerBoss();
  }
  sauver();
  majMission();
  const titres = { 1: 'MISSION 1 : Les cellules perdues', 2: "MISSION 2 : L'antenne", 5: "MISSION 3 : L'usine" };
  if (titres[n]) {
    Son.mission();
    afficherToast(titres[n]);
  }
}

function titreMission() {
  const m = etat.mission;
  if (m === 0) return 'PROLOGUE';
  if (m === 1) return 'MISSION 1/3 · Les cellules perdues';
  if (m <= 4) return "MISSION 2/3 · L'antenne";
  if (m === 5) return "MISSION 3/3 · L'usine";
  return 'JEU TERMINÉ · Merci !';
}

function objectif() {
  const m = etat.mission;
  const n = etat.cellules.length;
  if (m === 0) return 'Parle au Dr Ohm, devant le labo.';
  if (m === 1) return n < 3 ? `Trouve les cellules d'énergie (${n}/3).` : 'Rapporte les cellules au Dr Ohm.';
  if (m === 2) return 'Trouve Mira, la mécanicienne.';
  if (m === 3) return "Répare l'antenne au nord-est.";
  if (m === 4) return 'Retourne voir le Dr Ohm.';
  if (m === 5) return "Entre dans l'usine et arrête Rouille.";
  return 'Néo-Cité est sauvée ! Balade-toi librement.';
}

function majMission() {
  ui.mission.innerHTML = `<strong>${titreMission()}</strong><br>${objectif()}`;
}

// L'entrée dans l'usine déclenche la rencontre avec le boss
function verifierZones() {
  const dansUsine = joueur.y > 20.5 * TILE;
  Son.jouerMusique(dansUsine ? 'usine' : 'ville');
  if (etat.mission === 5 && !etat.bossVu && joueur.y > 21 * TILE) {
    etat.bossVu = true;
    sauver();
    dire('ROUILLE', [
      'QUI OSE ENTRER DANS MON USINE ?',
      'Un petit robot ? Mes drones vont te transformer en boîte de conserve !',
    ]);
  }
}

function vaincreBoss() {
  boss.vaincu = true;
  for (let i = 0; i < 4; i++) explosion(boss.x + 16, boss.y + 16, 14);
  for (const d of ennemis) explosion(d.x + 8, d.y + 8);
  ennemis = [];
  tirsEnnemis = [];
  Son.explosion();
  dire('ROUILLE', [
    'Bzzzt... Où suis-je ? Mes circuits étaient grillés...',
    'Merci, petit robot. Je ne voulais faire de mal à personne.',
  ], () => dire('DR OHM', [
    'Bravo Volt ! Les drones s\'éteignent partout en ville.',
    'Néo-Cité est sauvée grâce à toi !',
  ], finDuJeu));
}

function finDuJeu() {
  etat.mission = 6;
  boss = null;
  sauver();
  majMission();
  mode = 'fin';
  ui.fin.hidden = false;
  Son.arreterMusique();
  Son.victoire();
}

// =====================================================
//  Ennemis, tirs, objets, particules
// =====================================================

function majEnnemis() {
  for (const d of ennemis) {
    if (--d.timer <= 0) {
      const ex = joueur.x - d.x, ey = joueur.y - d.y;
      if (Math.hypot(ex, ey) < 70 && Math.random() < 0.6) {
        // Le drone fonce vers Volt
        if (Math.abs(ex) > Math.abs(ey)) { d.dx = Math.sign(ex); d.dy = 0; }
        else { d.dx = 0; d.dy = Math.sign(ey); }
      } else {
        const dir = Object.values(DIRECTIONS)[Math.floor(Math.random() * 4)];
        d.dx = dir.x;
        d.dy = dir.y;
      }
      d.timer = 40 + Math.random() * 60;
    }
    if (!deplacer(d, d.dx * d.vitesse, d.dy * d.vitesse)) { // mur : demi-tour
      d.dx = -d.dx;
      d.dy = -d.dy;
    }
    if (d.flash) d.flash--;
    if (chevauche(boite(d), boite(joueur))) blesserJoueur(d);
  }
}

function majBoss() {
  if (!boss || boss.vaincu || !etat.bossVu) return;
  const b = boss;
  b.x += b.sens * 0.6;
  if (b.x < 6 * TILE || b.x > 31 * TILE) b.sens = -b.sens;
  b.y = 23.5 * TILE + Math.sin(frame / 30) * 8;
  if (b.flash) b.flash--;

  // Il tire vers Volt, plus vite et en éventail quand il est blessé
  if (--b.timer <= 0) {
    const enColere = b.hp <= b.hpMax / 2;
    const cx = b.x + 16, cy = b.y + 20;
    const angle = Math.atan2(joueur.y + 10 - cy, joueur.x + 8 - cx);
    const angles = enColere ? [angle - 0.35, angle, angle + 0.35] : [angle];
    for (const a of angles) {
      tirsEnnemis.push({ x: cx, y: cy, dx: Math.cos(a) * 1.3, dy: Math.sin(a) * 1.3, vie: 200 });
    }
    b.timer = enColere ? 55 : 85;
    Son.tirBoss();
  }
  if (chevauche(boite(b), boite(joueur))) blesserJoueur({ x: b.x + 8, y: b.y + 8 });
}

function majTirs() {
  for (const t of tirs) {
    t.x += t.dx;
    t.y += t.dy;
    t.vie--;
    const zone = { x: t.x, y: t.y, w: 4, h: 4 };
    if (solideA(t.x + 2, t.y + 2)) {
      t.vie = 0;
      explosion(t.x + 2, t.y + 2, 3);
      continue;
    }
    for (const d of ennemis) {
      if (d.hp > 0 && chevauche(zone, boite(d))) {
        t.vie = 0;
        d.hp--;
        d.flash = 8;
        Son.touche();
        if (d.hp <= 0) droneDetruit(d);
        break;
      }
    }
    if (t.vie > 0 && boss && !boss.vaincu && etat.bossVu && chevauche(zone, boite(boss))) {
      t.vie = 0;
      boss.hp--;
      boss.flash = 8;
      Son.touche();
      if (boss.hp <= 0) vaincreBoss();
    }
  }
  tirs = tirs.filter((t) => t.vie > 0);
  ennemis = ennemis.filter((d) => d.hp > 0);

  for (const t of tirsEnnemis) {
    t.x += t.dx;
    t.y += t.dy;
    t.vie--;
    if (solideA(t.x + 2, t.y + 2)) t.vie = 0;
    else if (chevauche({ x: t.x, y: t.y, w: 4, h: 4 }, boite(joueur))) {
      t.vie = 0;
      blesserJoueur(t);
    }
  }
  tirsEnnemis = tirsEnnemis.filter((t) => t.vie > 0);
}

function droneDetruit(d) {
  explosion(d.x + 8, d.y + 8);
  Son.explosion();
  // Parfois, le drone lâche un cœur pour se soigner
  if (joueur.hp < joueur.hpMax && Math.random() < 0.4) {
    objets.push({ type: 'coeur', x: d.x + 4, y: d.y + 4, hb: [0, 0, 8, 8] });
  }
}

function majObjets() {
  const bj = boite(joueur);
  for (const o of objets) {
    if (!chevauche(bj, boite(o))) continue;
    o.ramasse = true;
    Son.objet();
    if (o.type === 'coeur') {
      joueur.hp = Math.min(joueur.hpMax, joueur.hp + 1);
    } else if (o.type === 'cellule') {
      etat.cellules.push(o.id);
      sauver();
      majMission();
      const n = etat.cellules.length;
      afficherToast(n < 3 ? `Cellule d'énergie ${n}/3 !` : '3/3 ! Retourne voir le Dr Ohm.');
    }
  }
  objets = objets.filter((o) => !o.ramasse);
}

function explosion(x, y, nombre = 10) {
  for (let i = 0; i < nombre; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 0.5 + Math.random() * 1.5;
    particules.push({ x, y, dx: Math.cos(a) * v, dy: Math.sin(a) * v, vie: 15 + Math.random() * 15 });
  }
}

function majParticules() {
  for (const p of particules) {
    p.x += p.dx;
    p.y += p.dy;
    p.vie--;
  }
  particules = particules.filter((p) => p.vie > 0);
}

// =====================================================
//  Mini-carte et chemin vers l'objectif
// =====================================================

let miniCarteVisible = true;
let chemin = [];     // liste de cases [tx, ty] de Volt jusqu'à l'objectif
let cleChemin = '';  // on ne recalcule le chemin que si quelque chose a changé
let fondMiniCarte = null;
const MINI_X = LARGEUR - CARTE_L - 3; // coin en haut à droite
const MINI_Y = 14;

function caseJoueur() {
  const b = boite(joueur);
  return [Math.floor((b.x + b.w / 2) / TILE), Math.floor((b.y + b.h / 2) / TILE)];
}

// Où faut-il aller pour la mission en cours ?
function cibleMission() {
  const m = etat.mission;
  if (m === 1) {
    const [jx, jy] = caseJoueur();
    const restantes = CELLULES
      .filter((c) => !etat.cellules.includes(c.id))
      .sort((a, b) => Math.hypot(a.tx - jx, a.ty - jy) - Math.hypot(b.tx - jx, b.ty - jy));
    if (restantes.length) return [restantes[0].tx, restantes[0].ty]; // la plus proche
  }
  if (m === 0 || m === 1 || m === 4) return [4, 5]; // Dr Ohm
  if (m === 2) return [12, 14];                     // Mira
  if (m === 3) return [35, 3];                      // l'antenne
  if (m === 5) return [19, 24];                     // le repaire de Rouille
  return null;
}

// Parcours en largeur (BFS) : on explore la carte case par case à partir de
// Volt, comme une tache d'eau qui s'étale, jusqu'à toucher la cible.
// Ensuite on remonte de la cible jusqu'à Volt : c'est le plus court chemin.
function calculerChemin(depart, cible) {
  const cle = (x, y) => y * CARTE_L + x;
  const [cx, cy] = cible;
  const vientDe = new Map([[cle(...depart), null]]);
  const file = [depart];
  while (file.length) {
    const [x, y] = file.shift();
    if (x === cx && y === cy) {
      const resultat = [];
      for (let k = cle(x, y); k !== null; k = vientDe.get(k)) {
        resultat.push([k % CARTE_L, Math.floor(k / CARTE_L)]);
      }
      return resultat.reverse();
    }
    for (const d of Object.values(DIRECTIONS)) {
      const nx = x + d.x, ny = y + d.y;
      if (vientDe.has(cle(nx, ny))) continue;
      // La cible peut être solide (l'antenne) : on a le droit d'y "arriver"
      if (estSolide(tuileA(nx, ny)) && !(nx === cx && ny === cy)) continue;
      vientDe.set(cle(nx, ny), cle(x, y));
      file.push([nx, ny]);
    }
  }
  return []; // pas de chemin trouvé
}

function majChemin() {
  const cible = cibleMission();
  const depart = caseJoueur();
  const cle = `${depart}|${cible}|${monde.barriereOuverte}`;
  if (cle === cleChemin) return;
  cleChemin = cle;
  chemin = cible ? calculerChemin(depart, cible) : [];
}

// Le fond de la mini-carte : 1 pixel = 1 case
function preparerFondMiniCarte() {
  const c = document.createElement('canvas');
  c.width = CARTE_L;
  c.height = CARTE_H;
  const g = c.getContext('2d');
  for (let ty = 0; ty < CARTE_H; ty++) {
    for (let tx = 0; tx < CARTE_L; tx++) {
      const t = tuileA(tx, ty);
      g.fillStyle = PALETTE[estSolide(t) ? 2 : t === '.' || t === 'F' || t === '=' ? 0 : 1];
      g.fillRect(tx, ty, 1, 1);
    }
  }
  c.barriere = monde.barriereOuverte; // pour savoir quand le redessiner
  return c;
}

function dessinerMiniCarte() {
  if (!fondMiniCarte || fondMiniCarte.barriere !== monde.barriereOuverte) {
    fondMiniCarte = preparerFondMiniCarte();
  }
  ctx.fillStyle = PALETTE[3];
  ctx.fillRect(MINI_X - 1, MINI_Y - 1, CARTE_L + 2, CARTE_H + 2);
  ctx.drawImage(fondMiniCarte, MINI_X, MINI_Y);

  // Le chemin en pointillés qui avancent vers l'objectif
  ctx.fillStyle = PALETTE[3];
  chemin.forEach(([x, y], i) => {
    if ((i - Math.floor(frame / 8)) % 3 !== 0) ctx.fillRect(MINI_X + x, MINI_Y + y, 1, 1);
  });

  // L'objectif clignote
  const cible = cibleMission();
  if (cible && Math.floor(frame / 15) % 2) {
    ctx.fillStyle = PALETTE[3];
    ctx.fillRect(MINI_X + cible[0] - 1, MINI_Y + cible[1] - 1, 3, 3);
    ctx.fillStyle = PALETTE[0];
    ctx.fillRect(MINI_X + cible[0], MINI_Y + cible[1], 1, 1);
  }

  // Volt
  const [jx, jy] = caseJoueur();
  ctx.fillStyle = PALETTE[0];
  ctx.fillRect(MINI_X + jx - 1, MINI_Y + jy - 1, 3, 3);
  ctx.fillStyle = PALETTE[3];
  ctx.fillRect(MINI_X + jx, MINI_Y + jy, 1, 1);
}

// =====================================================
//  Interface : titre, menu, toast, son
// =====================================================

function afficherTitre() {
  mode = 'titre';
  ui.titre.hidden = false;
  ui.fin.hidden = true;
  ui.pause.hidden = true;
  ui.dialogue.hidden = true;
  dialogue = null;
  Son.arreterMusique();
  choixTitre = charger() ? ['CONTINUER', 'NOUVELLE PARTIE'] : ['NOUVELLE PARTIE'];
  selectionTitre = 0;
  rendreMenuTitre();
}

function rendreMenu(liste, choix, selection) {
  liste.innerHTML = choix
    .map((c, i) => `<li class="${i === selection ? 'choisi' : ''}">${c}</li>`)
    .join('');
}

function rendreMenuTitre() {
  rendreMenu(ui.menuTitre, choixTitre, selectionTitre);
}

function majTitre() {
  if (appui('haut') || appui('bas')) {
    selectionTitre = (selectionTitre + 1) % choixTitre.length;
    Son.menu();
    rendreMenuTitre();
  }
  if (appui('a') || appui('start')) {
    Son.menu();
    etat = choixTitre[selectionTitre] === 'CONTINUER' ? charger() : nouvelEtat();
    demarrerPartie();
  }
}

function demarrerPartie() {
  mode = 'jeu';
  ui.titre.hidden = true;
  ui.fin.hidden = true;
  ui.pause.hidden = true;
  monde.barriereOuverte = etat.mission >= 5;
  monde.antenneReparee = etat.mission >= 4;
  joueur = creerJoueur();
  pnjs = creerPnjs();
  ennemis = creerEnnemis();
  objets = creerObjets();
  tirs = [];
  tirsEnnemis = [];
  particules = [];
  boss = etat.mission === 5 ? creerBoss() : null;
  sauver();
  majMission();
  if (etat.mission === 0) {
    dire('', [
      'Néo-Cité, an 2099. Une ville où robots et plantes vivent ensemble.',
      'Le petit robot VOLT sort du labo du Dr Ohm...',
      'Approche-toi du Dr Ohm (juste à gauche) et appuie sur K pour lui parler.',
    ]);
  }
}

// ---------- Menu (touche Entrée pendant le jeu) ----------
let selectionMenu = 0;

function choixMenu() {
  return [
    'REPRENDRE',
    `MINI-CARTE : ${miniCarteVisible ? 'OUI' : 'NON'}`,
    `SON : ${Son.actif ? 'OUI' : 'NON'}`,
    'ÉCRAN TITRE',
  ];
}

function ouvrirPause() {
  mode = 'pause';
  selectionMenu = 0;
  ui.pauseObjectif.textContent = objectif();
  rendreMenu(ui.menuPause, choixMenu(), selectionMenu);
  ui.pause.hidden = false;
  Son.menu();
}

function fermerPause() {
  mode = 'jeu';
  ui.pause.hidden = true;
}

function majPause() {
  const n = choixMenu().length;
  if (appui('haut')) { selectionMenu = (selectionMenu + n - 1) % n; Son.menu(); }
  if (appui('bas')) { selectionMenu = (selectionMenu + 1) % n; Son.menu(); }
  if (appui('select')) basculerSon();
  if (appui('start') || appui('b')) return fermerPause();
  if (appui('a')) {
    Son.menu();
    if (selectionMenu === 0) return fermerPause();
    if (selectionMenu === 1) miniCarteVisible = !miniCarteVisible;
    if (selectionMenu === 2) basculerSon();
    if (selectionMenu === 3) return afficherTitre();
  }
  rendreMenu(ui.menuPause, choixMenu(), selectionMenu);
}

let minuteurToast = null;
function afficherToast(texte) {
  ui.toast.textContent = texte;
  ui.toast.classList.add('visible');
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(() => ui.toast.classList.remove('visible'), 2400);
}

function basculerSon() {
  Son.actif = !Son.actif;
  afficherToast(Son.actif ? 'Son : activé' : 'Son : coupé');
}

// =====================================================
//  Dessin
// =====================================================

function dessinerCarte(camX, camY) {
  const tx0 = Math.floor(camX / TILE);
  const ty0 = Math.floor(camY / TILE);
  for (let ty = ty0; ty <= ty0 + Math.ceil(HAUTEUR / TILE); ty++) {
    for (let tx = tx0; tx <= tx0 + Math.ceil(LARGEUR / TILE); tx++) {
      dessinerTuile(ctx, tuileA(tx, ty), tx * TILE - camX, ty * TILE - camY, tx, ty, frame);
    }
  }
}

function dessinerMonde() {
  const j = joueur;
  // La caméra suit Volt sans sortir de la carte
  let camX = Math.max(0, Math.min(j.x + 8 - LARGEUR / 2, CARTE_L * TILE - LARGEUR));
  let camY = Math.max(0, Math.min(j.y + 8 - HAUTEUR / 2, CARTE_H * TILE - HAUTEUR));
  if (secousse > 0) {
    secousse--;
    camX += Math.random() * 4 - 2;
    camY += Math.random() * 4 - 2;
  }
  camX = Math.round(camX);
  camY = Math.round(camY);

  dessinerCarte(camX, camY);

  // Objets
  for (const o of objets) {
    if (o.type === 'cellule') {
      const flotte = Math.sin(frame / 10) * 2;
      dessinerSprite(ctx, 'cellule', o.x - camX, o.y - camY + flotte);
      if (Math.floor(frame / 8) % 4 === 0) { // étincelle
        ctx.fillStyle = PALETTE[0];
        ctx.fillRect(o.x - camX + 11, o.y - camY + 2 + flotte, 2, 2);
      }
    } else {
      dessinerSprite(ctx, 'coeur', o.x - camX, o.y - camY);
    }
  }

  // Personnages + Volt, triés par hauteur pour qu'ils se superposent bien
  const persos = [...pnjs, j].sort((a, b) => a.y - b.y);
  for (const p of persos) {
    if (p === j) {
      if (j.invincible && Math.floor(frame / 4) % 2) continue; // clignote
      const pas = Math.floor(j.marche / 8) % 2 ? -1 : 0;
      const nom = j.dir === 'bas' ? 'volt_bas' : j.dir === 'haut' ? 'volt_haut' : 'volt_cote';
      dessinerSprite(ctx, nom, j.x - camX, j.y - camY + pas, j.dir === 'gauche');
    } else {
      const respire = Math.floor((frame + p.x) / 32) % 2 ? -1 : 0;
      dessinerSprite(ctx, p.sprite, p.x - camX, p.y - camY + respire);
    }
  }

  // Drones
  for (const d of ennemis) {
    let nom = Math.floor(frame / 4) % 2 ? 'drone' : 'drone2';
    if (d.flash) nom += '_flash';
    dessinerSprite(ctx, nom, d.x - camX, d.y - camY + Math.sin((frame + d.x) / 12) * 1.5);
  }

  // Boss
  if (boss) {
    dessinerSprite(ctx, boss.flash ? 'boss_flash' : 'boss', boss.x - camX, boss.y - camY, false, 2);
  }

  // Tirs
  for (const t of tirs) {
    ctx.fillStyle = PALETTE[3];
    ctx.fillRect(t.x - camX, t.y - camY, 4, 4);
    ctx.fillStyle = PALETTE[0];
    ctx.fillRect(t.x - camX + 1, t.y - camY + 1, 2, 2);
  }
  for (const t of tirsEnnemis) {
    ctx.fillStyle = PALETTE[Math.floor(frame / 4) % 2 ? 3 : 2];
    ctx.fillRect(t.x - camX, t.y - camY, 5, 5);
    ctx.fillStyle = PALETTE[0];
    ctx.fillRect(t.x - camX + 2, t.y - camY + 2, 1, 1);
  }

  // Particules
  for (const p of particules) {
    ctx.fillStyle = PALETTE[p.vie % 6 < 3 ? 3 : 0];
    ctx.fillRect(p.x - camX, p.y - camY, 2, 2);
  }

  dessinerHUD();
}

function dessinerHUD() {
  ctx.fillStyle = PALETTE[3];
  ctx.fillRect(0, 0, LARGEUR, 11);
  for (let i = 0; i < joueur.hpMax; i++) {
    dessinerSprite(ctx, i < joueur.hp ? 'coeur' : 'coeur_vide', 2 + i * 9, 2);
  }
  if (etat.mission === 1) {
    for (let i = 0; i < 3; i++) {
      dessinerSprite(ctx, i < etat.cellules.length ? 'pile' : 'pile_vide', LARGEUR - 26 + i * 8, 2);
    }
  }
  if (boss && !boss.vaincu && etat.bossVu) {
    ctx.fillStyle = PALETTE[2];
    ctx.fillRect(84, 3, 72, 5);
    ctx.fillStyle = PALETTE[0];
    ctx.fillRect(85, 4, (70 * boss.hp) / boss.hpMax, 3);
  }
  if (miniCarteVisible && etat.mission < 6) {
    majChemin();
    dessinerMiniCarte();
  }
}

function dessinerTitre() {
  // La ville défile doucement derrière le titre
  const max = CARTE_L * TILE - LARGEUR;
  const x = Math.floor(frame * 0.3) % (max * 2);
  dessinerCarte(x < max ? x : max * 2 - x, 2 * TILE);
}

function dessiner() {
  if (mode === 'titre') dessinerTitre();
  else dessinerMonde();
}

// =====================================================
//  Boucle principale (60 images par seconde)
// =====================================================

function maj() {
  frame++;
  if (mode === 'titre') {
    majTitre();
  } else if (mode === 'jeu') {
    if (dialogue) {
      majDialogue();
    } else {
      majJoueur();
      if (mode === 'jeu' && !dialogue) {
        majEnnemis();
        majBoss();
        majTirs();
        majObjets();
        verifierZones();
      }
    }
    majParticules();
  } else if (mode === 'pause') {
    majPause();
  } else if (mode === 'fin') {
    if (appui('start') || appui('a')) afficherTitre();
  }
  viderAppuis();
}

const PAS = 1000 / 60;
let dernier = performance.now();
let cumul = 0;

function boucle(t) {
  cumul += Math.min(t - dernier, 250);
  dernier = t;
  while (cumul >= PAS) {
    maj();
    cumul -= PAS;
  }
  dessiner();
  requestAnimationFrame(boucle);
}

prerendreSprites();
afficherTitre();
requestAnimationFrame(boucle);
