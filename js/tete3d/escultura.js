// Escultura da Teté (estilo animação): cada parte do corpo é um campo de
// distância feito de formas unidas suavemente. Este módulo é usado tanto pelo
// gerador offline (ferramentas/gerar-tete.mjs), que transforma a escultura em
// malhas, quanto pelo app (o rosto usa a superfície da cabeça para assentar
// lábios e sobrancelhas).
//
// Inspirada na modelo de referência: rosto oval suave com bochechas discretas,
// nariz pequeno e fino, olhos expressivos, cabelo castanho cacheado muito volumoso,
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
  olho: (s) => [s * 0.036 * K, 0.123 * K, 0.074 * K], // centro do globo ocular
  raioOlho: 0.0172 * K,
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
  // nariz pequeno, fino e arrebitado
  d = smin(d, cone(px, py, pz, [0, 0.002, 0.086], [0, -0.016, 0.0955], 0.0046, 0.0072), 0.01);
  d = smin(d, esfera(px, py, pz, [0, -0.0205, 0.0965], 0.0086), 0.008);
  for (const s of [1, -1]) {
    d = smin(d, esfera(px, py, pz, [s * 0.0092, -0.0262, 0.0885], 0.0058), 0.006);
    d = ssub(d, esfera(px, py, pz, [s * 0.0054, -0.0305, 0.0955], 0.0023), 0.0025); // narinas
  }
  // região da boca levemente projetada (os lábios são malhas animadas por cima)
  d = smin(d, elipsoide(px, py, pz, [0, -0.052, 0.074], [0.026, 0.016, 0.018]), 0.02);
  // órbitas para os olhos
  for (const s of [1, -1]) d = ssub(d, esfera(px, py, pz, [s * 0.036, 0.008, 0.064], 0.0188), 0.009);
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
  for (let i = 0; i < 3000 && lista.length < 140; i++) {
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    const nx = r * Math.cos(th), ny = u, nz = r * Math.sin(th);
    if (ny < -0.2 && nz > 0.25) continue; // nada na frente do pescoço
    if (nz > 0.45 && ny < 0.55 && Math.abs(nx) < 0.7) continue; // rosto livre
    const desce = ny < 0 ? -ny : 0;
    const c = [
      // topo mais baixo e estreito; abre na altura do queixo e cai até os ombros
      H[0] + nx * (ny > 0 ? 0.094 - ny * 0.012 : 0.1 + desce * 0.035),
      H[1] + ny * (ny > 0 ? 0.098 : 0.25),
      H[2] + nz * 0.102 - desce * 0.015,
    ];
    lista.push([c, 0.034 + rnd() * 0.014 - desce * 0.008]);
  }
  return lista;
})();

export function sdfCabelo(x, y, z) {
  return sdfCabeloBase(x / K, y / K, z / K) * K;
}

/** Altura mínima do cabelo (coordenadas-base da cabeça): acima dos ombros na
 * frente e nas laterais; atrás das costas ele pode descer mais. */
