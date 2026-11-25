import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');

describe('deployment configuration', () => {
    it('Caddy serves the domain given by the DOMAIN variable (no placeholder domain)', () => {
        const caddyfile = read('Caddyfile');
        expect(caddyfile).toMatch(/^\{\$DOMAIN\} \{/m);
        expect(caddyfile).not.toContain('votre-domaine');
        expect(read('docker-compose.prod.yml')).toMatch(/DOMAIN=\$\{DOMAIN:\?/);
    });

    it('package.json license matches the repository LICENSE', () => {
        const pkg = JSON.parse(read('package.json'));
        expect(read('../LICENSE')).toMatch(/^MIT License/);
        expect(pkg.license).toBe('MIT');
        expect(pkg.author).not.toBe('Antigravity');
    });

    it('.env.example only documents variables the code reads', () => {
        const env = read('.env.example');
        expect(env).not.toMatch(/^DATABASE_URL=/m);
        expect(env).not.toMatch(/^REDIS_HOST=/m);
        expect(env).toMatch(/^REDIS_URL=/m);
    });

    it('the API no longer tries to serve the Flutter build (hosted on Firebase)', () => {
        const main = read('src/main.ts');
        expect(main).not.toContain("'mobile', 'build', 'web'");
        expect(main).not.toContain('index.html');
    });
});
