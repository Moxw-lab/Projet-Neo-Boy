// =====================================================
//  CARTE : la ville de Néo-Cité
// =====================================================

const TILE = 16; // taille d'une case en pixels

// Légende des cases :
//   ,  herbe          .  route          f  fleurs
//   #  immeuble       P  porte          T  arbre
//   ~  eau            A  antenne        M  mur d'usine
//   F  sol d'usine    =  barrière électrique
const CARTE = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT', // 0
  'T,,,,,,,,,,,,,,,,,,..,,,,,,,,,,,,,,,,,,T', // 1
  'T,######,,######,,,..,,######,,,,,,,,,,T', // 2
  'T,######,,######,,,..,,######,,,,,,A,,,T', // 3
  'T,##P###,,##P###,,,..,,##P###,,,,,,,,,,T', // 4
  'T,,,,f,,,,,,,,,f,,,..,,,,,,,f,,,,,,,,,,T', // 5
  'T,,,,,,,,,,,,,,,,,,..,,,,,,,,,,,,,,,,,,T', // 6
  'T......................................T', // 7
  'T......................................T', // 8
  'T,,,,,,,,,,,,,,,,,,..,,,,,,,,,,,,,,,,,,T', // 9
  'T,,,,,,,,,######,,,..,,#####,,T,,,T,,,TT', // 10
  'T,,,,,,,,,######,,,..,,#####,,,,,,,,,,,T', // 11
  'T,,,,,,,,,######,,,..,,#####,,,,,~~~~,,T', // 12
  'T,,,,,,,,,##P###,,,..,,##P##,,,,,~~~~,,T', // 13
  'T,,,,,,,,,,,,,,,,,,..,,,,,,,,,,,,~~~~,TT', // 14
  'T,,,f,,,,,,,,,,,,,,..,,,,,,,,,T,,,,f,,,T', // 15
  'T......................................T', // 16
  'T,,,,,,,,,,,,,,,,,,..,,,,,,,,,,,,,,,,,,T', // 17
  'T,,T,,,,,,,,,,,T,,,..,,,f,,,,,,,,T,,,,,T', // 18
  'T,,,,,,,,,,,,,,,,,,..,,,,,,,,,,,,,,,,,,T', // 19
  'TMMMMMMMMMMMMMMMMMM==MMMMMMMMMMMMMMMMMMT', // 20
  'TFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFT', // 21
  'TFFFMMFFFFFFFFFFFFFFFFFFFFFFFFFFFFMMFFFT', // 22
  'TFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFT', // 23
  'TFFFFFFFMMMFFFFFFFFFFFFFFFFFFMMMFFFFFFFT', // 24
  'TFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFT', // 25
  'TFFFMMFFFFFFFFFFFFFFFFFFFFFFFFFFFFMMFFFT', // 26
  'TFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFT', // 27
  'TFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFT', // 28
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT', // 29
];
const CARTE_L = CARTE[0].length; // largeur en cases
const CARTE_H = CARTE.length;    // hauteur en cases

// Ce qui change dans le monde selon l'avancée des missions
const monde = { barriereOuverte: false, antenneReparee: false };

function tuileA(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= CARTE_L || ty >= CARTE_H) return 'T';
  return CARTE[ty][tx];
}

function estSolide(tuile) {
  if (tuile === '=') return !monde.barriereOuverte;
  return 'T#P~AM'.includes(tuile);
}

// Petit nombre pseudo-aléatoire mais toujours le même pour une case donnée
// (pour varier l'herbe ou les lianes sans que ça clignote)
function hasard(tx, ty) {
  return ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
}

