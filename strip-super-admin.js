/*
 * strip-super-admin.js — Copia uma pasta dist/ removendo os arquivos do Super Admin.
 *
 * O Super Admin pertence apenas ao HUB (servidor completo, com internet). Os pacotes
 * entregues ao cliente NÃO podem conter super-admin.html nem os assets super-admin-*.js.
 *
 * Uso:
 *   node strip-super-admin.js <origem> <destino>
 *
 * Exemplos:
 *   node strip-super-admin.js dist ubuntu-server/dist
 *   node strip-super-admin.js dist installer/output/dist
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(process.argv[2] || path.join(__dirname, 'dist'));
const DEST = path.resolve(process.argv[3] || path.join(__dirname, 'dist-cliente'));

// Remove qualquer arquivo do Super Admin: super-admin.html, super-admin-*.js, super-admin-*.css
function isSuperAdminFile(name) {
  return /^super-admin/.test(name);
}

// Remove arquivos de super admin que já existam no destino (evita resíduos de cópias antigas)
function cleanSuperAdmin(dir) {
  let removed = 0;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      removed += cleanSuperAdmin(full);
      try { fs.rmdirSync(full); } catch (e) {}
      continue;
    }
    if (isSuperAdminFile(ent.name)) {
      fs.unlinkSync(full);
      console.log('  [limpo] ' + path.relative(DEST, full));
      removed++;
    }
  }
  return removed;
}

function copyDir(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  let copied = 0;
  let stripped = 0;
  for (const ent of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, ent.name);
    const d = path.join(destDir, ent.name);
    if (ent.isDirectory()) {
      const r = copyDir(s, d);
      copied += r.copied;
      stripped += r.stripped;
      if (r.copied === 0) {
        try { fs.rmdirSync(d); } catch (e) {}
      }
      continue;
    }
    if (isSuperAdminFile(ent.name)) {
      console.log('  [strip] ' + path.relative(SRC, s));
      stripped++;
      continue;
    }
    fs.copyFileSync(s, d);
    copied++;
  }
  return { copied, stripped };
}

if (!fs.existsSync(SRC)) {
  console.error('Origem não encontrada: ' + SRC);
  process.exit(1);
}

console.log('Copiando ' + path.relative(process.cwd(), SRC) + ' -> ' + path.relative(process.cwd(), DEST));
let cleaned = 0;
if (fs.existsSync(DEST)) cleaned = cleanSuperAdmin(DEST);
const r = copyDir(SRC, DEST);
console.log('Concluído: ' + r.copied + ' arquivo(s) copiado(s), ' + r.stripped + ' arquivo(s) de super admin removido(s), ' + cleaned + ' resíduo(s) limpo(s).');

const leftovers = [];
(function check(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) check(full);
    else if (isSuperAdminFile(ent.name)) leftovers.push(path.relative(DEST, full));
  }
})(DEST);
if (leftovers.length) {
  console.error('AVISO: ainda existem arquivos de super admin em ' + DEST + ':');
  leftovers.forEach(l => console.error('  ' + l));
  process.exit(2);
}
