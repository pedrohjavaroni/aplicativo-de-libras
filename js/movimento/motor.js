// Motor de movimento da Teté: esqueleto + player de animação.
//
// Fluidez: toda animação define um ALVO de rotação por osso; a pose exibida
// persegue esse alvo com interpolação esférica (slerp) amortecida a cada
// quadro. Isso gera transições suaves entre letras, sinais e gestos
// (coarticulação), sem saltos, independentemente da taxa de quadros.
//
// O motor não desenha nada: quem desenha é a ilustração (js/tete/), que lê
// as posições dos ossos e o estado do rosto a cada quadro.

import * as THREE from '../vendor/three.module.min.js';
import { criarEsqueleto } from './rig.js';
import { OSSOS_ANIMAVEIS } from './pose.js';
import { POSE_REPOUSO, clipDatilologia, gestoAcenar, gestoExplicar, gestoOuvir, gestoComemorar } from './solver.js';

export const ROSTO_NEUTRO = { boca: 0, sorriso: 0.7, sobrancelha: 0, piscar: 0 };

const paraQuat = (arr, destino = new THREE.Quaternion()) => destino.set(arr[0], arr[1], arr[2], arr[3]);

/** Amostra um clipe no tempo t: devolve {q: {osso: Quaternion}, rosto} */
function amostrar(clip, t) {
  const qs = clip.quadros;
  let i = 0;
  while (i < qs.length - 1 && qs[i + 1].t <= t) i++;
  const a = qs[i];
  const b = qs[Math.min(i + 1, qs.length - 1)];
  let k = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
  k = THREE.MathUtils.clamp(k, 0, 1);
  k = k * k * (3 - 2 * k); // ease in-out entre quadros-chave
  const q = {};
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  for (const nome in a.q) {
    paraQuat(a.q[nome], qa);
    if (b.q[nome]) paraQuat(b.q[nome], qb); else qb.copy(qa);
    q[nome] = qa.clone().slerp(qb, k);
  }
  const rosto = {};
  const ra = a.rosto || {}, rb = b.rosto || {};
  for (const ch of new Set([...Object.keys(ra), ...Object.keys(rb)])) {
    const va = ra[ch] ?? ROSTO_NEUTRO[ch];
    const vb = rb[ch] ?? ROSTO_NEUTRO[ch];
    rosto[ch] = va + (vb - va) * k;
  }
  return { q, rosto };
}

