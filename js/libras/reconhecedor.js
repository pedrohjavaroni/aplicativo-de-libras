// Libras → texto: reconhecimento de sinais pela câmera.
//
// 1. MediaPipe detecta as mãos (21 pontos 3D cada) e a pose (ombros/punhos).
// 2. Cada quadro vira um vetor: forma das duas mãos + posição em relação aos
//    ombros (local de articulação do sinal).
// 3. Uma janela de ~1,2 s é reamostrada em 8 passos (captura o MOVIMENTO).
// 4. Um classificador k-NN compara com exemplos gravados pelo próprio usuário
//    (aba "Treinar"). Simples, roda no aparelho, sem enviar vídeo a servidores.

import { carregarVision, MEDIAPIPE } from '../config.js';

const JANELA_MS = 1200;
const PASSOS = 8;
const DIM_MAO = 63 + 2;
const DIM_QUADRO = DIM_MAO * 2 + 2;
const CHAVE = 'libras-modelo-v1';

export async function criarDetector() {
  const { vision, fileset } = await carregarVision();
  const [maos, pose] = await Promise.all([
    vision.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MEDIAPIPE.modelos.maos, delegate: MEDIAPIPE.delegate },
      runningMode: 'VIDEO',
      numHands: 2,
    }),
    vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MEDIAPIPE.modelos.pose.replace('pose_landmarker_full', 'pose_landmarker_lite'), delegate: MEDIAPIPE.delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
    }),
  ]);
  return {
    detectar(video, ts) {
      return { maos: maos.detectForVideo(video, ts), pose: pose.detectForVideo(video, ts) };
    },
  };
}

/** Converte uma detecção em vetor de características de um quadro. */
export function vetorQuadro(det, espelhado = true) {
  const v = new Float32Array(DIM_QUADRO);
  const p = det.pose?.landmarks?.[0];
  const oE = p?.[11], oD = p?.[12];
  const centro = oE && oD ? { x: (oE.x + oD.x) / 2, y: (oE.y + oD.y) / 2 } : { x: 0.5, y: 0.5 };
  const escala = oE && oD ? Math.max(Math.hypot(oE.x - oD.x, oE.y - oD.y), 0.05) : 0.3;

  (det.maos?.landmarks || []).forEach((img, k) => {
    const mundo = det.maos.worldLandmarks[k];
    // lado da pessoa: compara com os punhos da pose
    let slot;
    if (p) {
      const dE = Math.hypot(img[0].x - p[15].x, img[0].y - p[15].y);
      const dD = Math.hypot(img[0].x - p[16].x, img[0].y - p[16].y);
      slot = dE < dD ? 1 : 0;
    } else {
      slot = (img[0].x < 0.5) === espelhado ? 0 : 1;
    }
    const base = slot * DIM_MAO;
    if (v[DIM_MAO * 2 + slot]) return; // já preenchido
    for (let i = 0; i < 21; i++) {
      v[base + i * 3] = (mundo[i].x - mundo[0].x) * 10;
      v[base + i * 3 + 1] = (mundo[i].y - mundo[0].y) * 10;
      v[base + i * 3 + 2] = (mundo[i].z - mundo[0].z) * 10;
    }
    v[base + 63] = ((img[0].x - centro.x) / escala) * 0.8;
    v[base + 64] = ((img[0].y - centro.y) / escala) * 0.8;
    v[DIM_MAO * 2 + slot] = 1;
  });
  return v;
}

/** Reamostra uma lista de {t, v} em PASSOS instantes igualmente espaçados. */
export function vetorJanela(amostras) {
  const out = new Float32Array(DIM_QUADRO * PASSOS);
  if (!amostras.length) return out;
  const t0 = amostras[0].t, t1 = amostras[amostras.length - 1].t;
  let j = 0;
  for (let s = 0; s < PASSOS; s++) {
    const t = t0 + ((t1 - t0) * s) / (PASSOS - 1);
    while (j < amostras.length - 1 && amostras[j + 1].t <= t) j++;
    out.set(amostras[j].v, s * DIM_QUADRO);
  }
  return out;
}

function distancia(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s / PASSOS);
}

// ------------------------------------------------------------ modelo ----

export function carregarModelo() {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE) || '{}');
    const classes = {};
    for (const [nome, lista] of Object.entries(bruto.classes || {})) classes[nome] = lista.map((a) => Float32Array.from(a));
    return { classes };
  } catch {
    return { classes: {} };
  }
}

