import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'favicon.svg', 'src']) await cp(file, `dist/${file}`, { recursive: true });
await writeFile('dist/.nojekyll', '');
const html = await readFile('dist/index.html', 'utf8');
if (html.includes('href="/src') || html.includes('src="/src')) throw new Error('Assets must work under /Ally/');
console.log('Built dependency-free static site in dist/ (all assets relative to /Ally/).');
