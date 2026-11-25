# Démok - La Démocratie Collaborative 🗳️

**Démok** ([demok.fr](https://demok.fr)) est une application web citoyenne permettant de suivre, de comprendre et de voter (de manière confidentielle et consultative) sur les lois en cours de discussion au Parlement français.

L'objectif est de rendre le processus législatif accessible à tous grâce à l'IA, de décoder les textes de lois sans jargon politique, et de permettre aux citoyens de comparer leur vote avec celui des députés.

---

## ✨ Fonctionnalités

- **Flux de lois & amendements en temps réel** : Synchronisation automatique des textes, dossiers législatifs, amendements et scrutins officiels depuis l'Open Data de l'Assemblée Nationale et Légifrance.
- **Vulgarisation IA à double niveau (Classique & Mode Rue)** : Utilisation de Mistral AI pour résumer chaque texte avec des arguments « Pour » et « Contre » selon deux registres au choix :
  - 🏛️ **Mode Classique** : Ton neutre, institutionnel et synthétique.
  - 🔥 **Mode Rue** : Langage direct, familier et décodé sans langue de bois.
- **Module « Approfondir le sujet »** : Analyse détaillée générée par IA et mise en cache pour chaque loi (contexte, chronologie, chiffres clés sourcés et impacts concrets au quotidien).
- **Vote Citoyen Confidentiel (pseudonymisé)** : architecture à « Double Registre » — le registre (`VoteRegistry`) sait *qui* a voté, l'urne (`VoteUrna`) ne contient que le *choix*, indexé par un jeton HMAC (clé serveur `VOTE_SECRET`). Sans cette clé, une copie de la base ne permet pas de relier un choix à un citoyen ; le serveur, qui la détient, peut le faire (c'est ce qui permet de vous réafficher votre vote) : il s'agit donc d'une **pseudonymisation**, pas d'un anonymat absolu. Les urnes ne conservent que le jour du vote.
- **Espace Présidentielle 2027** : Fiches des candidats déclarés ou pressentis, synthèses du profil, présentation du parti et mesures phares du programme (disponibles en Mode Classique et Mode Rue) avec vote consultatif.
- **Fiches Députés & Gouvernement** : Historique des votes, statistiques de participation de chaque député et trombinoscope actualisé de la composition du Gouvernement.
- **Gamification Citoyenne** : Système d'expérience (XP) et de niveaux de citoyenneté pour encourager la participation régulière à la vie démocratique.

---

## 🏗️ Architecture Technique

- **Frontend** : Flutter Web (PWA responsive Mobile & Desktop), hébergé sur Firebase Hosting.
- **Backend** : NestJS (Node.js / TypeScript), TypeORM, Bull (files d'attente asynchrones).
- **Base de données & Cache** : PostgreSQL 15 & Redis 7 (conteneurisés avec Docker derrière un reverse-proxy Caddy).
- **Intelligence Artificielle** : API Mistral AI (`mistral-small-latest`) avec mise en cache permanente des synthèses en base de données (`JSONB`).
- **Sources de données** : Dépôts Open Data de l'Assemblée Nationale & Légifrance.

---

## 🛠️ Installation (Développement local)

### Pré-requis
- Docker & Docker Compose
- Node.js (v18+)
- Flutter SDK

### 1. Base de données (PostgreSQL & Redis)
```bash
# À la racine du projet
docker-compose up -d
```

### 2. Backend (API NestJS)
```bash
cd backend
cp .env.example .env
# Renseignez votre clé MISTRAL_API_KEY et vos paramètres dans le fichier .env
npm install
npm run start:dev
```

### 3. Frontend (Flutter Web)
```bash
cd mobile
flutter pub get
flutter run -d chrome
```

---

## 📜 Licence

Ce projet est distribué sous licence **MIT**. Voir le fichier `LICENSE` pour plus de détails.

---

## 🗄️ Migrations de base de données

Le schéma de production est géré par des migrations TypeORM (`backend/src/database/migrations`), exécutées automatiquement au démarrage quand `DB_SYNCHRONIZE=false` (valeur de `docker-compose.prod.yml`). En développement, `synchronize` reste actif par défaut.

```bash
cd backend
# Après modification d'une entité : générer la migration correspondante
npm run migration:generate -- src/database/migrations/NomDeLaMigration
npm run migration:run      # appliquer
npm run migration:revert   # annuler la dernière
```

La CI applique toutes les migrations sur une base vide puis échoue si les entités et les migrations divergent.
