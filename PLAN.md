# PLAN — Corrections & features 1 à 4

> Plan d'exécution issu de `HANDOFF.md`. Le volet architecture (static-first / Firebase) est **hors périmètre** pour cette série.
> Règles : **une PR par changement**, **chaque PR contient des tests**, PR ouvertes sur `upstream/main`.

## Stratégie de branches

```
main
 └─ chore/test-infra                (PR 1 — socle : Jest + CI)
     ├─ fix/* , perf/* , refactor/*  (PR indépendantes, basées sur PR 1)
     └─ chore/typeorm-migrations    (PR 2 — socle DB)
         └─ PR qui modifient le schéma (features + fix anonymat)
```
Les PR étant inter-forks, leur base GitHub est toujours `main` : la description indique « Dépend de #N » et le diff se réduit dès que la PR parente est mergée.

## Lot 0 — Socle
| PR | Branche | Contenu | Tests |
|---|---|---|---|
| 0 | `docs/handoff-plan` | `HANDOFF.md` + `PLAN.md` | — (docs) |
| 1 | `chore/test-infra` | Jest + ts-jest backend, `flutter test` configuré, workflow GitHub Actions (lint, build, test backend ; analyze + test Flutter) | test de fumée |
| 2 | `chore/typeorm-migrations` | DataSource CLI, migration initiale du schéma, `migrationsRun` en prod, scripts npm | test de config DataSource |

## Lot 1 — Sécurité (HANDOFF §3.1)
| PR | Branche | Points | Tests |
|---|---|---|---|
| 3 | `fix/protect-admin-endpoints` | S1 recategorize sous AdminKeyGuard · S2 health public minimal + détail protégé · S6 `timingSafeEqual` | guard + contrôleurs |
| 4 | `fix/secure-otp` | S3 `crypto.randomInt`, OTP haché, 5 essais max, 10 min, `@nestjs/throttler` sur `/auth/*` | auth.service |
| 5 | `fix/request-validation` | S4 DTO en classes `class-validator` + `ValidationPipe` global (whitelist) | validation DTO |
| 6 | `fix/restrict-cors` | S5 liste blanche d'origines via `CORS_ORIGINS` | fonction de config CORS |
| 7 | `feat/refresh-tokens` | S7 access token 15 min + refresh token haché/révocable, rotation, logout ; client Flutter | auth.service + client |

## Lot 2 — Anonymat & qualité (HANDOFF §3.2, §3.3)
| PR | Branche | Contenu | Tests |
|---|---|---|---|
| 8 | `fix/vote-anonymity` | Wording « pseudonymisé », migration `PresidentialVote` → registre/urne, `TopicPoll.voters` → registre, horodatage d'urne tronqué au jour | services de vote + migration |
| 9 | `perf/deputy-vote-ingestion` | Suppression du N+1 (préchargement + upsert en masse) | fixtures scrutins AN |
| 10 | `test/ingestion-fixtures` | Tests sur fixtures des parseurs (agenda HTML, scrutins, motion de rejet, main levée, amendements CSV) | — |
| 11 | `refactor/ai-service` | `AiService` unique (retry, timeout, JSON validé) + découpage du texte au-delà de 4 000 car. | AiService mocké |
| 12 | `chore/cleanup-config` | Code mort `main.ts`, Caddyfile via variable, `package.json` (licence/auteur), header localtunnel | — (couvert par build) |
| 13 | `perf/http-cache` | Retrait du cache-buster systématique, cache-control côté API sur les lectures publiques | ApiClient + intercepteur |
| 14 | `refactor/candidate-status` | Exclusion codée en dur → champ `status` administrable ; contenu éditorial partis → JSON asset | sync candidats |
| 15 | `refactor/mobile-screens` | Découpage `law_detail_screen` / `surveys_screen` / `profile_screen` en widgets | widget tests |

## Lot 3 — Features
| PR | Branche | Feature | Dépend de |
|---|---|---|---|
| 16 | `fix/categorization` | Catégorisation branchée dans le cron + mots entiers + stop-words | 1 |
| 17 | `feat/law-taxonomy` | **F4** Deux axes thème (16) × territoire, classification Mistral dans l'appel de synthèse, verrou admin, filtres UI | 2, 11, 16 |
| 18 | `feat/candidate-official-program` | **F1** Liens programme/site officiels, `programStatus`, admin, boutons UI | 2, 14 |
| 19 | `feat/group-votes` | **F2** `Organe` + `GroupVote`, API, hémicycle/barres par groupe, frondeurs, « Mon député » | 2, 9 |
| 20 | `feat/candidate-law-positions` | **F3** `CandidateLawPosition` sourcée, déduction auto (vote perso / groupe), saisie admin, matrice UI | 18, 19 |

## Définition de « terminé » pour chaque PR
- Tests ajoutés et verts en CI ; lint et build OK.
- Migration fournie si le schéma change (à partir de la PR 2).
- Description : contexte, changements, tests, points d'attention, dépendances.
