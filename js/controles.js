// =====================================================
//  CONTRÔLES : clavier (+ clic sur les boutons de la console)
// =====================================================

// Boutons maintenus en ce moment
const Touches = { haut: false, bas: false, gauche: false, droite: false, a: false, b: false, start: false, select: false };
// Boutons qui viennent d'être appuyés (consommés une seule fois)
let appuis = {};

// e.code = position physique de la touche : WASD en QWERTY = ZQSD en AZERTY
const CLAVIER = {
  ArrowUp: 'haut', KeyW: 'haut',
  ArrowDown: 'bas', KeyS: 'bas',
  ArrowLeft: 'gauche', KeyA: 'gauche',
  ArrowRight: 'droite', KeyD: 'droite',
  Space: 'a', KeyK: 'a',
  KeyJ: 'b', KeyX: 'b',
  Enter: 'start',
  KeyM: 'select',
};

// Renvoie true une seule fois par appui
function appui(bouton) {
  if (appuis[bouton]) {
    appuis[bouton] = false;
    return true;
  }
  return false;
}

function viderAppuis() {
  appuis = {};
}

function presser(bouton) {
  if (!Touches[bouton]) appuis[bouton] = true;
  Touches[bouton] = true;
  Son.init();
  document.querySelectorAll(`[data-bouton="${bouton}"]`).forEach((el) => el.classList.add('enfonce'));
}

function relacher(bouton) {
  Touches[bouton] = false;
  document.querySelectorAll(`[data-bouton="${bouton}"]`).forEach((el) => el.classList.remove('enfonce'));
}

addEventListener('keydown', (e) => {
  const bouton = CLAVIER[e.code];
  if (!bouton) return;
  e.preventDefault(); // empêche la page de défiler avec les flèches / espace
  if (!e.repeat) presser(bouton);
});

addEventListener('keyup', (e) => {
  const bouton = CLAVIER[e.code];
  if (bouton) relacher(bouton);
});

// Si la fenêtre perd le focus, on relâche tout (sinon Volt continue de marcher)
addEventListener('blur', () => {
  for (const b in Touches) relacher(b);
});

// Les boutons dessinés sur la console marchent aussi à la souris
document.querySelectorAll('[data-bouton]').forEach((el) => {
  const bouton = el.dataset.bouton;
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    presser(bouton);
  });
  for (const evt of ['pointerup', 'pointerleave', 'pointercancel']) {
    el.addEventListener(evt, () => relacher(bouton));
  }
});
