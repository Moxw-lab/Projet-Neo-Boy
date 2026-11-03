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
  fin: $('fin'), finTitre: $('fin-titre'), finTexte: $('fin-texte'), finBonus: $('fin-bonus'), mission: $('mission'),
  atelier: $('atelier'), menuAtelier: $('menu-atelier'), apercu: $('apercu'),
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
// Chapitre 2 : les plantes mutantes (la "mère" est plus grosse et plus solide)
const PLANTES = [
  { id: 'p1', tx: 6, ty: 10 },
  { id: 'p2', tx: 10, ty: 18 },
  { id: 'p3', tx: 24, ty: 9 },
  { id: 'p4', tx: 28, ty: 18 },
  { id: 'p5', tx: 37, ty: 15 },
  { id: 'mere', tx: 30, ty: 11, grande: true },
];
const PORTES = {
  '4,4': 'Le labo du Dr Ohm. Pas le temps de faire la sieste !',
  '12,13': "L'atelier de Mira. Ça sent l'huile de moteur.",
  '25,4': 'La maison de Léo. Il y a des dessins de robots aux fenêtres.',
};

// ---------- État de la partie (ce qui est sauvegardé) ----------
const CLE_SAUVEGARDE = 'volt-sauvegarde';
let etat = nouvelEtat();

function nouvelEtat() {
  return {
    mission: 0,
    cellules: [],
    bossVu: false,
    // Chapitre 2
    perso: { chapeau: 'antenne', tenue: 'verte', ecran: 'classique' },
    pipSuit: false,
    coeurBonus: false,
    plantesDetruites: [],
  };
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
  const hpMax = etat.coeurBonus ? 4 : 3; // Léo offre un cœur en plus au chapitre 2
  // trace = les dernières positions de Volt (pour que Pip le suive)
  return { x: 5 * TILE, y: 7 * TILE, hb: [3, 8, 10, 8], dir: 'bas', hp: hpMax, hpMax, invincible: 0, recharge: 0, marche: 0, trace: [] };
}

function creerPnjs() {
  const m = etat.mission;
  const liste = [
    { id: 'ohm', sprite: 'ohm', x: 4 * TILE, y: 5 * TILE, hb: [2, 4, 12, 12] },
    { id: 'mira', sprite: 'mira', x: 12 * TILE, y: 14 * TILE, hb: [2, 4, 12, 12] },
    { id: 'leo', sprite: 'leo', x: 25 * TILE, y: 5 * TILE, hb: [2, 4, 12, 12] },
  ];
  // Après le chapitre 1, Rouille est réparé et devient jardinier dans l'usine
  if (m >= 6) liste.push({ id: 'rouille', sprite: 'boss', x: 19 * TILE, y: 25 * TILE, hb: [2, 4, 12, 12] });
  if (m >= 7) liste.push({ id: 'nova', sprite: 'nova', x: 37 * TILE, y: 11 * TILE, hb: [2, 4, 12, 12] });
  if (m >= 9) {
    const pip = { id: 'pip', sprite: 'pip', x: 36 * TILE, y: 27 * TILE, hb: [3, 6, 10, 10] };
    if (m >= 10) { // de retour chez Léo
      pip.x = 26 * TILE;
      pip.y = 5 * TILE;
    } else if (etat.pipSuit) {
      pip.x = joueur.x;
      pip.y = joueur.y;
      pip.suit = true;
    }
    liste.push(pip);
  }
  return liste;
}

