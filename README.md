# newTab Extension

Extension de nouvel onglet avec interface inspiree macOS/iOS recent.

## Fonctionnalites

- Horloge grand format style iPhone en haut de page
- Options de personnalisation: 12/24h, secondes, couleur, epaisseur, style de police
- Rail horizontal de raccourcis epingles avec defilement si la liste est longue
- Bouton pour ajouter rapidement un raccourci
- Bouton "Tout afficher" avec vue en grille
- Mode edition comme iPhone (maintien long): icones qui tremblent, suppression, reorganisation par glisser-deposer
- Persistance locale des preferences et des raccourcis via `chrome.storage.local`

## Installation

1. Ouvrir Firefox
2. Accédez à `about:debugging#/runtime/this-firefox`
3. Cliquez sur "Charger un module complémentaire temporaire"
4. Sélectionnez le fichier `manifest.json` de ce dossier
5. L'extension sera activée et remplacera votre page des nouveaux onglets

## Structure des fichiers

```
newTab-Extension/
├── manifest.json       # Configuration de l'extension
├── newtab.html        # Page HTML principale
├── newtab.js          # Logique JavaScript
├── newtab.css         # Styles CSS
├── icons/             # Dossier pour les icônes
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-96.png
└── README.md          # Ce fichier
```

## Personnalisation

### Utiliser le mode edition

1. Faites un maintien long sur un raccourci ou cliquez sur `Modifier`
2. Les icones passent en mode tremblement
3. Cliquez sur le petit rond rouge pour supprimer
4. Glissez-deposez un raccourci vers une autre position pour reordonner
5. Cliquez sur `Terminer` pour quitter le mode edition

### Ajouter un raccourci

1. Cliquez sur `Ajouter`
2. Renseignez nom, URL et lettre/symbole d'icone
3. Le raccourci est sauvegarde automatiquement

## Développement

Pour tester les modifications:
1. Revenez à `about:debugging#/runtime/this-firefox`
2. Cliquez sur "Recharger" à côté de votre extension
3. Ouvrez un nouvel onglet pour voir les changements

## Licence

MIT

