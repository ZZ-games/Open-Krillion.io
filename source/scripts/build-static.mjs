// Builds a fully static copy of the game into dist/ for GitHub Pages (or any
// static host). No server, database or cookies: dives are kept in localStorage.
// Usage: node scripts/build-static.mjs
import { mkdir, writeFile, readFile, readdir, copyFile, rm } from 'node:fs/promises';
import { homePage, infoPage } from '../src/html.mjs';
import { documents } from '../src/docs.mjs';

const OUT = 'dist';
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT + '/assets', { recursive: true });

// Turn site-root paths ("/assets/x") into relative ones so the game works under
// any sub-path, e.g. https://zz-games.github.io/openkrillion/
const relative = (text, up = '') => text
  .replace(/(["'(])\/assets\//g, `$1${up}assets/`)
  .replace(/(["'])\/(style\.css|app\.mjs)/g, `$1${up}$2`)
  .replace(/href="\/(privacy|about)"/g, `href="${up}$1/"`)
  .replace(/href="\/\?lang=(en|zh)"/g, `href="${up || './'}"`)
  .replace(/href="\/(llms\.txt|llms-full\.txt|pricing\.md|models\.md)"/g, `href="${up}$1"`)
  .replace(/href="\/"/g, `href="${up || './'}"`);

let home = relative(homePage('en', {}));
home = home.replace(/<script id="runtime-config" type="application\/json">([\s\S]*?)<\/script>/, (_, json) => {
  const cfg = { ...JSON.parse(json), static: true, local: false };
  return `<script id="runtime-config" type="application/json">${JSON.stringify(cfg)}</script>`;
});
home = home.replace('Sample practice bank · reference sync unavailable', 'ZZ Games question bank');
await writeFile(`${OUT}/index.html`, home);

for (const page of ['privacy', 'about']) {
  await mkdir(`${OUT}/${page}`, { recursive: true });
  await writeFile(`${OUT}/${page}/index.html`, relative(infoPage('/' + page), '../'));
}

for (const file of await readdir('public')) {
  if (file === 'assets') continue;
  await writeFile(`${OUT}/${file}`, relative(await readFile(`public/${file}`, 'utf8')));
}
for (const file of await readdir('public/assets')) await copyFile(`public/assets/${file}`, `${OUT}/assets/${file}`);
await copyFile('static/local-api.mjs', `${OUT}/local-api.mjs`);
await copyFile('src/demo.mjs', `${OUT}/demo.mjs`);
for (const f of ['prompts','prompt-lib','prompts-more1','prompts-more2','prompts-more3','prompts-more4']) await copyFile(`src/${f}.mjs`, `${OUT}/${f}.mjs`);
for (const [path, body] of Object.entries(documents())) await writeFile(OUT + path, body);
await writeFile(`${OUT}/.nojekyll`, '');
await copyFile('LICENSE', `${OUT}/LICENSE`);
console.log('Static site written to dist/');
