// Escultura da Teté (estilo animação): cada parte do corpo é um campo de
// distância feito de formas unidas suavemente. Este módulo é usado tanto pelo
// gerador offline (ferramentas/gerar-tete.mjs), que transforma a escultura em
// malhas, quanto pelo app (o rosto usa a superfície da cabeça para assentar
// lábios e sobrancelhas).
//
// Inspirada na modelo de referência: rosto oval suave com bochechas discretas,
// nariz pequeno, olhos grandes, cabelo castanho cacheado muito volumoso,
// blusa gola alta canelada sem manga e jeans de cintura alta.

import * as THREE from '../vendor/three.module.min.js';
import { criarEsqueleto, aplicarPoseLigacao, DEDOS, FALANGES, COMP_DEDOS } from '../movimento/rig.js';
import { esfera, elipsoide, cone, caixa, toro, smin, ssub, smax, suave, aplicar, aleatorio } from './sdf.js';

// ------------------------------------------------------------------ cabeça -
// Coordenadas locais do osso "head" (origem no topo do pescoço).

// escala da cabeça: um pouco maior que o real, como em personagens de animação
export const K = 1.18;
export const CABECA = {
  escala: K,
  centro: [0, 0.115 * K, 0.01 * K],
  olho: (s) => [s * 0.036 * K, 0.123 * K, 0.072 * K], // centro do globo ocular
  raioOlho: 0.0195 * K,
};

export function sdfCabeca(x, y, z) {
  return sdfCabecaBase(x / K, y / K, z / K) * K;
}

function sdfCabecaBase(x, y, z) {
  const px = x, py = y - 0.115, pz = z - 0.01; // relativo ao centro da cabeça
  let d = elipsoide(px, py, pz, [0, 0.012, -0.012], [0.086, 0.1, 0.096]);
  d = smin(d, elipsoide(px, py, pz, [0, 0.05, 0.035], [0.074, 0.05, 0.062]), 0.03); // testa
  for (const s of [1, -1]) d = smin(d, esfera(px, py, pz, [s * 0.04, -0.036, 0.036], 0.03), 0.03); // bochechas (suaves)
  d = smin(d, elipsoide(px, py, pz, [0, -0.056, 0.026], [0.046, 0.044, 0.052]), 0.03); // mandíbula (afinada)
  d = smin(d, esfera(px, py, pz, [0, -0.084, 0.047], 0.016), 0.022); // queixo
  for (const s of [1, -1]) d = smin(d, elipsoide(px, py, pz, [s * 0.036, 0.035, 0.07], [0.024, 0.007, 0.011]), 0.014); // arco das sobrancelhas
  // nariz pequeno e arrebitado
  d = smin(d, cone(px, py, pz, [0, 0.0, 0.086], [0, -0.016, 0.096], 0.0062, 0.0092), 0.012);
  d = smin(d, esfera(px, py, pz, [0, -0.021, 0.098], 0.0108), 0.009);
  for (const s of [1, -1]) {
    d = smin(d, esfera(px, py, pz, [s * 0.0112, -0.0275, 0.089], 0.0074), 0.007);
    d = ssub(d, esfera(px, py, pz, [s * 0.0066, -0.033, 0.098], 0.0031), 0.003); // narinas
  }
  // região da boca levemente projetada (os lábios são malhas animadas por cima)
  d = smin(d, elipsoide(px, py, pz, [0, -0.052, 0.074], [0.026, 0.016, 0.018]), 0.02);
  // órbitas para os olhos
  for (const s of [1, -1]) d = ssub(d, esfera(px, py, pz, [s * 0.036, 0.008, 0.062], 0.0212), 0.01);
  // orelhas
  for (const s of [1, -1]) {
    d = smin(d, elipsoide(px, py, pz, [s * 0.089, 0.0, -0.008], [0.011, 0.024, 0.016]), 0.008);
    d = ssub(d, elipsoide(px, py, pz, [s * 0.095, 0.002, -0.004], [0.004, 0.014, 0.009]), 0.004);
  }
  return d;
}