export function limiteCabelo(z) {
  return -0.07 - 0.13 * suave(-0.06, -0.095, z);
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
  d = ssub(d, elipsoide(x, y, z, [0, -0.045, 0.03], [0.07, 0.05, 0.06]), 0.015); // frente do pescoço e do queixo livres
  d = smax(d, limiteCabelo(z) - y, 0.025); // até os ombros; atrás, cai sobre as costas
  d = ssub(d, elipsoide(x, y, z, [0, 0.215, 0.05], [0.0035, 0.025, 0.07]), 0.006); // risca no meio
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
  Thumb: [0.0116, 0.0108, 0.0098, 0.0088],
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

  // ---------------- tronco (base comum da blusa e do colo) ----------------
  const ombro = { left: pos(ossos.leftUpperArm), right: pos(ossos.rightUpperArm) };
  // forma do tronco; "folga" afasta a blusa da pele
  function tronco(x, y, z, folga) {
    let d = smin(elipsoide(x, y, z, [0, 1.275, 0], [0.134 + folga, 0.132 + folga, 0.09 + folga]),
      elipsoide(x, y, z, [0, 1.11, 0], [0.113 + folga, 0.12 + folga, 0.082 + folga]), 0.06);
    d = smin(d, smax(elipsoide(x, y, z, [0, 1.06, 0], [0.114 + folga, 0.2, 0.082 + folga]), y - 1.12, 0.02), 0.03);
    for (const s of [1, -1]) d = smin(d, elipsoide(x, y, z, [s * 0.05, 1.228, 0.055], [0.05 + folga, 0.046 + folga, 0.042 + folga]), 0.045); // busto suave
    d = smin(d, cone(x, y, z, [-0.155, 1.405, -0.006], [0.155, 1.405, -0.006], 0.045 + folga, 0.045 + folga), 0.075); // ombros
    return d;
  }

  // ---------------- blusa: decote em V, franzida nos ombros, solta na cintura ----------------
  const yV = 1.335; // fundo do decote
  function sdfBlusa(x, y, z) {
    let d = tronco(x, y, z, 0.006);
    d = smin(d, elipsoide(x, y, z, [0, 1.072, 0.004], [0.126, 0.038, 0.092]), 0.03); // blusa "bufante" sobre a saia
    // franzido abaixo da pala dos ombros (pregas suaves)
    d += 0.0011 * Math.sin(x * 230) * suave(1.27, 1.37, y) * (1 - suave(1.41, 1.45, y));
    // decote em V na frente + abertura arredondada do pescoço
    const k = 2.0, n = Math.hypot(1, k);
    const dentroV = Math.max(-(y - k * x - yV) / n, -(y + k * x - yV) / n, 0.035 - z);
    d = smax(d, -dentroV, 0.006);
    d = ssub(d, cone(x, y, z, [0, 1.425, -0.006], [0, 1.6, 0.0], 0.052, 0.052), 0.006);
    d = smax(d, 0.995 - y, 0.008); // barra por dentro da saia
    return d;
  }
  const corrTronco = [
    { osso: 'hips', a: [0, 0.85, 0], b: [0, 1.05, 0], r: 0 },
    { osso: 'spine', a: [0, 1.05, 0], b: [0, 1.23, 0], r: 0 },
    { osso: 'chest', a: [0, 1.23, 0], b: [0, 1.45, 0], r: 0 },
    { osso: 'neck', a: [0, 1.45, 0], b: [0, 1.53, 0], r: 0 },
  ];
  function pesosTronco(x, y, z) {
    const { pesos } = pesosCorrente(0, y, 0, corrTronco, 0.05);
    // topo do ombro acompanha um pouco o braço (a manga é uma malha à parte)
    const lado = x > 0 ? 'left' : 'right';
    const wBraco = 0.7 * suave(0.13, 0.17, Math.abs(x)) * suave(1.33, 1.39, y);
    if (wBraco > 0) {
      for (const kk in pesos) pesos[kk] *= 1 - wBraco;
      pesos[`${lado}UpperArm`] = wBraco;
    }
    return pesos;
  }
  partes.push({ nome: 'blusa', material: 'blusa', sdf: sdfBlusa, min: [-0.23, 0.98, -0.13], max: [0.23, 1.5, 0.14], passo: 0.0045, pesos: pesosTronco });

  // ---------------- saia preta longa de cintura alta ----------------
  function sdfSaia(x, y, z) {
    let d = smin(elipsoide(x, y, z, [0, 0.92, 0], [0.15, 0.16, 0.103]), elipsoide(x, y, z, [0, 1.02, 0], [0.126, 0.06, 0.087]), 0.05);
    d = smin(d, smax(elipsoide(x, y, z, [0, 0.7, 0.0], [0.142, 0.4, 0.1]), y - 0.9, 0.05), 0.05); // reta até os tornozelos
    d = smin(d, toro(x, y, z, [0, 1.032, 0], 0.126, 0.0095, 0.69), 0.004); // cós de elástico
    d = smax(d, y - 1.048, 0.006);
    d = smax(d, 0.52 - y, 0.004);
    return d;
  }
  partes.push({ nome: 'saia', material: 'saia', sdf: sdfSaia, min: [-0.18, 0.5, -0.13], max: [0.18, 1.06, 0.13], passo: 0.006, pesos: () => ({ hips: 1 }) });

  // ---------------- pescoço e colo (pele que aparece no decote) ----------------
  const baseCabeca = pos(ossos.head);
  const sdfPescoco = (x, y, z) => {
    let d = cone(x, y, z, [0, 1.40, -0.004], [0, baseCabeca[1] + 0.06, 0.008], 0.041, 0.038);
    d = smin(d, smax(smax(tronco(x, y, z, 0), 1.29 - y, 0.02), Math.abs(x) - 0.085, 0.02), 0.03); // colo (só onde o decote mostra)
    for (const s of [1, -1]) d = smin(d, cone(x, y, z, [s * 0.012, 1.428, 0.045], [s * 0.07, 1.438, 0.03], 0.004, 0.003), 0.008); // clavículas suaves
    return d;
  };
  const corrPescoco = [
    { osso: 'chest', a: [0, 1.25, 0], b: [0, 1.45, 0], r: 0 },
    { osso: 'neck', a: [0, 1.45, 0], b: [0, 1.53, 0], r: 0 },
    { osso: 'head', a: [0, 1.53, 0], b: [0, 1.7, 0], r: 0 },
  ];
  partes.push({ nome: 'pescoco', material: 'pele', sdf: sdfPescoco, min: [-0.2, 1.28, -0.11], max: [0.2, 1.62, 0.12], passo: 0.0035, pesos: (x, y) => pesosCorrente(0, y, 0, corrPescoco, 0.035).pesos });

  // ---------------- mangas longas bufantes e mãos ----------------
  for (const lado of ['left', 'right']) {
    const s = lado === 'left' ? 1 : -1;
    const S = pos(ossos[`${lado}UpperArm`]), E = pos(ossos[`${lado}LowerArm`]), W = pos(ossos[`${lado}Hand`]);
    const dir = W.map((c, i) => c - E[i]); const nd = Math.hypot(...dir); dir.forEach((c, i) => { dir[i] = c / nd; });
    const ponto = (base, t) => base.map((c, i) => c + dir[i] * t);
    const inicioPunho = ponto(W, -0.045), fimPunho = ponto(W, 0.008);
    const balao = E.map((c, i) => c + (inicioPunho[i] - c) * 0.6);
    function sdfManga(x, y, z) {
      let d = smin(esfera(x, y, z, S.map((c, i) => c + [0, 0.004, 0][i]), 0.05), cone(x, y, z, S, E, 0.049, 0.046), 0.02);
      d = smin(d, cone(x, y, z, E, inicioPunho, 0.046, 0.045), 0.03);
      d = smin(d, esfera(x, y, z, balao, 0.049), 0.05); // volume "balão" do antebraço
      d = smin(d, cone(x, y, z, inicioPunho, fimPunho, 0.031, 0.031), 0.014); // punho de elástico (liso, por cima do pulso)
      // pregas suaves só no corpo da manga (o punho fica liso, sem borda ondulada)
      const ate = Math.hypot(x - W[0], y - W[1], z - W[2]);
      d += 0.0012 * Math.sin((x * 0.6 + z) * 260 + y * 40) * suave(0.0, 0.02, Math.hypot(x - E[0], y - E[1], z - E[2])) * suave(0.06, 0.09, ate);
      return d;
    }
    const corrManga = [
      { osso: `${lado}UpperArm`, a: S, b: E, r: 0 },
      { osso: `${lado}LowerArm`, a: E, b: ponto(W, 0.02), r: 0 },
    ];
    const lim = [S, E, W, fimPunho];
    const min = [0, 1, 2].map((i) => Math.min(...lim.map((p) => p[i])) - 0.07);
    const max = [0, 1, 2].map((i) => Math.max(...lim.map((p) => p[i])) + 0.07);
    partes.push({ nome: `manga-${lado}`, material: 'blusa', sdf: sdfManga, min, max, passo: 0.0042, pesos: (x, y, z) => pesosCorrente(x, y, z, corrManga, 0.05).pesos });

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
      d = smin(d, cone(lx, ly, lz, [0, 0.014, 0], [0, -0.012, 0], 0.023, 0.026), 0.015); // pulso (curto: o punho da manga cobre a junção)
      return d;
    }
    function sdfMao(x, y, z) {
      // cada dedo se funde só com a palma — nunca com o dedo vizinho
      // (senão a pele entre eles estica como um fio quando os dedos se separam)
      const palma = sdfPalma(x, y, z);
      let d = palma;
      for (const dd of DEDOS) {
        const p = dedos[dd], r = RAIOS_DEDOS[dd];
        let f = cone(x, y, z, p[0], p[1], r[0], r[1]);
        f = smin(f, cone(x, y, z, p[1], p[2], r[1], r[2]), 0.009); // juntas lisas (sem "gomos")
        f = smin(f, cone(x, y, z, p[2], p[3], r[2], r[3]), 0.009);
        d = Math.min(d, smin(palma, f, dd === 'Thumb' ? 0.012 : 0.008));
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
      // pesos da palma: mão, com transição para o antebraço no punho
      const ly = aplicar(inv, x, y, z)[1];
      // acima do pulso a pele segue o antebraço; transição suave só na articulação
      const wAnte = suave(-0.012, 0.016, ly);
      const palma = wAnte > 0 ? { [`${lado}Hand`]: 1 - wAnte, [`${lado}LowerArm`]: wAnte } : { [`${lado}Hand`]: 1 };
      // dedo mais próximo e o segundo mais próximo
      let d1 = Infinity, d2 = Infinity, p1 = null;
      for (const d of DEDOS) {
        const r = pesosCorrente(x, y, z, correntes[d], 0.008);
        if (r.dist < d1) { d2 = d1; d1 = r.dist; p1 = r.pesos; } else if (r.dist < d2) d2 = r.dist;
      }
      // transição gradual palma ↔ dedo, e no vão entre dois dedos o peso vai para a palma
      // (assim nenhuma aresta liga 100% um osso a 100% outro — nada estica como fio)
      const perto = 1 - suave(0.006, 0.026, dPalma); // a regra do vão só vale junto da palma
      const vao = 1 - (1 - suave(0.0, 0.006, d2 - d1)) * perto;
      const wDedo = suave(-0.005, 0.007, dPalma - d1) * vao;
      if (wDedo <= 0.001) return palma;
      const pesos = {};
      for (const k in palma) pesos[k] = palma[k] * (1 - wDedo);
      for (const k in p1) pesos[k] = (pesos[k] || 0) + p1[k] * wDedo;
      return pesos;
    }
    const todos = [W, ...Object.values(dedos).flat()];
    // margem larga: o punho precisa fechar por inteiro dentro da caixa (sem borda aberta)
    const minM = [0, 1, 2].map((i) => Math.min(...todos.map((p) => p[i])) - 0.065);
    const maxM = [0, 1, 2].map((i) => Math.max(...todos.map((p) => p[i])) + 0.065);
    partes.push({ nome: `mao-${lado}`, material: 'pele', sdf: sdfMao, min: minM, max: maxM, passo: 0.0016, pesos: pesosMao });
  }

  // ---------------- cabeça e cabelo (rígidos, no espaço do osso "head") ----------------
  partes.push({ nome: 'cabeca', material: 'rosto', rigido: 'head', sdf: sdfCabeca, min: [-0.13, -0.005, -0.12], max: [0.13, 0.28, 0.15], passo: 0.0024 });
  partes.push({ nome: 'cabelo', material: 'cabeloBase', rigido: 'head', sdf: sdfCabelo, min: [-0.25, -0.2, -0.235], max: [0.25, 0.38, 0.19], passo: 0.0065 });

  return { partes, ossos };
}
