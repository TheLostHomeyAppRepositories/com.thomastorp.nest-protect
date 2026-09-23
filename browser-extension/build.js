'use strict';

// Lager én mappe og én zip per nettleser under dist/. Koden er felles; bare
// manifestet skiller seg. Firefox vil ha manifestet under navnet
// manifest.json, så det kopieres inn med riktig navn i stedet for at vi
// holder to nesten like mapper i sync for hånd.
//
//   node build.js
//
// Zip lages med tar, ikke PowerShells Compress-Archive: den skriver
// baklengs skråstrek i stiene på Windows PowerShell 5.1, og da avviser
// addons.mozilla.org pakken fordi icons\icon16.png ikke finnes.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const FILES = ['background.js', 'shared.js', 'popup.html', 'popup.js'];
const ICONS = ['icon16.png', 'icon32.png', 'icon48.png', 'icon128.png'];

const TARGETS = [
  { name: 'chrome', manifest: 'manifest.json' },
  { name: 'firefox', manifest: 'manifest.firefox.json' },
];

function build({ name, manifest }) {
  const dir = path.join(DIST, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'icons'), { recursive: true });

  for (const file of FILES) fs.copyFileSync(path.join(ROOT, file), path.join(dir, file));
  for (const icon of ICONS) fs.copyFileSync(path.join(ROOT, 'icons', icon), path.join(dir, 'icons', icon));
  fs.copyFileSync(path.join(ROOT, manifest), path.join(dir, 'manifest.json'));

  const { version } = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const zip = path.join(DIST, `nest-protect-setup-helper-${name}-${version}.zip`);
  fs.rmSync(zip, { force: true });
  // Windows' egen bsdtar kan skrive zip. GNU tar fra Git Bash kan ikke, og
  // leser «C:» i en absolutt sti som en ekstern maskin; derfor både fast sti
  // til verktøyet og relativ sti til zip-filen.
  const tar = process.platform === 'win32'
    ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe')
    : 'tar';
  execFileSync(tar, ['-a', '-c', '-f', path.relative(dir, zip), 'manifest.json', ...FILES, 'icons'], { cwd: dir });

  console.log(`${name.padEnd(8)} ${version}  ${path.relative(ROOT, dir)}  ${path.relative(ROOT, zip)}`);
}

fs.mkdirSync(DIST, { recursive: true });
TARGETS.forEach(build);
