# Projet Neo-Boy — VOLT, les gardiens de Néo-Cité

**Auteur : Raoux Ugo** · projet de cours d'IA

Un petit jeu d'aventure façon console portable des années 90, jouable dans le navigateur.

Néo-Cité, an 2099 : une ville où la technologie et la végétation vivent ensemble. Des drones détraqués l'envahissent, et c'est au petit robot **Volt** de trouver qui les contrôle.

Le jeu est écrit en **HTML, CSS et JavaScript pur**, sans librairie ni moteur de jeu, pour que le code reste facile à lire.

## Jouer

- **En ligne** : via GitHub Pages (voir plus bas).
- **En local** : ouvre `index.html` dans ton navigateur. Pas besoin d'installer quoi que ce soit.

| Touche | Action |
| --- | --- |
| Flèches ou ZQSD | Se déplacer |
| K ou Espace | Parler / valider (bouton A) |
| J ou X | Tirer au laser (bouton B) |
| Entrée | Menu (START) : mini-carte, son, écran titre |
| M | Couper / remettre le son |

La progression est sauvegardée automatiquement dans le navigateur (`localStorage`).

## Les missions

### Chapitre 1

0. **Prologue** : parler au Dr Ohm.
1. **Les cellules perdues** : retrouver 3 cellules d'énergie dans la ville.
2. **L'antenne** : récupérer la super-clé de Mira et réparer l'antenne.
3. **L'usine** : entrer dans l'usine et affronter Rouille, le robot qui contrôle les drones.

### Chapitre 2 (débloqué après le chapitre 1)

1. **Nouveau look** : l'atelier de Mira permet de personnaliser Volt (chapeau, tenue, couleurs de l'écran). On peut y revenir quand on veut.
2. **Pip a disparu** : retrouver le chat-robot de Léo. Pip suit Volt jusqu'à Léo, qui offre un cœur en plus.
3. **La forêt en colère** : aider Nova, la botaniste, à détruire les plantes mutantes et la Ronce-Mère.

Nouveaux personnages : **Nova** la botaniste, **Pip** le chat-robot, et **Rouille**, devenu jardinier après sa réparation.

## Organisation du code

```
index.html        la page : la console, l'écran et les boîtes de texte
css/style.css     le look de la console
js/sprites.js     le pixel art (dessiné en texte !) et la palette de 4 couleurs
js/carte.js       la carte de la ville et le dessin des cases
js/son.js         bruitages et musiques 8-bit générés avec la Web Audio API
js/controles.js   le clavier
js/jeu.js         la boucle de jeu, Volt, les ennemis, le boss et les missions
```

### Comment ça marche

- L'écran fait **160 × 144 pixels**, comme les consoles de l'époque, puis il est agrandi en CSS (`image-rendering: pixelated`).
- La **boucle de jeu** (`boucle()` dans `jeu.js`) tourne à 60 images par seconde : à chaque image on met à jour le jeu (`maj()`), puis on le dessine (`dessiner()`).
- Les **sprites** sont des tableaux de texte : chaque caractère est un pixel (`0` à `3` = couleur, `.` = transparent).
- La **carte** est un tableau de lignes de texte : chaque caractère est une case de 16 × 16 pixels (`T` = arbre, `#` = immeuble, `~` = eau…).
- Les **collisions** utilisent des rectangles (« hitbox ») : on vérifie si deux rectangles se chevauchent.
- La **mini-carte** (en haut à droite) affiche le chemin le plus court jusqu'à l'objectif. Il est calculé avec un **parcours en largeur (BFS)** : on explore la carte case par case depuis Volt jusqu'à atteindre la cible (`calculerChemin()` dans `jeu.js`).
- La **personnalisation** reconstruit les sprites de Volt en superposant un chapeau sur sa tête et en changeant les couleurs de sa tenue (`construireVolt()` dans `sprites.js`).
- **Pip** suit Volt en rejouant ses 20 dernières positions, ce qui donne un petit retard naturel.
- Les **missions** sont un simple nombre (`etat.mission`) qui avance au fil des dialogues.

## Idées pour modifier le jeu

- Redessiner Volt dans `js/sprites.js`.
- Changer la palette `PALETTE` pour d'autres couleurs.
- Modifier la ville en éditant `CARTE` dans `js/carte.js`.
- Ajouter un personnage dans `creerPnjs()` et ses répliques dans `parler()`.
- Composer une nouvelle musique dans `MUSIQUES` (`js/son.js`).

## Publier sur GitHub Pages

1. Sur la page du dépôt GitHub : **Settings → Pages**.
2. Dans **Source**, choisis **Deploy from a branch**, branche `main`, dossier `/ (root)`.
3. Après une minute, le jeu est en ligne à l'adresse `https://<ton-pseudo>.github.io/<nom-du-depot>/`.

## Licence

Code libre sous licence MIT (voir `LICENSE`). Personnages et univers originaux créés pour ce projet.