// Volume do cabelo: nuvem de "bolhas" de cachos ao redor da cabeça, caindo
// até os ombros, com o rosto livre.
const BOLHAS = (() => {
  const rnd = aleatorio(31);
  const lista = [];
  const H = [0, 0.13, -0.012];
  for (let i = 0; i < 2600 && lista.length < 115; i++) {
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    const nx = r * Math.cos(th), ny = u, nz = r * Math.sin(th);
    if (ny < -0.2 && nz > 0.25) continue; // nada na frente do pescoço
    if (nz > 0.45 && ny < 0.55 && Math.abs(nx) < 0.7) continue; // rosto livre
    const desce = ny < 0 ? -ny : 0;
    const c = [
      H[0] + nx * (0.1 + desce * 0.012),
      H[1] + ny * (ny > 0 ? 0.11 : 0.16),
      H[2] + nz * 0.102 - desce * 0.015,
    ];
    lista.push([c, 0.034 + rnd() * 0.014 - desce * 0.008]);
  }
  return lista;
})();

export function sdfCabelo(x, y, z) {
  return sdfCabeloBase(x / K, y / K, z / K) * K;
}

function sdfCabeloBase(x, y, z) {
  let d = 1;
  for (const [c, r] of BOLHAS) {
    const e = esfera(x, y, z, c, r);
    if (e < d + 0.03) d = smin(d, e, 0.028);
  }
  // linha do cabelo e rosto livres
  d = ssub(d, elipsoide(x, y, z, [0, 0.092, 0.07], [0.084, 0.105, 0.078]), 0.014);
  d = ssub(d, cone(x, y, z, [0, -0.12, 0.03], [0, 0.03, 0.04], 0.055, 0.05), 0.02); // pescoço
  d = smax(d, -0.035 - y, 0.025); // termina acima dos ombros
  return d;
}

/** Superfície frontal do rosto: z para (x, y) no espaço da cabeça, por "sphere tracing". */
export function criarSuperficieRosto() {
  const cache = new Map();
  const zEm = (x, y) => {
    const chave = `${Math.round(x * 4000)}|${Math.round(y * 4000)}`;
    if (cache.has(chave)) return cache.get(chave);
    let z = 0.2;
    for (let i = 0; i < 64; i++) {
      const d = sdfCabeca(x, y, z);
      if (Math.abs(d) < 0.00005) break;
      z -= d;
      if (z < -0.1) break;
    }
    cache.set(chave, z);
    return z;
  };
  return { zEm };
}

// ------------------------------------------------------------------- corpo -

const pos = (o) => o.getWorldPosition(new THREE.Vector3()).toArray();

function distSegmento(x, y, z, a, b) {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
  const l2 = bx * bx + by * by + bz * bz;
  let t = ((x - a[0]) * bx + (y - a[1]) * by + (z - a[2]) * bz) / l2;
  t = Math.max(0, Math.min(1, t));
  const dx = x - (a[0] + bx * t), dy = y - (a[1] + by * t), dz = z - (a[2] + bz * t);
  return [Math.sqrt(dx * dx + dy * dy + dz * dz), t, Math.sqrt(l2)];
}

/**
 * Pesos de uma corrente de ossos (braço, dedo): o vértice pertence ao
 * segmento mais próximo, com transição suave perto das articulações.
 */
function pesosCorrente(x, y, z, corrente, transicao) {
  let melhor = -1, dist = Infinity, tm = 0, Lm = 1;
  corrente.forEach((s, i) => {
    const [d, t, L] = distSegmento(x, y, z, s.a, s.b);
    if (d - s.r < dist) { dist = d - s.r; melhor = i; tm = t; Lm = L; }
  });
  const s = corrente[melhor];
  const pesos = {};
  const tr = s.transicao ?? transicao;
  const ini = (tm * Lm) / tr, fim = ((1 - tm) * Lm) / tr;
  const wPai = melhor > 0 || s.pai ? 0.5 * (1 - suave(0, 1, ini)) : 0;
  const wFilho = melhor < corrente.length - 1 ? 0.5 * (1 - suave(0, 1, fim)) : 0;
  pesos[s.osso] = 1 - wPai - wFilho;
  if (wPai) pesos[melhor > 0 ? corrente[melhor - 1].osso : s.pai] = (pesos[melhor > 0 ? corrente[melhor - 1].osso : s.pai] || 0) + wPai;
  if (wFilho) pesos[corrente[melhor + 1].osso] = (pesos[corrente[melhor + 1].osso] || 0) + wFilho;
  return { pesos, dist };
}

