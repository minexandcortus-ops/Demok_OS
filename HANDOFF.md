# HANDOFF — Démok (demok.fr)

> Document de passation : état du projet au **25/11/2026** (commit `5f01e63`), dette identifiée, et feuille de route fonctionnelle et technique proposée.
> Périmètre analysé : `backend/` (NestJS, ~11 k lignes TS) et `mobile/` (Flutter Web/PWA, ~13 k lignes Dart).

---

## 1. Résumé

| | |
|---|---|
| **Produit** | Application citoyenne qui suit les lois en discussion à l'Assemblée nationale, les vulgarise avec l'IA (modes « Classique » et « Rue »), propose un vote citoyen consultatif et anonyme sur chaque loi, un espace Présidentielle 2027, des fiches députés et gouvernement, et de la gamification (XP / niveaux). |
| **Ce qui marche bien** | Un pipeline d'ingestion AN complet (agenda, scrutins, amendements, promulgations, textes). Les synthèses IA sont mises en cache en JSONB. Le vote repose sur un double registre. L'UX de la PWA est soignée et un mode invité existe. |
| **Ce qui manque le plus** | Les **votes par groupe politique**, la **position des candidats sur les lois**, des **liens vers les programmes officiels** et une **catégorisation fiable**. Côté technique : aucun test, pas de CI, pas de migrations, plusieurs failles de sécurité faciles à corriger. |
| **Question d'architecture** | Une version **100 % frontend est impossible** sans renoncer au vote et aux comptes. En revanche, une architecture **« static-first »** (pipeline de données + JSON statiques + backend minimal Firebase) est réaliste et supprimerait le VPS, Postgres, Redis, Caddy et Bull. Voir §5. |

---

## 2. Architecture actuelle

```
                    ┌──────────────────────────── VPS (docker-compose.prod) ───────────────────────────┐
 Flutter Web (PWA)  │  Caddy ──► NestJS API (/api)                                                    │
 Firebase Hosting ──┼──────────►  ├─ ingestion/   (scraping HTML AN, ZIP open data, CSV amendements)  │
                    │             ├─ scheduler/   (crons 3h, 7h, 8h, 8h30)                             │
                    │             ├─ votes/       (vote citoyen, flux de lois, deep-dive Mistral)      │
                    │             ├─ surveys/     (présidentielle, sondages thématiques)              │
                    │             ├─ auth/        (pseudo/mdp, OTP mail, JWT 30 j)                     │
                    │             ├─ notifications/ (FCM + Bull/Redis, mail SMTP)                       │
                    │             └─ admin/       (X-Admin-Key, admin.html côté Firebase)              │
                    │  PostgreSQL 15  ·  Redis 7                                                      │
                    └─────────────────────────────────────────────────────────────────────────────────┘
 Sources externes : assemblee-nationale.fr (HTML + open data), Légifrance, api.mistral.ai,
                    GitHub maximerat/politchique (candidats), candidatspresidentielles2027.fr
```

### Entités principales (TypeORM)
- `Law` : titres, `summary` / `summaryStreet` (JSONB), statut, navette, `deputyVoteResult` (agrégat global), `rawText`, `categories` (M2M), `region` (`FRANCE` | `UE`).
- `Category` : 12 thèmes semés au démarrage (`laws/seeds/categories-seed.service.ts`), détection par mots-clés.
- `Deputy`, `OfficialVote` (un vote par député et par loi, avec `scrutinId`).
- `VoteRegistry` (qui a voté) et `VoteUrna` (choix, clé `HMAC(citizenId+lawId)`).
- `Candidate` (nom, parti, photo, description, `programUrl`), `SurveyRegistry` / `SurveyUrna`, `PresidentialVote` (ancien système, **non anonyme**), `TopicPoll`.
- `User` / `Citizen` (pseudo, année de naissance, code postal, circonscription, XP).

### Jobs planifiés (`scheduler/ingestion-scheduler.service.ts`)
- **03:00** : sanitisation, puis sync de l'agenda HTML, votes des députés, promulgations, synthèses Mistral (nouvelles lois uniquement), amendements, liens vers les derniers textes.
- **07:00** : sync des candidats 2027 depuis GitHub `politchique`.
- **08:00 / 08:30** : digest de notifications, puis rappel J-1.

---

## 3. Constats techniques (à traiter en priorité)

