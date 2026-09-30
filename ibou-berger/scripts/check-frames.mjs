// Vérifie le manifeste et la présence de toutes les images référencées.
import fs from 'node:fs';
import path from 'node:path';
const dir = 'public/flight';
const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const f = (i) => path.join(dir, m.pattern.replace('{index4}', String(i).padStart(4, '0')));
const missing = [...Array(m.count).keys()].filter((i) => !fs.existsSync(f(i)));
const extra = fs.readdirSync(path.join(dir, 'frames')).length - m.count;
const size = fs.readdirSync(path.join(dir, 'frames')).reduce((a, n) => a + fs.statSync(path.join(dir, 'frames', n)).size, 0);
console.log(`manifeste : ${m.count} images @ ${m.fps} i/s, ${m.width}×${m.height}, source ${m.source}`);
console.log(`première ${fs.existsSync(f(0))}, deuxième ${fs.existsSync(f(1))}, dernière ${fs.existsSync(f(m.count - 1))}, affiche ${fs.existsSync(path.join(dir, m.poster))}`);
console.log(`manquantes : ${missing.length}, en trop : ${extra}, poids total ${(size / 1e6).toFixed(1)} Mo`);
process.exit(missing.length || !fs.existsSync(path.join(dir, m.poster)) ? 1 : 0);
