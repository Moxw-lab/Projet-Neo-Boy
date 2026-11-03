// =====================================================
//  SON : bruitages et musiques 8-bit (Web Audio API)
//  Aucun fichier audio : tout est généré par le code !
// =====================================================

// Convertit une note ('A4', 'C#5'...) en fréquence (Hz)
function frequence(note) {
  const ecarts = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 };
  const nom = note.slice(0, -1);
  const octave = +note.slice(-1);
  return 440 * Math.pow(2, (ecarts[nom] + (octave - 4) * 12) / 12);
}

// '-' = silence. La basse joue une note toutes les 4 notes de mélodie.
const MUSIQUES = {
  ville: {
    tempo: 150,
    melodie: ['E5', '-', 'G5', '-', 'A5', '-', 'G5', 'E5', 'D5', '-', 'E5', '-', 'C5', '-', '-', '-',
              'E5', '-', 'G5', '-', 'A5', '-', 'C6', 'A5', 'G5', '-', 'E5', '-', 'D5', '-', '-', '-'],
    basse: ['C3', 'C3', 'A2', 'G2', 'C3', 'C3', 'F2', 'G2'],
  },
  usine: {
    tempo: 130,
    melodie: ['A4', '-', 'A4', 'C5', '-', 'A4', 'E5', '-', 'D5', '-', 'C5', '-', 'B4', '-', 'G4', '-',
              'A4', '-', 'A4', 'C5', '-', 'A4', 'E5', '-', 'F5', '-', 'E5', '-', 'D5', '-', 'B4', '-'],
    basse: ['A2', 'A2', 'F2', 'G2', 'A2', 'A2', 'F2', 'E2'],
  },
};

const Son = {
  ctx: null,
  actif: true,
  morceau: null,
  minuteur: null,

  // Les navigateurs exigent une action du joueur avant de jouer du son
  init() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  // Joue une note simple. type : 'square', 'triangle', 'sawtooth'...
  bip(freq, duree, type = 'square', volume = 0.06, delai = 0, freqFin = null) {
    if (!this.ctx || !this.actif) return;
    const t = this.ctx.currentTime + delai;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqFin) osc.frequency.exponentialRampToValueAtTime(freqFin, t + duree);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + duree);
  },

  // --- Bruitages ---
  tir()       { this.bip(900, 0.1, 'square', 0.04, 0, 300); },
  touche()    { this.bip(500, 0.12, 'sawtooth', 0.05, 0, 120); },
  explosion() { this.bip(220, 0.35, 'sawtooth', 0.07, 0, 40); },
  degats()    { this.bip(300, 0.3, 'square', 0.07, 0, 70); },
  texte()     { this.bip(1300, 0.02, 'square', 0.015); },
  menu()      { this.bip(880, 0.06, 'square', 0.04); },
  tirBoss()   { this.bip(180, 0.2, 'square', 0.04, 0, 90); },
  objet() {
    ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => this.bip(frequence(n), 0.1, 'square', 0.05, i * 0.07));
  },
  mission() {
    ['G4', 'C5', 'E5', 'G5', 'E5', 'G5'].forEach((n, i) => this.bip(frequence(n), 0.14, 'square', 0.05, i * 0.1));
  },
  victoire() {
    ['C5', 'E5', 'G5', 'C6', '-', 'A5', 'C6', 'E6'].forEach((n, i) => {
      if (n !== '-') this.bip(frequence(n), 0.25, 'square', 0.05, i * 0.16);
    });
  },

  // --- Musique de fond ---
  jouerMusique(nom) {
    if (this.morceau === nom) return;
    this.arreterMusique();
    this.morceau = nom;
    const m = MUSIQUES[nom];
    let pas = 0;
    this.minuteur = setInterval(() => {
      const note = m.melodie[pas % m.melodie.length];
      if (note !== '-') this.bip(frequence(note), (m.tempo / 1000) * 0.9, 'square', 0.02);
      if (pas % 4 === 0) {
        const basse = m.basse[(pas / 4) % m.basse.length];
        this.bip(frequence(basse), (m.tempo / 1000) * 3.5, 'triangle', 0.07);
      }
      pas++;
    }, m.tempo);
  },
  arreterMusique() {
    clearInterval(this.minuteur);
    this.morceau = null;
  },
};