### 3.1 Sécurité — 🔴 à corriger rapidement
| # | Constat | Fichier | Correctif |
|---|---|---|---|
| S1 | `POST /api/categories/recategorize-all` et `recategorize/:lawId` sont **publics** : n'importe qui peut lancer un recalcul complet. | `laws/categories.controller.ts` | Ajouter `@UseGuards(AdminKeyGuard)` ou déplacer ces routes sous `admin/`. |
| S2 | `GET /api/admin/health` est public et expose l'état de la configuration (Mistral, etc.). | `admin/health.controller.ts` | Garder un endpoint `/health` minimal et public, et protéger le détail. |
| S3 | L'OTP est généré avec `Math.random()`, stocké en clair, valable 30 min, **sans limite de tentatives** : un code à 6 chiffres se force par brute force. | `auth/auth.service.ts:97,183` | Utiliser `crypto.randomInt`, stocker un hash, limiter à 5 essais, expirer en 10 min, ajouter `@nestjs/throttler`. |
| S4 | **Aucun `ValidationPipe`**, et les DTO sont des `interface` : `class-validator` est installé mais ne sert à rien. | `main.ts`, `auth/dto/*` | Transformer les DTO en classes décorées et activer `app.useGlobalPipes(new ValidationPipe({ whitelist: true }))`. |
| S5 | CORS `origin: true` avec `credentials: true` : toute origine est acceptée. | `main.ts` | Restreindre à `demok.fr` et aux domaines Firebase. |
| S6 | La clé admin est comparée avec `!==` (comparaison non constante dans le temps), et c'est une clé unique partagée. | `admin/admin-key.guard.ts` | Utiliser `crypto.timingSafeEqual`. À terme, passer à un compte admin avec rôle. |
| S7 | JWT valable 30 jours, sans refresh ni révocation. | `auth/auth.module.ts` | Access token court + refresh token révocable. |

### 3.2 Anonymat du vote — ⚠️ promesse du README surestimée
Le README parle d'« anonymat mathématique ». En réalité, `voterToken = HMAC(VOTE_SECRET, citizenId:lawId)` est **déterministe**, et le serveur le recalcule pour retrouver les choix d'un citoyen (`votes.service.ts:372` et `:421`, utilisés pour afficher « vous avez voté X »). Quiconque détient `VOTE_SECRET` et la base peut donc **ré-associer chaque vote à son auteur**. De plus, `VoteRegistry.votedAt` et `VoteUrna.createdAt` permettent une corrélation temporelle.
Il faut aussi noter que l'ancienne table `PresidentialVote` relie directement `userId` et `candidateId`, et qu'elle est toujours lue. `TopicPoll.voters` stocke une liste d'ID utilisateurs dans un champ texte séparé par des virgules.

