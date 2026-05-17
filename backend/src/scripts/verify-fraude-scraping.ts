import axios from 'axios';
import * as cheerio from 'cheerio';

async function verifyFraudeScraping() {
    const targetDate = '2026-03-31';
    const targetTitle = "Projet de loi relatif à la lutte contre les fraudes sociales et fiscales";
    const baseUrl = 'https://www.assemblee-nationale.fr';
    const listUrl = `${baseUrl}/dyn/17/comptes-rendus/seance`;

    console.log(`🔍 Vérification du scraping pour le ${targetDate}...`);
    console.log(`📖 Titre cible: "${targetTitle}"`);

    try {
        const response = await axios.get(listUrl);
        const $ = cheerio.load(response.data);
        const sittings: { id: string; date: string; title: string; url: string }[] = [];

        // Logique simplifiée de fetchSittingsForDay
        $('.cr-seance-item').each((_, el) => {
            const dateLabel = $(el).find('.cr-seance-date').text().trim();
            const sessionTitle = $(el).find('.cr-seance-title').text().trim();
            const link = $(el).find('a').attr('href');

            if (link && dateLabel.includes('31 mars 2026')) {
                sittings.push({
                    id: link.split('/').pop() || '',
                    date: targetDate,
                    title: sessionTitle,
                    url: link.startsWith('http') ? link : baseUrl + link
                });
            }
        });

        console.log(`📊 ${sittings.length} séances trouvées pour le 31 mars.`);

        for (const sitting of sittings) {
            console.log(`\n--- Analyse de la séance: ${sitting.title} (${sitting.id}) ---`);
            const jsonUrl = `https://www.assemblee-nationale.fr/static/openData/repository/17/loi/comptes_rendus/JSON/2026/seance/${sitting.id}.json`;
            
            try {
                const jsonRes = await axios.get(jsonUrl);
                const data = jsonRes.data;
                const points = data.compteRendu?.contenu?.sommaire?.sommaire_titre_1 || [];
                
                let lawIdentified = false;
                let voteFound = false;

                const keywords = targetTitle.toLowerCase().split(' ').filter(w => w.length > 4);

                for (const point of points) {
                    const pointTitle = (point.titre_complet || '').toLowerCase();
                    const matches = keywords.filter(k => pointTitle.includes(k)).length;
                    const ratio = matches / keywords.length;

                    if (matches / keywords.length > 0.6) {
                        lawIdentified = true;
                        console.log(`✅ Loi identifiée dans le point: "${point.titre_complet.substring(0, 80)}..."`);
                        
                        // Chercher un vote chiffré
                        const stringContent = JSON.stringify(point);
                        if (stringContent.includes('VOTE_ENS_P') || stringContent.includes('chiffre-vote')) {
                            voteFound = true;
                            console.log(`🗳️ Vote final détecté !`);
                        }
                    }
                }

                if (lawIdentified && !voteFound) {
                    console.log(`ℹ️ RÉSULTAT: En discussion (Loi présente, pas de vote final).`);
                } else if (lawIdentified && voteFound) {
                    console.log(`✅ RÉSULTAT: Vote détecté.`);
                } else {
                    console.log(`❌ RÉSULTAT: Loi non mentionnée dans cette séance.`);
                }

            } catch (e) {
                console.error(`⚠️ Impossible de charger le JSON ${jsonUrl}: ${e.message}`);
            }
        }

    } catch (error) {
        console.error(`❌ Erreur globale: ${error.message}`);
    }
}

verifyFraudeScraping();
