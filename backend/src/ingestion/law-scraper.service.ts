import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as cheerio from 'cheerio';

@Injectable()
export class LawScraperService {
    private readonly logger = new Logger(LawScraperService.name);
    
    // Headers to mimic a real browser to avoid 429
    private readonly HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Connection': 'keep-alive',
    };

    constructor(private readonly httpService: HttpService) {}

    /**
     * Fetch and extract text from a law URL
     * Returns the raw text up to a reasonable limit (e.g., 20000 chars)
     */
    async extractTextFromUrl(url: string): Promise<string | null> {
        if (!url) return null;

        this.logger.log(`🔍 Extraction du texte depuis : ${url}`);

        try {
            const response = await firstValueFrom(
                this.httpService.get(url, {
                    headers: this.HEADERS,
                    timeout: 10000, // 10 seconds timeout
                })
            );

            const html = response.data;
            const $ = cheerio.load(html);

            // The main content on AN website is usually in specific containers
            // We'll try to find the most relevant one, or fallback to body
            
            // Remove scripts, styles, nav, header, footer to clean up text
            $('script, style, nav, header, footer, .navigation, .menu, #menu, .footer, #footer').remove();

            let mainContent = $('#document, .contenu-principal, .corps-texte, article, main');
            
            if (mainContent.length === 0) {
                mainContent = $('body'); // Fallback
            }

            // Extract text from paragraphs, headers, and specific classes
            const paragraphs: string[] = [];
            
            mainContent.find('h1, h2, h3, h4, p, .alinea, .article').each((_, el) => {
                const text = $(el).text().trim();
                if (text && text.length > 5) { // Skip very short/empty lines
                    paragraphs.push(text);
                }
            });

            // If we didn't find much with specific selectors, just get all text
            let fullText = paragraphs.join('\n\n');
            
            if (fullText.length < 500) {
                fullText = mainContent.text()
                    .replace(/\s+/g, ' ') // Collapse whitespace
                    .trim();
            }

            if (!fullText) {
                this.logger.warn(`⚠️ Aucun texte trouvé pour ${url}`);
                return null;
            }

            // Return up to 20000 characters to avoid huge DB strings if we only need ~4000 for AI
            const truncatedText = fullText.substring(0, 20000);
            
            this.logger.log(`✅ Texte extrait avec succès (${truncatedText.length} caractères)`);
            return truncatedText;

        } catch (error) {
            this.logger.error(`❌ Erreur d'extraction pour ${url}: ${error.message}`);
            return null;
        }
    }
}