function creerPlante(p) {
  return {
    type: 'plante', id: p.id, x: p.tx * TILE, y: p.ty * TILE,
    hb: p.grande ? [4, 4, 24, 26] : [2, 2, 12, 13],
    hp: p.grande ? 12 : 3,
    grande: !!p.grande,
    timer: 60 + Math.random() * 60,
    flash: 0,
  };
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
  if (etat.mission === 11) {
    for (const p of PLANTES) {
      if (!etat.plantesDetruites.includes(p.id)) liste.push(creerPlante(p));
    }
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
    const actuelle = boite(e);
    // On ignore Pip quand il nous suit, et un perso déjà collé à Volt (sinon il resterait coincé)
    return pnjs.some((p) => !p.suit && chevauche(zone, boite(p)) && !chevauche(actuelle, boite(p)));
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
    // Pip suit Volt en rejouant ses positions avec un peu de retard
    const pip = pnjs.find((p) => p.suit);
    if (pip && (j.x !== avant.x || j.y !== avant.y)) {
      j.trace.push({ x: j.x, y: j.y });
      if (j.trace.length > 20) Object.assign(pip, j.trace.shift());
    }
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
    for (const p of pnjs) if (p.suit) Object.assign(p, { x: joueur.x, y: joueur.y });
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
    } else if (m === 6) { // début du chapitre 2
      dire('DR OHM', [
        'Volt ! Grâce à toi, les drones dorment tranquilles.',
        'Mais un nouveau mystère arrive : des plantes bizarres poussent en ville...',
        'Avant tout, Mira veut te faire une mise à jour. File à son atelier !',
      ], () => changerMission(7));
    } else if (m === 7) {
      dire('DR OHM', ["Mira t'attend devant son atelier."]);
    } else if (m <= 9) {
      dire('DR OHM', ['Léo a perdu son chat-robot ? Aide-le, il doit être bouleversé.']);
    } else if (m <= 12) {
      dire('DR OHM', ['Nova, la botaniste du parc, en sait plus que moi sur ces plantes.']);
    } else {
      dire('DR OHM', ['Deux chapitres terminés... Tu es une légende, Volt !']);
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
    else if (m === 6) dire('MIRA', ["J'ai réparé Rouille. Il est devenu jardinier dans l'usine !"]);
    else if (m === 7) {
      dire('MIRA', [
        "Te voilà ! J'ai monté un atelier de personnalisation.",
        'Choisis ton style, petit robot !',
      ], () => ouvrirAtelier(() => dire('MIRA', [
        'Trop classe ! Reviens quand tu veux changer de look.',
        "Au fait, Léo te cherchait. Il avait l'air tout triste...",
      ], () => changerMission(8))));
    } else {
      dire('MIRA', ['Envie de changer de look ?'], () => ouvrirAtelier());
    }
  }

  if (p.id === 'leo') {
    if (m === 1) dire('LÉO', ["J'ai vu une lumière briller dans le parc, près de l'étang !"]);
    else if (m === 5) dire('LÉO', ["Les drones viennent de l'usine... j'ai peur."]);
    else if (m === 6 || m === 7) dire('LÉO', ['Tu es mon héros, Volt !']);
    else if (m === 8) {
      dire('LÉO', [
        'Volt ! Mon chat-robot Pip a disparu...',
        'Il adore les endroits chauds. Peut-être dans la vieille usine ?',
      ], () => changerMission(9));
    } else if (m === 9 && !etat.pipSuit) dire('LÉO', ["Tu as retrouvé Pip ? Il est tout petit, avec des oreilles pointues."]);
    else if (m === 9) {
      dire('LÉO', [
        'PIP ! Tu es revenu !',
        'Merci Volt ! Tiens, cette pile de secours est pour toi.',
        '>> Volt gagne un cœur en plus !',
      ], () => {
        etat.pipSuit = false;
        etat.coeurBonus = true;
        joueur.hpMax = 4;
        joueur.hp = 4;
        Son.objet();
        changerMission(10);
      });
    } else if (m >= 10) dire('LÉO', ['Pip et moi, on est les meilleurs amis du monde !']);
    else dire('LÉO', ['Quand je serai grand, je serai un robot comme toi !']);
  }

  if (p.id === 'pip') {
    if (m === 9 && !etat.pipSuit) {
      dire('PIP', ['Miaou-bip ?', '>> Pip décide de te suivre !'], () => {
        etat.pipSuit = true;
        sauver();
        majMission();
        pnjs = creerPnjs();
      });
    } else dire('PIP', ['Miaou-bip ! Rrrronron...']);
  }

  if (p.id === 'rouille') {
    if (m === 9 && !etat.pipSuit) dire('ROUILLE', ['Un petit chat ? Il dort près des tuyaux chauds, à l\'est de l\'usine.']);
    else if (m >= 10 && m <= 12) dire('ROUILLE', ['Ces plantes mutantes abîment mes tomates. Grrr... je veux dire : bzzt.']);
    else dire('ROUILLE', ['Bzzt ! Je cultive des tomates maintenant.', 'Merci encore de m\'avoir réparé, Volt.']);
  }

  if (p.id === 'nova') {
    const reste = PLANTES.length - etat.plantesDetruites.length;
    if (m < 10) dire('NOVA', ["Bonjour ! Je suis Nova, botaniste. J'étudie les plantes de Néo-Cité."]);
    else if (m === 10) {
      dire('NOVA', [
        'Volt ! Des plantes mutantes attaquent la ville !',
        'Elles crachent des graines. Leur chef, la Ronce-Mère, pousse juste à côté.',
        'Détruis-les toutes, la Ronce-Mère aussi !',
      ], () => changerMission(11));
    } else if (m === 11) dire('NOVA', [`Encore ${reste} plante(s) mutante(s). Courage !`]);
    else if (m === 12) {
      dire('NOVA', [
        'Tu as réussi ! Le pollen mutant disparaît.',
        'Je vais replanter des graines saines. Néo-Cité sera encore plus verte !',
      ], () => finChapitre(2));
    } else dire('NOVA', ['Regarde ces fleurs, Volt. Magnifiques, non ?']);
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
  if (n === 11) ennemis = creerEnnemis();
  pnjs = creerPnjs(); // de nouveaux personnages peuvent apparaître
  sauver();
  majMission();
  const titres = {
    1: 'MISSION 1 : Les cellules perdues', 2: "MISSION 2 : L'antenne", 5: "MISSION 3 : L'usine",
    7: 'CHAPITRE 2 - MISSION 1 : Nouveau look', 8: 'MISSION 2 : Pip a disparu', 10: 'MISSION 3 : La forêt en colère',
  };
  if (titres[n]) {
    Son.mission();
    afficherToast(titres[n]);
  }
}

function titreMission() {
  const m = etat.mission;
  if (m === 0) return 'PROLOGUE';
  if (m === 1) return 'CH.1 · MISSION 1/3 · Les cellules perdues';
  if (m <= 4) return "CH.1 · MISSION 2/3 · L'antenne";
  if (m === 5) return "CH.1 · MISSION 3/3 · L'usine";
  if (m === 6) return 'CHAPITRE 2 DÉBLOQUÉ !';
  if (m === 7) return 'CH.2 · MISSION 1/3 · Nouveau look';
  if (m <= 9) return 'CH.2 · MISSION 2/3 · Pip a disparu';
  if (m <= 12) return 'CH.2 · MISSION 3/3 · La forêt en colère';
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
  if (m === 6) return 'Parle au Dr Ohm pour lancer le chapitre 2.';
  if (m === 7) return 'Va voir Mira à son atelier.';
  if (m === 8) return 'Léo te cherche. Va le voir.';
  if (m === 9) return etat.pipSuit ? 'Ramène Pip à Léo.' : 'Trouve Pip, le chat-robot de Léo.';
  if (m === 10) return 'Va voir Nova, la botaniste, au parc.';
  if (m === 11) return `Détruis les plantes mutantes (${PLANTES.length - etat.plantesDetruites.length} restantes).`;
  if (m === 12) return 'Retourne voir Nova au parc.';
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
  pnjs = creerPnjs();
  finChapitre(1);
}

function finChapitre(numero) {
  if (numero === 2) etat.mission = 13;
  sauver();
  majMission();
  mode = 'fin';
  ui.finTitre.textContent = numero === 1 ? 'BRAVO !' : 'CHAPITRE 2 TERMINÉ';
  ui.finTexte.textContent = numero === 1 ? 'Néo-Cité est sauvée.' : "Néo-Cité n'a jamais été aussi verte.";
  ui.finBonus.textContent = numero === 1 ? 'CHAPITRE 2 DÉBLOQUÉ ! Parle au Dr Ohm.' : "Merci d'avoir joué !";
  ui.fin.hidden = false;
  Son.arreterMusique();
  Son.victoire();
}

// =====================================================
//  Ennemis, tirs, objets, particules
// =====================================================

// Les plantes mutantes ne bougent pas, mais crachent des graines vers Volt
function majPlante(p) {
  if (p.flash) p.flash--;
  const taille = p.grande ? 32 : 16;
  const cx = p.x + taille / 2, cy = p.y + taille / 3;
  const distance = Math.hypot(joueur.x + 8 - cx, joueur.y + 10 - cy);
  if (--p.timer <= 0 && distance < (p.grande ? 110 : 80)) {
    const angle = Math.atan2(joueur.y + 10 - cy, joueur.x + 8 - cx);
    const angles = p.grande ? [angle - 0.4, angle, angle + 0.4] : [angle];
    for (const a of angles) {
      tirsEnnemis.push({ x: cx - 2, y: cy - 2, dx: Math.cos(a) * 1.1, dy: Math.sin(a) * 1.1, vie: 150 });
    }
    p.timer = p.grande ? 70 : 110;
    Son.tirBoss();
  }
  if (chevauche(boite(p), boite(joueur))) blesserJoueur(p);
}

function majEnnemis() {
  for (const d of ennemis) {
    if (d.type === 'plante') {
      majPlante(d);
      continue;
    }
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
  explosion(d.x + 8, d.y + 8, d.grande ? 30 : 10);
  Son.explosion();
  if (d.type === 'plante') {
    etat.plantesDetruites.push(d.id);
    const reste = PLANTES.length - etat.plantesDetruites.length;
    if (reste > 0) {
      afficherToast(`Plante détruite ! Encore ${reste}.`);
      sauver();
      majMission();
    } else {
      afficherToast('Plus aucune plante mutante ! Va voir Nova.');
      changerMission(12);
    }
  }
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
  if (m === 11) { // la plante mutante la plus proche
    const [jx, jy] = caseJoueur();
    const plantes = ennemis
      .filter((e) => e.type === 'plante')
      .map((e) => [Math.floor(e.x / TILE), Math.floor(e.y / TILE)])
      .sort((a, b) => Math.hypot(a[0] - jx, a[1] - jy) - Math.hypot(b[0] - jx, b[1] - jy));
    if (plantes.length) return plantes[0];
  }
  if (m === 0 || m === 1 || m === 4 || m === 6) return [4, 5]; // Dr Ohm
  if (m === 2 || m === 7) return [12, 14];  // Mira
  if (m === 3) return [35, 3];              // l'antenne
  if (m === 5) return [19, 24];             // le repaire de Rouille
  if (m === 8) return [25, 5];              // Léo
  if (m === 9) return etat.pipSuit ? [25, 5] : [36, 27]; // Pip, puis retour chez Léo
  if (m >= 10 && m <= 12) return [37, 11];  // Nova
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
  ui.atelier.hidden = true;
  dialogue = null;
  Son.arreterMusique();
  const sauvegarde = charger();
  appliquerPerso(sauvegarde ? sauvegarde.perso : nouvelEtat().perso);
  choixTitre = sauvegarde ? ['CONTINUER', 'NOUVELLE PARTIE'] : ['NOUVELLE PARTIE'];
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
  appliquerPerso(etat.perso);
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

// ---------- Atelier de Mira : personnalisation (chapitre 2) ----------
const OPTIONS_PERSO = [
  { cle: 'chapeau', label: 'TÊTE', choix: [['antenne', 'Antenne'], ['casquette', 'Casquette'], ['feuille', 'Pousse'], ['crete', 'Crête']] },
  { cle: 'tenue', label: 'TENUE', choix: [['verte', 'Verte'], ['blanche', 'Blanche'], ['sombre', 'Sombre']] },
  { cle: 'ecran', label: 'ÉCRAN', choix: [['classique', 'Classique'], ['gris', 'Gris'], ['neon', 'Néon'], ['sepia', 'Sépia']] },
];
let selectionAtelier = 0;
let apresAtelier = null;

// Applique le look choisi : sprites de Volt + couleurs de l'écran
function appliquerPerso(perso) {
  construireVolt(perso);
  PALETTE.splice(0, 4, ...(PALETTES[perso.ecran] || PALETTES.classique));
  PALETTE.forEach((c, i) => document.documentElement.style.setProperty(`--gb-${i}`, c));
  prerendreSprites();
  fondMiniCarte = null; // la mini-carte doit être redessinée avec les nouvelles couleurs
}

function ouvrirAtelier(apres) {
  mode = 'atelier';
  selectionAtelier = 0;
  apresAtelier = apres;
  ui.atelier.hidden = false;
  rendreAtelier();
}

function rendreAtelier() {
  const lignes = OPTIONS_PERSO.map((o) => {
    const nom = o.choix.find(([cle]) => cle === etat.perso[o.cle])[1];
    return `${o.label} : &lt; ${nom} &gt;`;
  });
  rendreMenu(ui.menuAtelier, [...lignes, 'TERMINER'], selectionAtelier);
  // Aperçu de Volt en grand
  const g = ui.apercu.getContext('2d');
  g.fillStyle = PALETTE[1];
  g.fillRect(0, 0, 16, 16);
  g.drawImage(CACHE_SPRITES.volt_bas, 0, 0);
}

function majAtelier() {
  const n = OPTIONS_PERSO.length + 1;
  if (appui('haut')) { selectionAtelier = (selectionAtelier + n - 1) % n; Son.menu(); }
  if (appui('bas')) { selectionAtelier = (selectionAtelier + 1) % n; Son.menu(); }
  const option = OPTIONS_PERSO[selectionAtelier];
  const sens = appui('droite') || (option && appui('a')) ? 1 : appui('gauche') ? -1 : 0;
  if (option && sens) { // on passe au choix suivant / précédent
    const i = option.choix.findIndex(([cle]) => cle === etat.perso[option.cle]);
    const k = option.choix.length;
    etat.perso[option.cle] = option.choix[(i + sens + k) % k][0];
    appliquerPerso(etat.perso);
    Son.menu();
  }
  if ((!option && appui('a')) || appui('start') || appui('b')) {
    sauver();
    ui.atelier.hidden = true;
    mode = 'jeu';
    Son.objet();
    if (apresAtelier) apresAtelier();
    return;
  }
  rendreAtelier();
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

  // Drones et plantes mutantes
  for (const d of ennemis) {
    if (d.type === 'plante') {
      let nom = d.timer < 20 ? 'plante' : 'plante2'; // la bouche s'ouvre juste avant de tirer
      if (d.flash) nom += '_flash';
      dessinerSprite(ctx, nom, d.x - camX, d.y - camY, false, d.grande ? 2 : 1);
      continue;
    }
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
  if (miniCarteVisible && cibleMission()) {
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
  } else if (mode === 'atelier') {
    majAtelier();
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