export function criarMotor({ aoMarcar } = {}) {
  const { ossos, raiz } = criarEsqueleto();
  const exibido = {}, alvoQ = {}, repousoQ = {};
  for (const n of OSSOS_ANIMAVEIS) {
    exibido[n] = paraQuat(POSE_REPOUSO[n]);
    alvoQ[n] = new THREE.Quaternion();
    repousoQ[n] = paraQuat(POSE_REPOUSO[n]);
    ossos[n].quaternion.copy(exibido[n]);
  }
  const rosto = { ...ROSTO_NEUTRO, olharX: 0, olharY: 0 };
  let fila = [];
  let atual = null;
  let falando = false;
  let velocidade = 1;
  let tempo = 0;
  let proximoPiscar = 2, piscarT = -1, proximoOlhar = 1;
  const olharAlvo = new THREE.Vector2(), olhar = new THREE.Vector2();
  const qTmp = new THREE.Quaternion(), eTmp = new THREE.Euler();
  const qTwist = new THREE.Quaternion(), qParcial = new THREE.Quaternion();

  function iniciarProximo() {
    atual = null;
    const item = fila.shift();
    if (!item) return;
    atual = { ...item, t: 0, marcasEmitidas: 0 };
    aoMarcar?.({ tipo: 'inicio', clip: item.clip });
  }

  /** Avança a animação dt segundos e atualiza o esqueleto e o rosto. */
  function atualizar(dt) {
    dt = Math.min(dt, 0.05);
    tempo += dt;

    // 1) alvo: repouso, sobrescrito pelo clipe em execução
    for (const n of OSSOS_ANIMAVEIS) alvoQ[n].copy(repousoQ[n]);
    let rostoAlvo = { ...ROSTO_NEUTRO };
    if (!atual && fila.length) iniciarProximo();
    if (atual) {
      atual.t += dt * velocidade;
      const { clip } = atual;
      const s = amostrar(clip, atual.t);
      for (const n in s.q) if (alvoQ[n]) alvoQ[n].copy(s.q[n]);
      rostoAlvo = { ...rostoAlvo, ...s.rosto };
      const marcas = clip.marcas || [];
      while (atual.marcasEmitidas < marcas.length && marcas[atual.marcasEmitidas].t <= atual.t) {
        aoMarcar?.({ tipo: 'marca', clip, marca: marcas[atual.marcasEmitidas] });
        atual.marcasEmitidas++;
      }
      const fim = clip.quadros[clip.quadros.length - 1].t + (clip.segurar ?? 0.15);
      if (atual.t >= fim) {
        const terminado = atual;
        aoMarcar?.({ tipo: 'fim', clip });
        iniciarProximo();
        terminado.resolve?.();
        if (!atual) aoMarcar?.({ tipo: 'ocioso' });
      }
    }

    // 2) persegue o alvo com slerp amortecido (dedos um pouco mais rápidos)
    for (const n of OSSOS_ANIMAVEIS) {
      const rapidez = /Proximal|Intermediate|Distal/.test(n) ? 22 : 14;
      exibido[n].slerp(alvoQ[n], 1 - Math.exp(-dt * rapidez));
      ossos[n].quaternion.copy(exibido[n]);
    }

    // 2b) torção do antebraço: parte da rotação da mão em torno do eixo do
    // antebraço passa para o antebraço (evita o punho "torcido" na malha).
    // A orientação final da mão no espaço não muda.
    for (const lado of ['left', 'right']) {
      const mao = ossos[`${lado}Hand`].quaternion;
      qTwist.set(0, mao.y, 0, mao.w);
      if (qTwist.lengthSq() < 1e-8) continue;
      qTwist.normalize();
      qParcial.identity().slerp(qTwist, 0.65);
      ossos[`${lado}LowerArm`].quaternion.multiply(qParcial);
      mao.premultiply(qParcial.invert());
    }

    // 3) vida: respiração e micromovimentos de cabeça (aditivos)
    const resp = Math.sin(tempo * 1.6);
    ossos.chest.quaternion.multiply(qTmp.setFromEuler(eTmp.set(resp * 0.012, 0, 0)));
    ossos.head.quaternion.multiply(qTmp.setFromEuler(eTmp.set(
      Math.sin(tempo * 0.7) * 0.02, Math.sin(tempo * 0.45) * 0.03, Math.sin(tempo * 0.6) * 0.015)));
    raiz.position.y = resp * 0.0025;
    raiz.updateMatrixWorld(true);

    // 4) rosto: fala, expressões, piscadas e olhar
    if (falando) rostoAlvo.boca = 0.2 + 0.8 * Math.abs(Math.sin(tempo * 13) * Math.sin(tempo * 7.3));
    for (const ch in ROSTO_NEUTRO) {
      const alvo = rostoAlvo[ch] ?? ROSTO_NEUTRO[ch];
      rosto[ch] += (alvo - rosto[ch]) * (1 - Math.exp(-dt * 16));
    }
    if (tempo > proximoPiscar) { piscarT = 0; proximoPiscar = tempo + 2.2 + Math.random() * 3.5; }
    rosto.fechar = rosto.piscar;
    if (piscarT >= 0) {
      piscarT += dt;
      rosto.fechar = Math.max(rosto.fechar, Math.sin(Math.min(piscarT / 0.18, 1) * Math.PI));
      if (piscarT > 0.18) piscarT = -1;
    }
    if (tempo > proximoOlhar) {
      olharAlvo.set((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.5);
      if (Math.random() < 0.55) olharAlvo.set(0, 0); // volta a olhar para quem está vendo
      proximoOlhar = tempo + 0.8 + Math.random() * 2.5;
    }
    olhar.lerp(olharAlvo, 1 - Math.exp(-dt * 25));
    rosto.olharX = olhar.x;
    rosto.olharY = olhar.y;
    return { ossos, rosto, tempo };
  }

  function tocar(clip) {
    return new Promise((resolve) => fila.push({ clip, resolve }));
  }

  return {
    ossos,
    rosto,
    atualizar,
    tocar,
    parar() {
      const pendentes = fila; fila = [];
      pendentes.forEach((p) => p.resolve?.());
      atual?.resolve?.(); atual = null;
      aoMarcar?.({ tipo: 'ocioso' });
    },
    datilologia(palavra, opcoes) { return tocar(clipDatilologia(palavra, opcoes)); },
    gesto(nome) {
      const g = { acenar: gestoAcenar, explicar: gestoExplicar, ouvir: gestoOuvir, comemorar: gestoComemorar }[nome];
      return g ? tocar(g()) : Promise.resolve();
    },
    falando(sim) { falando = !!sim; },
    velocidade(v) { velocidade = v; },
    get ocupado() { return !!atual || fila.length > 0; },
  };
}
