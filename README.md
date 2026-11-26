# Dreamy — bibliothèque de fan fictions

Un site qui range les fan fictions comme dans une librairie : chaque œuvre a sa couverture sur une étagère,
peut contenir plusieurs **tomes**, et se lit dans un **livre dont on tourne vraiment les pages**.

## Fonctionnalités

- **Bibliothèque** : étagères en bois, un « rayon » par univers (Fallout, Harry Potter…), recherche par titre, auteur ou tag.
- **Fiche d'une œuvre** : grande couverture, résumé, tags, statut, et tous ses tomes rangés sur une étagère, avec la progression de lecture.
- **Lecteur** :
  - double page sur ordinateur, page simple sur téléphone ;
  - pages qui se tournent en glissant le coin, en cliquant, avec les flèches du clavier ou un balayage tactile ;
  - couverture, page de garde, page de titre, avant-propos, sommaire cliquable avec numéros de page, ouvertures de chapitre avec lettrine, titres courants, quatrième de couverture ;
  - taille du texte réglable (la mise en page est recalculée), son de page, plein écran ;
  - la page où tu t'es arrêté·e est retenue (dans le navigateur) ;
  - **marque-pages** : clique sur le coin supérieur d'une page (un ruban apparaît), sur 🔖 ou appuie sur `M` ;
    on peut leur ajouter une note, les retrouver dans le panneau ☰ et sur la barre de progression ;
  - **fermer le livre** à n'importe quelle page avec 📕 : la page est conservée, et la couverture propose
    « Reprendre » ; si on quitte le lecteur livre fermé, il se rouvre fermé.
- **Import Word (.docx) et PDF** directement dans le navigateur, avec un aperçu avant d'enregistrer :
  - style *Titre* → titre de l'œuvre, *Sous-titre* → sous-titre ;
  - *Titre 1* → chapitres, *Titre 2* → intertitres de scène ;
  - la ligne « Volume I — … » donne le numéro et le titre du tome, « Version 1.0 » la version ;
  - le sommaire du document est ignoré (le livre génère le sien) ;
  - le texte avant le premier chapitre devient l'avant-propos ;
  - pour un PDF, titres et paragraphes sont reconstitués à partir des tailles de police ; en-têtes et pieds de page répétés sont retirés.
- **Mise à jour d'un tome** : réimporter une nouvelle version d'un tome existant remplace son texte en gardant sa couverture.
- **Couvertures** : image importée (œuvre et/ou tome) ou, à défaut, une couverture générée automatiquement dans le style du thème.
- **10 thèmes visuels** : Classique, Post-apocalyptique, Fantasy, Dark fantasy, Science-fiction, Cyberpunk, Horreur, Romance, Steampunk, Noir/Polar.
  Chaque thème change les polices, le papier des pages (taches, parchemin, grille, néons…), les lettrines, les ornements,
  les couvertures générées, les étagères et le décor du site sur la fiche de l'œuvre et dans le lecteur.
  - Le thème se choisit par œuvre (« Modifier » ou à l'import) ; en « Automatique », il est deviné d'après l'univers
    (Fallout → post-apo, Elden Ring → dark fantasy, Star Wars → science-fiction…).
  - Dans le lecteur, le bouton 🎨 permet à chaque lecteur d'essayer un autre thème (mémorisé dans son navigateur).

## Lancer le site

Il faut Node.js 20 ou plus récent.

```bash
npm install
npm run dev          # développement : http://localhost:5173
```

Production :

```bash
npm run build
ADMIN_PASSWORD="un-mot-de-passe" PORT=3000 npm start
```

Sous Windows (PowerShell) :

```powershell
npm run build
$env:ADMIN_PASSWORD="un-mot-de-passe"; npm start
```

Variables d'environnement :

| Variable | Rôle |
| --- | --- |
| `ADMIN_PASSWORD` | Mot de passe demandé pour importer, modifier ou supprimer. **Sans lui, tout le monde peut modifier** : à définir en ligne. |
| `PORT` | Port HTTP (5173 par défaut). |
| `DATA_DIR` | Dossier des données (`./data` par défaut). |

Les données sont des fichiers simples dans `data/` : `db.json` (œuvres et tomes), `volumes/*.json` (texte), `covers/*` (images).
Pour sauvegarder la bibliothèque, il suffit de copier ce dossier. Il est exclu de git.

## Bien préparer un manuscrit Word

- Le titre de l'œuvre en style **Titre**, le sous-titre en **Sous-titre**.
- Chaque chapitre en **Titre 1** (`Prologue — …`, `I — …`, `Chapitre 2 : …`).
- Les changements de scène ou de lieu en **Titre 2**.
- Une ligne `***` ou `⁂` seule sur un paragraphe devient un séparateur de scène.
- Sans aucun style de titre, les lignes courtes qui commencent par « Chapitre », « Prologue »… sont détectées comme chapitres.

## Organisation du code

```
server/            API Express + stockage fichiers
src/import/        lecture des .docx (mammoth) et .pdf (pdf.js), détection de la structure
src/reader/        mise en page en pages (paginate.ts) et livre animé (Reader.tsx, page-flip)
src/pages/         bibliothèque, fiche d'œuvre, import, lecteur
src/components/    livre 3D, couvertures, formulaires
```
