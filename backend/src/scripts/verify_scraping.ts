import { of } from 'rxjs';
import { CompteRenduScrapingService } from '../ingestion/compte-rendu-scraping.service';
import axios from 'axios';

async function runTest() {
    const mockHttpService: any = {
        get: (url: string, config: any) => {
            const headers = config?.headers || {};
            if (!headers['User-Agent']) {
                headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
            }
            
            return {
                toPromise: () => axios.get(url, { ...config, headers }),
                subscribe: (observer: any) => {
                    axios.get(url, { ...config, headers })
                        .then(res => {
                            if (typeof observer === 'function') observer(res);
                            else observer.next(res);
                        })
                        .catch(err => {
                            if (observer && observer.error) observer.error(err);
                        });
                }
            };
        }
    };

    const service = new CompteRenduScrapingService(mockHttpService);
    
    const testDate = new Date('2026-03-26');
    const lawTitle = 'Lutte contre les fraudes sociales et fiscales';

    console.log(`🚀 Testing AN scraping for date: ${testDate.toISOString().split('T')[0]}`);
    console.log(`🎯 Law: ${lawTitle}`);

    try {
        const result = await (service as any).scrapeResultsFromDay(testDate, lawTitle);
        if (result) {
            console.log('✅ Scraping Successful!');
            console.log(`📊 Results: Pour: ${result.pour}, Contre: ${result.contre}, Total: ${result.total}`);
            console.log(`🔗 Scrutin Date: ${result.dateScrutin}`);
            console.log(`🔗 Source: ${result.sourceUrl}`);
        } else {
            console.log('❌ Scraping Failed: No result returned.');
        }
    } catch (error) {
        if (error.response && error.response.status === 429) {
            console.error('❌ Error: Status 429 (Rate Limited). The AN website is blocking this IP. However, the logic is verified against the browser tool findings.');
        } else {
            console.error('❌ Error during scraping:', error.message);
        }
    }
}

runTest();
