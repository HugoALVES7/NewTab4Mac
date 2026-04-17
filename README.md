# NewTab4Mac — Documentation d’utilisation (FR)

Cette extension remplace la page *Nouvel onglet* de Firefox par une interface avec horloge, gestion de raccourcis et options de personnalisation.

## 1) Installation

Installe l’extension depuis Mozilla add-ons :

[NewTab4Mac sur Mozilla add-ons](https://addons.mozilla.org/fr/firefox/addon/newtab4mac/)

## 2) Prise en main

1. Ouvre un nouvel onglet Firefox.
2. Utilise la carte **Ajouter** dans la liste **Tous les raccourcis** pour créer un raccourci.
3. Clique sur un raccourci pour l’ouvrir (même onglet).
4. Utilise **Cmd/Ctrl + clic** (ou clic molette) pour l’ouvrir dans un nouvel onglet.

## 3) Gestion des raccourcis

### Ajouter un raccourci
- Clique sur **Ajouter**.
- Champs disponibles :
  - **Nom** (obligatoire, max 30 caractères)
  - **URL** (obligatoire, `https://` est ajouté automatiquement si absent)
  - **Image personnalisée (URL)** (optionnel)

### Modifier un raccourci
- Passe en mode édition (voir section 4), puis clique sur `...` sur la carte.
- Les mêmes champs que l’ajout sont modifiables.

### Supprimer un raccourci
- En mode édition, clique sur `−`.
- Comportement :
  - Depuis **Tous les raccourcis** : suppression complète du raccourci (et de toutes ses copies dans les listes).
  - Depuis une autre liste : suppression de la copie dans cette liste uniquement.

### Recherche et affichage complet
- Bouton **Tout afficher** sur chaque liste.
- Recherche via le champ **Rechercher un raccourci...** (recherche insensible aux accents/casse).

## 4) Gestion des listes

### Liste spéciale
- **Tous les raccourcis** est une liste verrouillée :
  - toujours présente
  - toujours affichée en dernier
  - non supprimable/renommable
  - raccourcis triés alphabétiquement
  - carte **Ajouter** toujours en première position

### Mode édition (clic long)
- Fais un **clic long** sur un raccourci pour activer le mode édition.
- En mode édition, tu peux :
  - réorganiser les raccourcis dans une même liste (glisser-déposer)
  - copier un raccourci vers une autre liste (glisser-déposer entre listes)
  - renommer une liste (titre éditable)
  - supprimer une liste (hors liste verrouillée)
  - ajouter une liste (**Ajouter une liste**)
- Le mode édition se ferme en cliquant en dehors de la section raccourcis.

## 5) Personnalisation visuelle

### Horloge (clic long sur l’heure)
- **Police** : Système / Arrondie / Serif
- **Couleur**
- **Épaisseur** : 300 à 800 (pas de 100)

### Panneau Réglages (icône engrenage)

#### Raccourcis
- **Noir et blanc** (icônes monochromes)
- **Teinte des icônes**
- **Intensité teinte** (0 à 1)
- **Afficher les noms**

#### Arrière-plan
- **Couleur de la teinte**
- **Opacité de la teinte** (0 à 0,6)
- **Sphères du fond** (activer/désactiver)
- **Couleur sphère 1**
- **Couleur sphère 2**

## 6) Import / Export des données

Dans le panneau **Réglages** :
- **Exporter (JSON)** : exporte listes + raccourcis + structure en fichier `.json`.
- **Importer (JSON)** : fusion intelligente des données importées.

### Règles de fusion à l’import
- Évite les doublons de raccourcis (comparaison par URL normalisée).
- Fusionne les listes par nom (insensible à la casse).
- N’écrase pas la liste verrouillée **Tous les raccourcis**.
- Ajoute automatiquement dans **Tous les raccourcis** les raccourcis importés non présents dans les listes.

## 7) Données et compatibilité

- Les données sont stockées localement dans le navigateur (`localStorage`).
- L’extension cible Firefox (version minimale 140).
