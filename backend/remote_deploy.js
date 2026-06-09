/**
 * Script de déploiement backend — Demok
 * ======================================
 * Envoie l'intégralité du code source vers le serveur de production
 * via une archive ZIP, puis déclenche un rebuild Docker.
 *
 * Usage : node deploy_backend.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

// ─── Configuration ────────────────────────────────────────────────────────────
const SSH_KEY    = 'C:\\Users\\laure\\.ssh\\id_ed25519_scaleway';
const SERVER     = 'root@votre-domaine.com';
const REMOTE_DIR = '/root/demok/backend';
const ZIP_NAME   = 'backend_deploy.zip';
const ZIP_LOCAL  = path.join(__dirname, ZIP_NAME);
const ZIP_REMOTE = `/tmp/${ZIP_NAME}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ssh(cmd) {
  const escaped = cmd.replace(/"/g, '\\"');
  return `ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no ${SERVER} "${escaped}"`;
}

function run(cmd, label) {
  if (label) console.log(`\n${label}`);
  execSync(cmd, { stdio: 'inherit' });
}

function cleanup() {
  if (fs.existsSync(ZIP_LOCAL)) {
    fs.unlinkSync(ZIP_LOCAL);
  }
}

// ─── Déploiement ──────────────────────────────────────────────────────────────
async function deploy() {
  console.log('🚀 Démarrage du déploiement Demok Backend...\n');

  // ── Étape 1 : Création de l'archive ──────────────────────────────────────
  console.log('📦 Étape 1/5 : Création de l\'archive ZIP...');
  const zip = new AdmZip();

  // Dossier src/ complet (récursif)
  const srcPath = path.join(__dirname, 'src');
  if (!fs.existsSync(srcPath)) {
    throw new Error(`Dossier src/ introuvable : ${srcPath}`);
  }
  zip.addLocalFolder(srcPath, 'src');

  // package.json et package-lock.json (pour les dépendances)
  zip.addLocalFile(path.join(__dirname, 'package.json'));
  const lockPath = path.join(__dirname, 'package-lock.json');
  if (fs.existsSync(lockPath)) {
    zip.addLocalFile(lockPath);
  } else {
    console.warn('  ⚠️  package-lock.json introuvable — ignoré.');
  }

  zip.writeZip(ZIP_LOCAL);
  const sizeMB = (fs.statSync(ZIP_LOCAL).size / 1024 / 1024).toFixed(2);
  console.log(`  ✅ Archive créée : ${ZIP_NAME} (${sizeMB} MB)`);

  // ── Étape 2 : Transfert SCP vers le serveur ───────────────────────────────
  run(
    `scp -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${ZIP_LOCAL}" ${SERVER}:${ZIP_REMOTE}`,
    '📤 Étape 2/5 : Transfert de l\'archive vers le serveur...'
  );
  console.log('  ✅ Transfert terminé');

  // ── Étape 3 : Extraction sur le serveur ──────────────────────────────────
  console.log('\n🗂️  Étape 3/5 : Extraction et remplacement du code source...');
  const extractCmd = [
    `cd ${REMOTE_DIR}`,
    `rm -rf src/`,                          // Supprime l'ancien src/ (zéro fichier orphelin)
    `unzip -o ${ZIP_REMOTE} -d .`,          // Extrait le nouveau src/ + package*.json
    `rm -f ${ZIP_REMOTE}`,                  // Nettoyage de l'archive temporaire
  ].join(' && ');
  run(ssh(extractCmd));
  console.log('  ✅ Code source mis à jour sur le serveur');

  // ── Étape 4 : Rebuild Docker ─────────────────────────────────────────────
  run(
    ssh(`cd /root/demok && docker compose -p demok -f backend/docker-compose.prod.yml up -d --build backend`),
    '🐳 Étape 4/5 : Rebuild et redémarrage du conteneur Docker...\n'
  );
  console.log('\n  ✅ Rebuild Docker terminé');

  // ── Étape 5 : Vérification ───────────────────────────────────────────────
  console.log('\n🔍 Étape 5/5 : Vérification du statut des conteneurs...\n');
  run(ssh(`docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"`));

  // ── Nettoyage local ───────────────────────────────────────────────────────
  cleanup();

  console.log('\n🎉 Déploiement terminé avec succès ! Le backend est en ligne.\n');
}

// ─── Lancement ─────────────────────────────────────────────────────────────
deploy().catch(err => {
  console.error('\n❌ Erreur lors du déploiement :', err.message);
  cleanup();
  process.exit(1);
});
