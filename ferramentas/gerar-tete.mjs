// Gera as malhas 3D da Teté a partir da escultura (js/tete3d/escultura.js).
//
//   node ferramentas/gerar-tete.mjs
//
// Saída: assets/tete/tete.json (descrição) + assets/tete/tete.bin (dados).
// Cada parte vira uma malha suave (surface nets sobre o campo de distância),
// com normais tiradas do próprio campo e pesos de osso para animação.

import { writeFileSync, mkdirSync } from 'node:fs';
import { criarEscultura } from '../js/tete3d/escultura.js';
import { criarEsqueleto } from '../js/movimento/rig.js';
import { normal } from '../js/tete3d/sdf.js';

function malhaDeSDF(sdf, min, max, passo) {
  const nx = Math.ceil((max[0] - min[0]) / passo) + 1;
  const ny = Math.ceil((max[1] - min[1]) / passo) + 1;
  const nz = Math.ceil((max[2] - min[2]) / passo) + 1;
  const val = new Float32Array(nx * ny * nz);
  const id = (i, j, k) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    val[id(i, j, k)] = sdf(min[0] + i * passo, min[1] + j * passo, min[2] + k * passo);
  }
  const celula = new Int32Array(nx * ny * nz).fill(-1);
  const pos = [];
  const cantos = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const arestas = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const v = cantos.map(([a, b, c]) => val[id(i + a, j + b, k + c)]);
    let neg = 0;
    for (const x of v) if (x < 0) neg++;
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of arestas) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      sx += cantos[a][0] + (cantos[b][0] - cantos[a][0]) * t;
      sy += cantos[a][1] + (cantos[b][1] - cantos[a][1]) * t;
      sz += cantos[a][2] + (cantos[b][2] - cantos[a][2]) * t;
      n++;
    }
    celula[id(i, j, k)] = pos.length / 3;
    pos.push(min[0] + (i + sx / n) * passo, min[1] + (j + sy / n) * passo, min[2] + (k + sz / n) * passo);
  }
  const idx = [];
  const quad = (a, b, c, d, inverter) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (inverter) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = val[id(i, j, k)];
    if ((v0 < 0) !== (val[id(i + 1, j, k)] < 0)) quad(celula[id(i, j - 1, k - 1)], celula[id(i, j, k - 1)], celula[id(i, j, k)], celula[id(i, j - 1, k)], v0 < 0);
    if ((v0 < 0) !== (val[id(i, j + 1, k)] < 0)) quad(celula[id(i - 1, j, k - 1)], celula[id(i - 1, j, k)], celula[id(i, j, k)], celula[id(i, j, k - 1)], v0 < 0);
    if ((v0 < 0) !== (val[id(i, j, k + 1)] < 0)) quad(celula[id(i - 1, j - 1, k)], celula[id(i, j - 1, k)], celula[id(i, j, k)], celula[id(i - 1, j, k)], v0 < 0);
  }
  // projeta os vértices na superfície exata e calcula normais suaves
  const nor = new Float32Array(pos.length);
  for (let v = 0; v < pos.length; v += 3) {
    let [x, y, z] = [pos[v], pos[v + 1], pos[v + 2]];
    for (let it = 0; it < 2; it++) {
      const d = sdf(x, y, z), g = normal(sdf, x, y, z, passo * 0.25);
      x -= d * g[0]; y -= d * g[1]; z -= d * g[2];
    }
    pos[v] = x; pos[v + 1] = y; pos[v + 2] = z;
    const g = normal(sdf, x, y, z, passo * 0.5);
    nor[v] = g[0]; nor[v + 1] = g[1]; nor[v + 2] = g[2];
  }
  return { pos: Float32Array.from(pos), nor, idx };
}

const { partes } = criarEscultura();
const nomesOssos = Object.keys(criarEsqueleto().ossos);
const blocos = [];
let offset = 0;
const adicionar = (typed) => {
  const pad = (4 - (offset % 4)) % 4;
  if (pad) { blocos.push(Buffer.alloc(pad)); offset += pad; }
  const buf = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
  const inicio = offset;
  blocos.push(buf);
  offset += buf.length;
  return { offset: inicio, tamanho: buf.length };
};

const manifesto = { versao: 1, ossos: nomesOssos, malhas: [] };
const filtro = process.argv[2];
for (const p of partes) {
  if (filtro && !p.nome.startsWith(filtro)) continue;
  const t0 = Date.now();
  const { pos, nor, idx } = malhaDeSDF(p.sdf, p.min, p.max, p.passo);
  const nv = pos.length / 3;
  // posições quantizadas em 16 bits dentro da caixa da parte
  const qmin = p.min, qesc = p.max.map((m, i) => (m - p.min[i]) / 65535);
  const qpos = new Uint16Array(pos.length);
  for (let i = 0; i < pos.length; i++) qpos[i] = Math.round((pos[i] - qmin[i % 3]) / qesc[i % 3]);
  const qnor = new Int8Array(pos.length);
  for (let i = 0; i < nor.length; i++) qnor[i] = Math.round(nor[i] * 127);
  const indices = nv < 65536 ? Uint16Array.from(idx) : Uint32Array.from(idx);
  const malha = {
    nome: p.nome, material: p.material, vertices: nv, triangulos: idx.length / 3,
    quantMin: qmin, quantEscala: qesc,
    posicao: adicionar(qpos), normal: adicionar(qnor), indice: { ...adicionar(indices), bits: nv < 65536 ? 16 : 32 },
  };
  if (p.cor) {
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const cor = new Uint8Array(nv * 3);
    for (let v = 0; v < nv; v++) {
      const c = p.cor(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
      for (let k = 0; k < 3; k++) cor[v * 3 + k] = Math.round(lin(c[k]) * 255);
    }
    malha.cor = adicionar(cor);
  }
  if (p.rigido) malha.rigido = p.rigido;
  else {
    const si = new Uint8Array(nv * 4), sw = new Uint8Array(nv * 4);
    for (let v = 0; v < nv; v++) {
      const pesos = Object.entries(p.pesos(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]))
        .filter(([, w]) => w > 0.004).sort((a, b) => b[1] - a[1]).slice(0, 4);
      const soma = pesos.reduce((s, [, w]) => s + w, 0);
      let resto = 255;
      pesos.forEach(([osso, w], k) => {
        si[v * 4 + k] = nomesOssos.indexOf(osso);
        const q = k === pesos.length - 1 ? resto : Math.round((w / soma) * 255);
        sw[v * 4 + k] = q; resto -= q;
      });
    }
    malha.ossoIndice = adicionar(si);
    malha.ossoPeso = adicionar(sw);
  }
  manifesto.malhas.push(malha);
  console.log(`${p.nome.padEnd(12)} ${String(nv).padStart(7)} vértices ${String(idx.length / 3).padStart(7)} triângulos  ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
mkdirSync('assets/tete', { recursive: true });
writeFileSync('assets/tete/tete.bin', Buffer.concat(blocos));
writeFileSync('assets/tete/tete.json', JSON.stringify(manifesto, null, 1));
console.log(`total: ${(offset / 1024 / 1024).toFixed(2)} MB`);