// Les cases sont dessinées avec de simples rectangles
function dessinerTuile(ctx, tuile, x, y, tx, ty, frame) {
  const r = (a, b, w, h, c) => {
    ctx.fillStyle = PALETTE[c];
    ctx.fillRect(x + a, y + b, w, h);
  };
  const herbe = () => {
    r(0, 0, 16, 16, 1);
    const s = hasard(tx, ty) % 6;
    for (const [px, py] of [[2 + s, 3], [11 - s, 10]]) {
      r(px, py, 1, 2, 2);
      r(px + 2, py, 1, 2, 2);
      r(px + 1, py + 1, 1, 2, 2);
    }
  };
  const immeuble = () => {
    r(0, 0, 16, 16, 2);
    const dessus = tuileA(tx, ty - 1);
    if (dessus !== '#' && dessus !== 'P') { // toit-terrasse végétalisé
      r(0, 0, 16, 4, 3);
      r(1, 0, 3, 2, 1);
      r(7, 0, 4, 2, 1);
      r(13, 0, 2, 2, 1);
    }
  };

  switch (tuile) {
    case ',':
      herbe();
      break;
    case 'f':
      herbe();
      r(7, 5, 2, 6, 0);
      r(5, 7, 6, 2, 0);
      r(7, 7, 2, 2, 3);
      break;
    case '.': // route lumineuse
      r(0, 0, 16, 16, 0);
      r((tx * 5) % 13 + 1, (ty * 3) % 13 + 1, 1, 1, 1);
      r((tx * 11 + 4) % 14 + 1, (ty * 7 + 9) % 14 + 1, 1, 1, 1);
      break;
    case '#': {
      immeuble();
      r(3, 5, 4, 6, 0); // fenêtres
      r(9, 5, 4, 6, 0);
      r(5, 5, 1, 6, 1);
      r(11, 5, 1, 6, 1);
      // Lianes sur certaines façades : la nature reprend ses droits
      const h = hasard(tx, ty);
      if (h % 3 === 0) {
        const lx = h % 12 + 2;
        r(lx, 0, 1, 12, 1);
        r(lx - 1, 3, 1, 2, 1);
        r(lx + 1, 7, 1, 2, 1);
        r(lx - 1, 11, 3, 2, 1);
      }
      break;
    }
    case 'P':
      immeuble();
      r(4, 5, 8, 11, 3);
      r(5, 6, 6, 9, 1);
      r(10, 10, 1, 2, 0);
      break;
    case 'T': // arbre
      herbe();
      r(2, 1, 12, 10, 2);
      r(1, 3, 14, 6, 2);
      r(4, 3, 3, 2, 1);
      r(9, 5, 2, 2, 1);
      r(6, 11, 4, 4, 3);
      break;
    case '~': { // eau qui ondule
      r(0, 0, 16, 16, 2);
      const o = (Math.floor(frame / 20) + tx) % 2;
      r(2 + o * 4, 4, 5, 1, 1);
      r(8 - o * 4, 11, 5, 1, 1);
      break;
    }
    case 'A': { // antenne
      herbe();
      r(7, 2, 2, 14, 3);
      r(4, 12, 2, 4, 3);
      r(10, 12, 2, 4, 3);
      r(5, 7, 6, 1, 3);
      r(5, 11, 6, 1, 3);
      const lumiere = monde.antenneReparee ? (Math.floor(frame / 15) % 2 ? 0 : 3) : 2;
      r(6, 0, 4, 2, lumiere);
      break;
    }
    case 'M': // mur d'usine en briques
      r(0, 0, 16, 16, 3);
      for (const by of [1, 9]) {
        r(1, by, 6, 2, 2);
        r(9, by, 6, 2, 2);
        r(0, by + 4, 2, 2, 2);
        r(5, by + 4, 6, 2, 2);
        r(13, by + 4, 3, 2, 2);
      }
      break;
    case 'F': // sol d'usine
      r(0, 0, 16, 16, 2);
      r(0, 0, 16, 1, 3);
      r(0, 0, 1, 16, 3);
      r(3, 3, 1, 1, 1);
      r(12, 12, 1, 1, 1);
      break;
    case '=': // barrière électrique
      dessinerTuile(ctx, 'F', x, y, tx, ty, frame);
      if (monde.barriereOuverte) break;
      r(0, 0, 3, 16, 3);
      r(13, 0, 3, 16, 3);
      for (let i = 0; i < 5; i++) {
        r(3, 1 + i * 3 + ((Math.floor(frame / 3) + i) % 3), 10, 1, 0);
      }
      break;
  }
}
