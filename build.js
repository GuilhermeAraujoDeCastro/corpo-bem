// Build de produção: empacota js/main.js (e tudo que ele importa) num único
// arquivo com o esbuild e depois ofusca esse arquivo com o javascript-obfuscator,
// pra quem abrir o F12 no site publicado não ver o código fonte legível.
//
// Importante: ofuscar os módulos ES separadamente (sem empacotar antes)
// quebraria as referências de import/export entre os arquivos, por isso
// o empacotamento vem primeiro. Os imports do Firebase (que apontam pra
// URLs do gstatic.com) ficam de fora do pacote de propósito, resolvidos
// pelo navegador como sempre.
//
// Roda sozinho no deploy da Netlify (veja "command" no netlify.toml).
// Pra rodar na sua máquina: npm install && npm run build
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';
import JavaScriptObfuscator from 'javascript-obfuscator';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const COPY_ENTRIES = ['index.html', 'manifest.json', 'css', 'assets'];

async function copyRecursive(src, dest) {
    const stat = await fs.stat(src).catch(() => null);
    if (!stat) return;
    if (stat.isDirectory()) {
        await fs.mkdir(dest, { recursive: true });
        for (const entry of await fs.readdir(src)) {
            await copyRecursive(path.join(src, entry), path.join(dest, entry));
        }
    } else {
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(src, dest);
    }
}

function obfuscate(code) {
    return JavaScriptObfuscator.obfuscate(code, {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.6,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.2,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.75,
        identifierNamesGenerator: 'hexadecimal',
        selfDefending: false,
        disableConsoleOutput: false
    }).getObfuscatedCode();
}

async function main() {
    await fs.rm(DIST, { recursive: true, force: true });
    await fs.mkdir(DIST, { recursive: true });

    for (const entry of COPY_ENTRIES) {
        await copyRecursive(path.join(__dirname, entry), path.join(DIST, entry));
    }

    const bundle = await esbuild.build({
        entryPoints: [path.join(__dirname, 'js', 'main.js')],
        bundle: true,
        format: 'esm',
        target: 'es2019',
        write: false,
        external: ['https://*', 'http://*'],
        legalComments: 'none'
    });
    const bundledCode = bundle.outputFiles[0].text;

    await fs.mkdir(path.join(DIST, 'js'), { recursive: true });
    await fs.writeFile(path.join(DIST, 'js', 'main.js'), obfuscate(bundledCode), 'utf8');

    const swCode = await fs.readFile(path.join(__dirname, 'sw.js'), 'utf8');
    await fs.writeFile(path.join(DIST, 'sw.js'), obfuscate(swCode), 'utf8');

    console.log('Build concluído em dist/, com o JavaScript empacotado e ofuscado.');
}

main().catch(err => {
    console.error('Falha no build:', err);
    process.exit(1);
});