export function salvarModelo(modelo) {
  const classes = {};
  for (const [nome, lista] of Object.entries(modelo.classes)) classes[nome] = lista.map((v) => Array.from(v, (x) => Math.round(x * 100) / 100));
  const json = JSON.stringify({ versao: 1, classes });
  try { localStorage.setItem(CHAVE, json); } catch { /* cheio: o usuário pode exportar */ }
  return json;
}

export function importarModelo(json) {
  const bruto = JSON.parse(json);
  const classes = {};
  for (const [nome, lista] of Object.entries(bruto.classes || {})) classes[nome] = lista.map((a) => Float32Array.from(a));
  return { classes };
}

/** k-NN: devolve { nome, distancia, confianca } ou null */
export function classificar(modelo, vetor, k = 3) {
  const viz = [];
  for (const [nome, lista] of Object.entries(modelo.classes)) for (const ex of lista) viz.push({ nome, d: distancia(vetor, ex) });
  if (!viz.length) return null;
  viz.sort((a, b) => a.d - b.d);
  const top = viz.slice(0, k);
  const votos = {};
  for (const { nome, d } of top) votos[nome] = (votos[nome] || 0) + 1 / (d + 1e-3);
  const [nome] = Object.entries(votos).sort((a, b) => b[1] - a[1])[0];
  const melhor = top.find((x) => x.nome === nome).d;
  const outro = viz.find((x) => x.nome !== nome)?.d ?? melhor * 2;
  return { nome, distancia: melhor, confianca: Math.max(0, Math.min(1, 1 - melhor / outro + 0.5)) };
}

/** Limiar de aceitação: baseado na dispersão dos exemplos de treino. */
export function limiar(modelo) {
  const ds = [];
  for (const lista of Object.values(modelo.classes)) {
    for (let i = 0; i < lista.length; i++) {
      let min = Infinity;
      for (let j = 0; j < lista.length; j++) if (i !== j) min = Math.min(min, distancia(lista[i], lista[j]));
      if (isFinite(min)) ds.push(min);
    }
  }
  if (!ds.length) return 3;
  ds.sort((a, b) => a - b);
  return ds[Math.floor(ds.length * 0.9)] * 1.8;
}

/**
 * Laço contínuo de reconhecimento sobre um <video> da câmera.
 * Emite um sinal quando a mesma classe vence de forma estável e com distância
 * abaixo do limiar; depois aguarda um intervalo para não repetir.
 */
export function criarLaco({ detector, video, aoQuadro, aoSinal, obterModelo }) {
  let rodando = false;
  let amostras = [];
  let ultimo = null, estavel = 0, bloqueadoAte = 0, ultimoTs = -1;
  let gravacao = null;

  function passo() {
    if (!rodando) return;
    const ts = performance.now();
    if (video.readyState >= 2 && ts !== ultimoTs) {
      ultimoTs = ts;
      const det = detector.detectar(video, ts);
      const v = vetorQuadro(det);
      const temMao = v[DIM_MAO * 2] || v[DIM_MAO * 2 + 1];
      amostras.push({ t: ts, v });
      amostras = amostras.filter((a) => ts - a.t <= JANELA_MS);
      aoQuadro?.(det, !!temMao);

      if (gravacao) {
        gravacao.amostras.push({ t: ts, v });
        if (ts - gravacao.inicio >= JANELA_MS) {
          const g = gravacao; gravacao = null;
          g.resolver(g.amostras.some((a) => a.v[DIM_MAO * 2] || a.v[DIM_MAO * 2 + 1]) ? vetorJanela(g.amostras) : null);
        }
      } else if (temMao && ts > bloqueadoAte && amostras.length > 6) {
        const modelo = obterModelo();
        const r = classificar(modelo, vetorJanela(amostras));
        if (r && r.distancia < modelo._limiar) {
          estavel = r.nome === ultimo ? estavel + 1 : 1;
          ultimo = r.nome;
          if (estavel >= 4) {
            aoSinal?.(r);
            estavel = 0; ultimo = null; bloqueadoAte = ts + 900; amostras = [];
          }
        } else { estavel = 0; ultimo = null; }
      }
    }
    requestAnimationFrame(passo);
  }

  return {
    iniciar() { if (!rodando) { rodando = true; requestAnimationFrame(passo); } },
    parar() { rodando = false; },
    /** Grava um exemplo de JANELA_MS; resolve com o vetor (ou null sem mãos). */
    gravar() { return new Promise((resolver) => { gravacao = { inicio: performance.now(), amostras: [], resolver }; }); },
  };
}