**Options :**
1. Honnêteté immédiate : reformuler en « vote pseudonymisé » dans le README et l'UI.
2. Conserver le **choix uniquement côté client** (stockage local ou chiffré avec une clé dérivée du mot de passe). Le serveur ne garde que le registre (a voté / n'a pas voté) et l'urne, sans lien possible.
3. Arrondir les horodatages de l'urne (au jour) ou les supprimer.
4. Migrer `PresidentialVote` et `TopicPoll.voters` vers le registre et l'urne, puis supprimer ces deux structures.

### 3.3 Qualité et fiabilité
- **Aucun test** : seul le `widget_test.dart` par défaut existe, et il n'y a aucun `*.spec.ts`. Les parseurs AN (JSON aux formes variables, cas de la motion de rejet inversée, vote à main levée) sont pourtant la partie la plus fragile. Il faut au minimum des tests sur fixtures pour `deputy-vote-ingestion`, `ingestion-html-agenda` et `amendement-ingestion`.
- **Pas de CI** (`.github/` absent). Prévoir lint, build et tests à chaque PR, puis un déploiement Firebase automatique.
- **Pas de migrations** : `synchronize: true` hors production, et rien en production. Le schéma de prod dérive donc manuellement. Ajouter des migrations TypeORM.
- **N+1 à l'ingestion des votes** : un `findOne` par député, puis par vote (`deputy-vote-ingestion.service.ts:491+`). Précharger les députés dans une `Map` et faire un `upsert` en masse.
- **Appels Mistral dupliqués** à trois endroits, avec trois styles (`fetch` brut dans `summary-updater` et `votes.service`, SDK dans `deputy-sync`). Créer un `AiService` unique (retry, timeout, schéma JSON validé, journalisation des coûts).
- **Seuls les 4 000 premiers caractères de `rawText`** sont envoyés à l'IA (`summary-updater.service.ts`). Sur les longs textes, la synthèse et les « chiffres clés » risquent d'être hallucinés. Il faudrait découper le texte en morceaux, puis exiger une citation d'article pour chaque chiffre.
- **Code mort ou configuration incohérente** :
  - `main.ts` sert `../mobile/build/web`, un dossier absent de l'image Docker alors que le front est sur Firebase.
  - `Caddyfile` contient le domaine générique `demok.votre-domaine.com`.
  - `package.json` indique `author: "Antigravity"` et `license: "UNLICENSED"`, alors que le dépôt est sous licence MIT.
  - L'en-tête `Bypass-Tunnel-Reminder` est un reste de localtunnel.
- **Frontend** :
  - `ApiClient.get` ajoute un *cache-buster* et `no-store` à **chaque** requête, ce qui empêche tout cache HTTP ou CDN.
  - Les écrans sont trop gros (`law_detail_screen.dart` fait 1 606 lignes, `profile_screen.dart` 1 088, `surveys_screen.dart` 986).
  - L'état est géré par des singletons ad hoc (`UserSession()`). Passer à Riverpod (ou Bloc) et découper en widgets.
- **Contenu éditorial codé en dur** :
  - Les biographies des partis et des candidats sont dans `political_street_data.dart` (1 028 lignes) et `government_data.dart` : chaque correction exige un redéploiement. À déplacer en données (JSON ou base).
  - L'exclusion de candidats est codée en dur (`EXCLUDED_NAMES = ['bardella']` dans `candidates-sync.service.ts`). C'est un choix éditorial qui doit devenir un champ `status` administrable, avec une justification tracée.

### 3.4 Catégorisation : 🐞 bug fonctionnel
- La catégorisation **n'est appelée nulle part dans le pipeline d'ingestion** : je n'ai trouvé aucun appel en dehors de `categories.controller.ts`. Les nouvelles lois ne sont donc catégorisées que si quelqu'un appelle l'endpoint (public, cf. S1).
- La détection fait du `text.includes(keyword)` sur des mots trop génériques. Les mots-clés de « Finances » contiennent `loi`, `état` et `publique`, donc **presque toute loi tombe en Finances**. Les sous-chaînes créent aussi des faux positifs (`eau` ⊂ « nouv**eau** », `air` ⊂ « aff**air**e »).
- `region` ne connaît que `FRANCE` et `UE` : il n'existe aucune notion de territoire (Outre-mer, Corse, etc.).

---

## 4. Évolutions fonctionnelles proposées

### 4.1 Programmes officiels des candidats à la présidentielle
**Existant :** `Candidate.programUrl` pointe vers l'agrégateur tiers `candidatspresidentielles2027.fr`, pas vers le programme officiel.

**Proposition :**
- Champs supplémentaires sur `Candidate` : `officialSiteUrl`, `officialProgramUrl`, `programPdfUrl`, `programPublishedAt`, `programStatus` (`PUBLIE` | `PARTIEL` | `NON_PUBLIE`), `sourceCheckedAt`, et `status` (`PRESSENTI` | `DECLARE` | `OFFICIEL` | `RETIRE`).
- Saisie et validation **manuelles dans l'admin** : pas d'IA pour les URL officielles. L'agrégateur tiers reste en lien secondaire, présenté comme tel (« Fiche synthèse – source : … »).
- À partir de la publication par le **Conseil constitutionnel** de la liste officielle des candidats (printemps 2027), passer `status = OFFICIEL` et ajouter un lien vers cette liste.
- UI : deux boutons distincts, **« Programme officiel »** et **« Site de campagne »**, avec la date de dernière vérification. Si aucun programme n'est publié, afficher le badge « Programme non publié ».

### 4.2 Qui a voté pour ou contre chaque loi : partis, groupes, députés
**Existant :** les votes individuels sont stockés (`OfficialVote`) avec la loi, mais il n'y a **aucun agrégat par groupe**. `groupePolitique` stocke parfois un code d'organe AN (`PO…`) au lieu d'un libellé lisible.

**Proposition :**
- Nouvelle entité `GroupVote(lawId, scrutinId, organeRef, sigle, libelle, couleur, positionMajoritaire, pour, contre, abstention, nonVotants)`. Elle est alimentée par le même JSON de scrutin AN, qui fournit déjà `groupe.vote.decompteVoix` et `positionMajoritaire`, déjà parcourus dans `storeIndividualVotes`.
- Référentiel `Organe` (code PO, sigle, libellé, couleur) importé depuis l'open data AN (jeu « acteurs / organes »).
- UI sur la fiche loi :
  - un **hémicycle** ou des barres empilées par groupe ;
  - la liste « Ont voté pour / contre / abstention » par groupe, dépliable jusqu'aux députés ;
  - les **frondeurs** mis en avant (députés qui ont voté contre la position majoritaire de leur groupe).
- **« Mon député »** : à partir du `constituencyCode` du citoyen, afficher le vote de son député à côté du vote du citoyen. Le calcul se fait côté client pour ne pas affaiblir l'anonymat (cf. §3.2).
- **« Avec qui je vote le plus »** : taux de concordance entre les votes du citoyen et chaque groupe ou député, calculé localement.
- **Phase 2 : le Sénat**, avec les scrutins publics de data.senat.fr. Les champs `CurrentSource` et `navette` existent déjà.

### 4.3 Position officielle des candidats sur chaque loi
C'est le sujet le plus sensible : il faut **aucune position inventée** et **une source pour chaque position**.

Modèle proposé `CandidateLawPosition` :
```
candidateId, lawId,
position: POUR | CONTRE | ABSTENTION | NUANCÉ | INCONNU,
sourceType: VOTE_PERSONNEL | VOTE_GROUPE | DECLARATION | PROGRAMME,
sourceUrl, citation (≤ 300 car.), sourceDate, verifiedBy, verifiedAt
```
Les positions s'obtiennent par ordre de fiabilité :
1. **Vote personnel** : le candidat est ou était député, sénateur ou eurodéputé. On le déduit automatiquement de `OfficialVote` en reliant `Candidate` à `Deputy` (`candidate.deputyId`).
2. **Vote du groupe du parti** : déduit automatiquement de `GroupVote`, mais **affiché comme tel** (« Le groupe RN a voté contre ») et jamais comme la position personnelle du candidat.
3. **Déclaration ou programme** : saisie manuelle dans l'admin, avec URL et citation obligatoires. L'IA peut *proposer* des candidats-sources à valider, sans jamais publier directement.
4. Sinon, `INCONNU`, affiché explicitement.

UI :
- une matrice « Candidats × lois clés », filtrable par catégorie ;
- sur la fiche loi, un bloc « Ce qu'en disent les candidats » avec un badge de type de source.

⚖️ **À faire valider juridiquement avant la campagne officielle** :
- le classement du vote présidentiel consultatif au regard de la loi n° 77-808 du 19/07/1977 sur les sondages (une consultation non représentative ne doit pas être présentée comme un sondage, et la publication la veille et le jour du scrutin est encadrée) ;
- l'équité de traitement entre candidats ;
- le statut de l'éditeur.

Pistes : désactiver l'affichage des résultats du vote présidentiel pendant la période sensible, et ajouter la mention « consultation non représentative ».

### 4.4 Catégorisation des lois sur deux axes
Les catégories proposées mélangent le **thème** (finance, sécurité, vie) et le **territoire** (métropole, outre-mer). Il faut deux axes indépendants.

**Axe 1 – Thème** (1 principal + 2 secondaires maximum), taxonomie fermée :
| Slug | Libellé | Exemples |
|---|---|---|
| `finances` | Finances & fiscalité | PLF, PLFSS (volet recettes), impôts |
| `economie` | Économie & entreprises | commerce, industrie, consommation |
| `travail` | Travail & emploi | code du travail, chômage, retraites |
| `social_sante` | Santé & protection sociale | hôpital, assurance maladie, handicap |
| `societe_vie` | Société & vie quotidienne | famille, logement, **fin de vie / bioéthique**, droits |
| `securite` | Sécurité & défense | police, armée, terrorisme, cyber |
| `justice` | Justice | pénal, civil, prisons |
| `education` | Éducation & recherche | |
| `ecologie` | Écologie & énergie | |
| `agriculture` | Agriculture & alimentation | |
| `amenagement` | Transports & aménagement | |
| `numerique` | Numérique | données, plateformes, IA |
| `culture` | Culture, médias & sport | |
| `immigration` | Immigration & nationalité | |
| `institutions` | Institutions & collectivités | constitution, élections |
| `international` | Europe & international | traités, ratifications |

**Axe 2 – Territoire** (nouveau champ `territories: string[]`, qui remplace `region`) :
`NATIONAL` · `METROPOLE` (texte propre à la métropole) · `OUTRE_MER` avec le détail `GUADELOUPE`, `MARTINIQUE`, `GUYANE`, `REUNION`, `MAYOTTE`, `NOUVELLE_CALEDONIE`, `POLYNESIE`, `SPM`, `WALLIS_FUTUNA`, `SAINT_MARTIN`, `SAINT_BARTHELEMY` · `CORSE` · `UE` · `INTERNATIONAL`.

**Implémentation :**
- Classer **dans le même appel Mistral que la synthèse**, avec une sortie JSON contrainte à l'énumération (`theme_principal`, `themes_secondaires`, `territoires`, `confiance`). Cela ne coûte rien de plus.
- Garder les mots-clés comme **solution de repli**, mais corrigés : correspondance sur mots entiers (`\b…\b`, sans accents), suppression des mots vides (`loi`, `état`, `publique`…), pondération plus forte des titres.
- Ajouter une surcharge manuelle dans l'admin (`categoriesLocked: true`).
- Appeler la catégorisation dans le cron, juste après l'étape Mistral (cf. §3.4).
- Front : filtres combinés (thème × territoire), page par thème, et abonnement aux notifications par thème ou territoire (« Préviens-moi des lois Outre-mer »).

### 4.5 Autres idées
- **Chronologie de la navette** : frise visuelle AN → Sénat → CMP → promulgation (`navetteHistory` existe déjà).
- **Sources et transparence IA** : sur chaque synthèse, afficher le modèle, la date et un lien vers le texte source, et permettre de signaler une erreur (le module `reports` existe déjà). Ajouter la mention « résumé généré automatiquement, peut contenir des erreurs ».
- **Pages partageables et SEO** : Flutter Web n'est pas indexable. Une page HTML statique par loi, générée par le pipeline (§5), permettrait de partager une loi ou un résultat (carte Open Graph).
- **Accessibilité RGAA** : contrastes, lecteur d'écran (le rendu canvas de Flutter Web est faible sur ce point) et mode « facile à lire et à comprendre » (FALC) en plus des modes Classique et Rue.
- **Sénat et Parlement européen** : `LawRegion.UE` existe mais n'est pas alimenté.
- **Tableau de bord des promesses** : relier les mesures des programmes 2022 aux lois effectivement votées.

---

## 5. Architecture : peut-on n'avoir qu'un frontend ?

### Ce que fait le backend aujourd'hui, et ce que chaque fonction exige
| Fonction | Peut-on la faire depuis le navigateur ? | Pourquoi |
|---|---|---|
| Scraping et open data AN (ZIP, HTML, CSV) | ❌ | CORS, volumes importants, traitement lourd. Ce n'est pas du temps réel : un **job planifié** suffit. |
| Synthèses Mistral | ❌ | La clé API serait exposée. C'est aussi du **batch** : une seule génération par loi. |
| Lecture : lois, députés, votes, candidats | ✅ | Ces données sont publiques et changent au plus une fois par jour, donc des **JSON statiques sur CDN** suffisent. |
| Vote citoyen et anti double vote | ❌ | Il faut un tiers de confiance qui compte les votes et contrôle l'unicité. |
| Comptes, OTP, mails | ❌ (sauf BaaS) | Un service d'authentification managé peut s'en charger. |
| Notifications push | ❌ (sauf BaaS) | FCM exige un envoi côté serveur. |
| Gamification (XP) | ⚠️ | Côté client, elle serait triviale à tricher. Acceptable si l'XP n'a aucun enjeu. |

**Conclusion : une version 100 % frontend implique de supprimer le vote agrégé, les comptes et le push.** On n'aurait plus qu'un site d'information, ce qui retire au produit son cœur (« comparez votre vote avec celui des députés »). En revanche, **environ 80 % du trafic est de la lecture** et n'a pas besoin d'une API.

### Architecture recommandée : « static-first + backend minimal »
```
GitHub Actions (cron 03:00)                     Firebase
 ├─ ingestion AN / Sénat (code TS réutilisé)     ├─ Hosting/CDN : Flutter PWA + /data/*.json + pages SEO
 ├─ synthèses + catégorisation Mistral           ├─ Auth : e-mail OTP / lien magique (remplace auth/ maison)
 ├─ agrégats GroupVote / CandidateLawPosition    ├─ Firestore : registre + urne + compteurs
 └─ publie data/laws/{id}.json, index.json,      ├─ Cloud Functions : vote() transactionnel, push FCM, crons
    deputies.json, candidates.json …             └─ (déjà utilisé : Hosting + FCM)
    (stocké dans un dépôt « demok-data » versionné → historique et diff publics gratuits)
```
**Gains :** plus de VPS, de Postgres, de Redis, de Caddy, de Bull ni de backups maison. Le coût est quasi nul au repos. Les données publiques deviennent auditables (historique git) et les pages SEO sont générées gratuitement. Le frontend lit du JSON statique qui se met bien en cache.
**Coûts et risques :**
- réécriture de l'authentification et du vote (environ 1 000 lignes) ;
- migration des comptes existants (pseudo/mot de passe vers Firebase Auth : import possible avec les hashs bcrypt) ;
- dépendance à Google ;
- ingestion limitée à la durée d'un job GitHub Actions (6 h, largement suffisant).

**Alternative moins disruptive :** garder NestJS, mais publier les lectures en JSON statiques sur le CDN (ou ajouter de vrais en-têtes de cache et retirer le cache-buster), et réduire l'API au vote, à l'authentification et au push. C'est une étape intermédiaire valable avant la cible ci-dessus.

---

## 6. Feuille de route proposée

| Priorité | Lot | Contenu | Effort |
|---|---|---|---|
| **P0** | Sécurité | S1 à S6, `ValidationPipe`, throttler, OTP sécurisé | 1–2 j |
| **P0** | Honnêteté sur l'anonymat | reformuler le README et l'UI, migrer `PresidentialVote` et `TopicPoll.voters` | 1 j |
| **P0** | Catégorisation | branchement dans le cron, correction des mots-clés, puis classification Mistral sur deux axes | 2–3 j |
| **P1** | Votes par groupe | `GroupVote` et `Organe`, UI hémicycle, frondeurs, « Mon député » | 4–5 j |
| **P1** | Programmes officiels | champs `Candidate` et admin, boutons UI, statut | 1–2 j |
| **P1** | Socle qualité | CI GitHub Actions, migrations TypeORM, tests sur fixtures des parseurs AN | 3–4 j |
| **P2** | Positions des candidats | `CandidateLawPosition`, déduction auto (votes perso et groupe), saisie sourcée, matrice UI, **revue juridique** | 5–8 j |
| **P2** | Static-first | pipeline GitHub Actions, JSON sur CDN, retrait du cache-buster | 4–6 j |
| **P3** | Backend minimal | Firebase Auth, Firestore et Functions, décommissionnement du VPS | 8–12 j |
| **P3** | Extensions | Sénat, frise de navette, pages SEO, RGAA/FALC, alertes par thème ou territoire | — |

---

## 7. Repères pour reprendre le projet
- **Lancer en local** : `docker-compose up -d`, puis `cd backend && cp .env.example .env && npm i && npm run start:dev`, puis `cd mobile && flutter run -d chrome --dart-define=API_URL=http://localhost:3000/api`.
- **Variables d'environnement critiques** : `VOTE_SECRET` (le changer invalide tous les jetons de vote existants), `ADMIN_KEY`, `MISTRAL_API_KEY`, `JWT_SECRET`, `GOOGLE_APPLICATION_CREDENTIALS` (FCM).
- **Déclencher l'ingestion à la main** : `POST /api/admin/ingestion/*` avec l'en-tête `X-Admin-Key`, ou `src/scripts/manual-cron.ts`.
- **Fichiers clés** :
  - `ingestion/deputy-vote-ingestion.service.ts` : scrutins ;
  - `ingestion/summary-updater.service.ts` : prompts IA ;
  - `votes/votes.service.ts` : flux, vote, deep-dive ;
  - `surveys/candidates-sync.service.ts` : candidats ;
  - `laws/categorization.service.ts` et `laws/seeds/categories-seed.service.ts` : catégories ;
  - `mobile/lib/screens/law_detail_screen.dart` : fiche loi ;
  - `mobile/lib/screens/surveys_screen.dart` : Présidentielle.
- **Admin** : `mobile/web/admin.html` (page HTML autonome de 1 468 lignes, servie sur `/admin` avec `noindex`).
