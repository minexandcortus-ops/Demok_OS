# Démok - La Démocratie Collaborative 🗳️

**Démok** est une plateforme citoyenne permettant de suivre, de vulgariser et de voter (de manière anonyme et consultative) sur les lois en cours de discussion au Parlement français.

L'objectif est de rendre le processus législatif accessible à tous grâce à l'IA, de vulgariser les projets de lois, et de permettre aux citoyens de s'exprimer par le vote.

---

## ✨ Fonctionnalités

- **Flux de lois en temps réel** : Ingestion automatique des données de l'Assemblée Nationale.
- **Vulgarisation par IA** : Utilisation de Mistral AI pour transformer des textes législatifs complexes en résumés clairs avec des arguments "Pour" et "Contre".
- **Vote Anonyme** : Système de "Double Registre" garantissant l'anonymat total du choix tout en empêchant le multi-vote.
- **Fiches Députés et Statistiques** : Retrouvez l'historique complet des votes, les présences et les statistiques de chaque député pour suivre son activité à l'Assemblée.
- **Sondages** : Exprimez-vous sur des thématiques clés de l'actualité politique et sociale.
- **Gamification** : Gagnez de l'expérience et progressez dans vos niveaux de citoyenneté en participant activement à la vie démocratique.

---

## 🛠️ Installation (Développement)

### Pré-requis
- Docker & Docker Compose
- Node.js (v18+)
- Flutter SDK

### 1. Backend
```bash
cd backend
cp .env.example .env
# Remplissez les clés Mistral et SMTP dans le .env
npm install
npm run start:dev
```

### 2. Base de données
```bash
# À la racine du projet
docker-compose up -d
```

### 3. Application (Flutter)
```bash
cd mobile
flutter pub get
flutter run -d chrome  # Pour tester la version Web
```

---

## 🏗️ Architecture

- **Backend** : NestJS, TypeORM, PostgreSQL, Redis.
- **Frontend** : Flutter (Web & Mobile).
- **IA** : Mistral AI API.
- **Data** : Ingestion via les dépôts Open Data de l'Assemblée Nationale.

---

## 🤝 Contribuer

Les contributions sont les bienvenues ! 
1. Forkez le projet.
2. Créez votre branche (`git checkout -b feature/AmazingFeature`).
3. Commitez vos changements (`git commit -m 'Add some AmazingFeature'`).
4. Pushez sur la branche (`git push origin feature/AmazingFeature`).
5. Ouvrez une Pull Request.

---

## 📜 Licence

Ce projet est distribué sous licence **MIT**. Voir le fichier `LICENSE` pour plus de détails.