const RAIOS_DEDOS = {
  Thumb: [0.0128, 0.0119, 0.011, 0.01],
  Index: [0.0101, 0.0095, 0.0089, 0.0083],
  Middle: [0.0104, 0.0098, 0.0091, 0.0084],
  Ring: [0.0098, 0.0092, 0.0086, 0.0079],
  Little: [0.0088, 0.0083, 0.0078, 0.0072],
};
export { RAIOS_DEDOS };

/** Monta a escultura do corpo na pose de ligação. */
export function criarEscultura() {
  const { ossos, raiz } = criarEsqueleto();
  aplicarPoseLigacao(ossos);
  raiz.updateMatrixWorld(true);
  const partes = [];

  // ---------------- blusa ----------------
  const ombro = { left: pos(ossos.leftUpperArm), right: pos(ossos.rightUpperArm) };
  const cotov = { left: pos(ossos.leftLowerArm), right: pos(ossos.rightLowerArm) };
  const dirBraco = (l) => { const v = cotov[l].map((c, i) => c - ombro[l][i]); const n = Math.hypot(...v); return v.map((c) => c / n); };
  const mangaFim = (l) => ombro[l].map((c, i) => c + dirBraco(l)[i] * 0.052);
  function sdfBlusa(x, y, z) {
    let d = smin(elipsoide(x, y, z, [0, 1.275, 0], [0.134, 0.132, 0.09]), elipsoide(x, y, z, [0, 1.11, 0], [0.113, 0.12, 0.082]), 0.06);
    d = smin(d, smax(elipsoide(x, y, z, [0, 1.06, 0], [0.114, 0.2, 0.082]), y - 1.12, 0.02), 0.03); // cintura reta até dentro do jeans
    for (const s of [1, -1]) d = smin(d, elipsoide(x, y, z, [s * 0.05, 1.228, 0.055], [0.05, 0.046, 0.042]), 0.045); // busto suave
    d = smin(d, cone(x, y, z, [-0.16, 1.405, -0.006], [0.16, 1.405, -0.006], 0.047, 0.047), 0.075); // ombros
    for (const l of ['left', 'right']) d = smin(d, cone(x, y, z, ombro[l].map((c, i) => c + [0, 0.002, 0][i]), mangaFim(l), 0.051, 0.049), 0.025); // cavas
    d = smin(d, cone(x, y, z, [0, 1.42, -0.004], [0, 1.515, 0.004], 0.058, 0.05), 0.025); // gola alta
    d = smin(d, toro(x, y, z, [0, 1.512, 0.004], 0.05, 0.0085, 0.95), 0.006); // dobra da gola
    d = ssub(d, cone(x, y, z, [0, 1.47, 0.004], [0, 1.6, 0.006], 0.036, 0.036), 0.004); // abertura do pescoço
    d = smax(d, 0.995 - y, 0.008); // barra (por dentro do jeans)
    return d;
  }
  const corrTronco = [
    { osso: 'hips', a: [0, 0.85, 0], b: [0, 1.05, 0], r: 0 },
    { osso: 'spine', a: [0, 1.05, 0], b: [0, 1.23, 0], r: 0 },
    { osso: 'chest', a: [0, 1.23, 0], b: [0, 1.45, 0], r: 0 },
    { osso: 'neck', a: [0, 1.45, 0], b: [0, 1.53, 0], r: 0 },
  ];
  function pesosTronco(x, y, z) {
    // tronco: só pela altura (independe da distância ao eixo)
    const { pesos } = pesosCorrente(0, y, 0, corrTronco, 0.05);
    // manga e topo do ombro acompanham o braço
    const lado = x > 0 ? 'left' : 'right';
    const wBraco = suave(0.125, 0.155, Math.abs(x)) * suave(1.3, 1.37, y);
    if (wBraco > 0) {
      for (const k in pesos) pesos[k] *= 1 - wBraco;
      pesos[`${lado}UpperArm`] = wBraco;
    }
    return pesos;
  }
  partes.push({ nome: 'blusa', material: 'blusa', sdf: sdfBlusa, min: [-0.25, 0.98, -0.13], max: [0.25, 1.56, 0.14], passo: 0.0055, pesos: pesosTronco });

  // ---------------- jeans ----------------
  function sdfJeans(x, y, z) {
    let d = smin(elipsoide(x, y, z, [0, 0.92, 0], [0.152, 0.16, 0.104]), elipsoide(x, y, z, [0, 1.02, 0], [0.127, 0.06, 0.087]), 0.05);
    for (const s of [1, -1]) d = smin(d, cone(x, y, z, [s * 0.072, 0.9, 0], [s * 0.078, 0.5, 0.005], 0.078, 0.062), 0.05); // pernas
    d = smin(d, toro(x, y, z, [0, 1.03, 0], 0.127, 0.0085, 0.69), 0.004); // cós
    d = smax(d, y - 1.046, 0.006);
    d = smax(d, 0.52 - y, 0.004);
    return d;
  }
  partes.push({ nome: 'jeans', material: 'jeans', sdf: sdfJeans, min: [-0.18, 0.5, -0.13], max: [0.18, 1.06, 0.13], passo: 0.006, pesos: () => ({ hips: 1 }) });

  // ---------------- pescoço ----------------
  const baseCabeca = pos(ossos.head);
  const sdfPescoco = (x, y, z) => cone(x, y, z, [0, 1.41, -0.004], [0, baseCabeca[1] + 0.06, 0.008], 0.041, 0.038);
  const corrPescoco = [
    { osso: 'chest', a: [0, 1.3, 0], b: [0, 1.45, 0], r: 0 },
    { osso: 'neck', a: [0, 1.45, 0], b: [0, 1.53, 0], r: 0 },
    { osso: 'head', a: [0, 1.53, 0], b: [0, 1.7, 0], r: 0 },
  ];
  partes.push({ nome: 'pescoco', material: 'pele', sdf: sdfPescoco, min: [-0.05, 1.39, -0.05], max: [0.05, 1.62, 0.06], passo: 0.003, pesos: (x, y) => pesosCorrente(0, y, 0, corrPescoco, 0.035).pesos });

  // ---------------- braços e mãos ----------------
  for (const lado of ['left', 'right']) {
    const s = lado === 'left' ? 1 : -1;
    const S = pos(ossos[`${lado}UpperArm`]), E = pos(ossos[`${lado}LowerArm`]), W = pos(ossos[`${lado}Hand`]);
    const alemPunho = W.map((c, i) => c + (W[i] - E[i]) * 0.08);
    const sdfBraco = (x, y, z) => smin(smin(esfera(x, y, z, S, 0.04), cone(x, y, z, S, E, 0.041, 0.0335), 0.02),
      cone(x, y, z, E, alemPunho, 0.034, 0.024), 0.025);
    const corrBraco = [
      { osso: `${lado}UpperArm`, a: S, b: E, r: 0 },
      { osso: `${lado}LowerArm`, a: E, b: W, r: 0 },
      { osso: `${lado}Hand`, a: W, b: alemPunho, r: 0 },
    ];
    const lim = [S, E, W, alemPunho];
    const min = [0, 1, 2].map((i) => Math.min(...lim.map((p) => p[i])) - 0.055);
    const max = [0, 1, 2].map((i) => Math.max(...lim.map((p) => p[i])) + 0.055);
    partes.push({ nome: `braco-${lado}`, material: 'pele', sdf: sdfBraco, min, max, passo: 0.0042, pesos: (x, y, z) => pesosCorrente(x, y, z, corrBraco, 0.045).pesos });

    // mão: palma (caixa no espaço da mão), eminência do polegar e dedos
    const mao = ossos[`${lado}Hand`];
    const inv = mao.matrixWorld.clone().invert().elements;
    const dedos = {};
    for (const d of DEDOS) {
      const juntas = FALANGES.map((f) => pos(ossos[`${lado}${d}${f}`]));
      const distal = ossos[`${lado}${d}Distal`];
      const ponta = distal.localToWorld(new THREE.Vector3(0, -COMP_DEDOS[d][2], 0)).toArray();
      dedos[d] = [...juntas, ponta];
    }
    function sdfPalma(x, y, z) {
      const [lx, ly, lz] = aplicar(inv, x, y, z);
      let d = caixa(lx, ly + 0.047, lz, [0.033, 0.042, 0.0115], 0.0105);
      d = smin(d, elipsoide(lx, ly, lz, [s * 0.019, -0.034, 0.008], [0.017, 0.025, 0.013]), 0.014);
      d = smin(d, cone(lx, ly, lz, [0, 0.03, 0], [0, -0.012, 0], 0.024, 0.026), 0.015); // punho
      return d;
    }
    function sdfMao(x, y, z) {
      let d = sdfPalma(x, y, z);
      for (const dd of DEDOS) {
        const p = dedos[dd], r = RAIOS_DEDOS[dd];
        let f = cone(x, y, z, p[0], p[1], r[0], r[1]);
        f = smin(f, cone(x, y, z, p[1], p[2], r[1], r[2]), 0.004);
        f = smin(f, cone(x, y, z, p[2], p[3], r[2], r[3]), 0.004);
        d = smin(d, f, dd === 'Thumb' ? 0.012 : 0.008);
      }
      return d;
    }
    const correntes = {};
    for (const d of DEDOS) {
      const p = dedos[d];
      correntes[d] = FALANGES.map((f, i) => ({
        osso: `${lado}${d}${f}`, a: p[i], b: p[i + 1], r: RAIOS_DEDOS[d][i], pai: i === 0 ? `${lado}Hand` : undefined,
        transicao: i === 0 ? 0.014 : 0.008,
      }));
    }
    function pesosMao(x, y, z) {
      const dPalma = sdfPalma(x, y, z);
      let melhor = null, dm = dPalma + 0.002;
      for (const d of DEDOS) {
        const r = pesosCorrente(x, y, z, correntes[d], 0.008);
        if (r.dist < dm) { dm = r.dist; melhor = r.pesos; }
      }
      if (melhor) return melhor;
      // palma: mão, com transição para o antebraço no punho
      const ly = aplicar(inv, x, y, z)[1];
      const wAnte = 1 - suave(-0.012, 0.012, -ly);
      return wAnte > 0 ? { [`${lado}Hand`]: 1 - wAnte * 0.5, [`${lado}LowerArm`]: wAnte * 0.5 } : { [`${lado}Hand`]: 1 };
    }
    const todos = [W, ...Object.values(dedos).flat()];
    const minM = [0, 1, 2].map((i) => Math.min(...todos.map((p) => p[i])) - 0.03);
    const maxM = [0, 1, 2].map((i) => Math.max(...todos.map((p) => p[i])) + 0.03);
    partes.push({ nome: `mao-${lado}`, material: 'pele', sdf: sdfMao, min: minM, max: maxM, passo: 0.0016, pesos: pesosMao });
  }

  // ---------------- cabeça e cabelo (rígidos, no espaço do osso "head") ----------------
  partes.push({ nome: 'cabeca', material: 'rosto', rigido: 'head', sdf: sdfCabeca, min: [-0.13, -0.005, -0.12], max: [0.13, 0.28, 0.15], passo: 0.0024 });
  partes.push({ nome: 'cabelo', material: 'cabeloBase', rigido: 'head', sdf: sdfCabelo, min: [-0.25, -0.2, -0.235], max: [0.25, 0.38, 0.19], passo: 0.0065 });

  return { partes, ossos };
}
