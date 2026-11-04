// Ferramentas para posicionar o esqueleto: apontar ossos, IK de dois ossos
// (braço), orientação da mão por base vetorial e configurações de mão.
// Usado tanto pelas animações procedurais (alfabeto, gestos) quanto pela
// captura de movimento a partir dos vídeos da modelo (MediaPipe).

import * as THREE from '../vendor/three.module.min.js';
import { DEDOS, FALANGES, MEDIDAS } from './rig.js';

const BAIXO = new THREE.Vector3(0, -1, 0);
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();

export const LADOS = { left: 1, right: -1 };

/** Faz o osso (que repousa apontando -Y) apontar para uma direção do mundo. */
export function apontar(osso, dirMundo) {
  osso.parent.updateWorldMatrix(true, false);
  osso.parent.getWorldQuaternion(_q).invert();
  _v.copy(dirMundo).normalize().applyQuaternion(_q);
  osso.quaternion.setFromUnitVectors(BAIXO, _v);
  osso.updateMatrixWorld(true);
}

/** Define a rotação de MUNDO de um osso (convertendo para local). */
export function rotacaoMundo(osso, qMundo) {
  osso.parent.updateWorldMatrix(true, false);
  osso.parent.getWorldQuaternion(_q).invert();
  osso.quaternion.copy(_q).multiply(qMundo);
  osso.updateMatrixWorld(true);
}

/** Quaternion da mão a partir da direção dos dedos e da normal da palma. */
export function quatMao(dirDedos, normalPalma) {
  const y = dirDedos.clone().normalize().negate();
  const z = normalPalma.clone().sub(y.clone().multiplyScalar(normalPalma.dot(y))).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  _m.makeBasis(x, y, z);
  return new THREE.Quaternion().setFromRotationMatrix(_m);
}

/** Quaternion da mão a partir de landmarks (punho, base do indicador, base do mínimo, base do médio). */
export function quatMaoLandmarks(lado, punho, baseIndicador, baseMinimo, baseMedio) {
  const s = LADOS[lado];
  const y = punho.clone().sub(baseMedio).normalize(); // -dedos
  const x = baseIndicador.clone().sub(baseMinimo).multiplyScalar(s);
  x.sub(y.clone().multiplyScalar(x.dot(y))).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  _m.makeBasis(x, y, z);
  return new THREE.Quaternion().setFromRotationMatrix(_m);
}

/** IK analítico de dois ossos: leva o punho até `alvo` (mundo). */
export function ikBraco(ossos, lado, alvo, polo) {
  const s = LADOS[lado];
  const sup = ossos[`${lado}UpperArm`];
  const inf = ossos[`${lado}LowerArm`];
  sup.parent.updateWorldMatrix(true, false);
  const ombro = sup.getWorldPosition(new THREE.Vector3());
  const a = MEDIDAS.braco, b = MEDIDAS.antebraco;
  const delta = alvo.clone().sub(ombro);
  const d = THREE.MathUtils.clamp(delta.length(), Math.abs(a - b) + 1e-3, a + b - 1e-3);
  const dir = delta.normalize();
  const p = (polo || new THREE.Vector3(s * 0.35, -1, -0.35)).clone().normalize();
  const perp = p.sub(dir.clone().multiplyScalar(p.dot(dir))).normalize();
  const cosA = (a * a + d * d - b * b) / (2 * a * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const cotovelo = ombro.clone()
    .add(dir.clone().multiplyScalar(a * cosA))
    .add(perp.multiplyScalar(a * sinA));
  const pulso = ombro.clone().add(dir.multiplyScalar(d));
  apontar(sup, cotovelo.clone().sub(ombro));
  apontar(inf, pulso.sub(cotovelo));
}

// ------------------------------------------------- configurações de mão ----
// Cada dedo: [flexão MCP, flexão PIP, flexão DIP] em graus (positivo = fecha
// em direção à palma) e abertura lateral (graus). O polegar usa direções em
// espaço local da mão para cada falange (x positivo = lado do polegar,
// -y = direção dos dedos, +z = para fora da palma).

const P = {
  aberto: [[0.85, -0.5, 0.25], [0.65, -0.75, 0.15], [0.5, -0.86, 0.05]],
  lado: [[0.35, -0.75, 0.55], [0.12, -0.95, 0.3], [0.02, -1, 0.12]],
  cruzado: [[0.25, -0.6, 0.75], [-0.55, -0.45, 0.7], [-0.9, -0.25, 0.35]],
  sobre: [[0.25, -0.5, 0.85], [-0.45, -0.4, 0.8], [-0.85, -0.2, 0.5]],
  oposto: [[0.3, -0.65, 0.7], [-0.05, -0.8, 0.6], [-0.25, -0.75, 0.6]],
  curvo: [[0.55, -0.55, 0.65], [0.35, -0.75, 0.55], [0.15, -0.85, 0.5]],
  meio: [[0.25, -0.6, 0.75], [-0.2, -0.75, 0.6], [-0.35, -0.85, 0.35]],
  relaxado: [[0.6, -0.65, 0.45], [0.4, -0.85, 0.3], [0.3, -0.92, 0.2]],
};

const EST = [0, 0, 0];
const FECH = [88, 100, 65];
const CURV = [35, 55, 35];

function forma(polegar, i, m, a, n, abertura = [0, 0, 0, 0]) {
  return { polegar, dedos: { Index: i, Middle: m, Ring: a, Little: n }, abertura };
}

export const MAOS = {
  relaxada: forma('relaxado', [12, 18, 10], [15, 20, 12], [18, 24, 14], [22, 28, 16], [3, 0, -3, -6]),
  aberta: forma('aberto', EST, EST, EST, EST, [10, 2, -6, -14]),
  plana: forma('cruzado', EST, EST, EST, EST),
  punho: forma('sobre', FECH, FECH, FECH, FECH),
  indicador: forma('meio', EST, FECH, FECH, FECH),
  // alfabeto manual (aproximação procedural — validar com a intérprete)
  A: forma('lado', FECH, FECH, FECH, FECH),
  B: forma('cruzado', EST, EST, EST, EST),
  C: forma('curvo', CURV, CURV, CURV, CURV),
  D: forma('oposto', EST, [55, 70, 40], [58, 72, 40], [60, 72, 40]),
  E: forma('cruzado', [20, 95, 65], [20, 95, 65], [20, 95, 65], [20, 95, 65]),
  F: forma('oposto', [45, 75, 45], FECH, FECH, FECH),
  G: forma('lado', EST, FECH, FECH, FECH),
  H: forma('sobre', EST, EST, FECH, FECH),
  I: forma('sobre', FECH, FECH, FECH, EST),
  K: forma('meio', EST, [30, 0, 0], FECH, FECH, [6, -10, 0, 0]),
  L: forma('aberto', EST, FECH, FECH, FECH),
  M: forma('sobre', EST, EST, EST, FECH, [-2, 0, 2, 0]),
  N: forma('sobre', EST, EST, FECH, FECH),
  O: forma('oposto', [40, 62, 40], [42, 64, 40], [44, 64, 40], [46, 64, 40]),
  P: forma('meio', EST, [30, 0, 0], FECH, FECH, [6, -10, 0, 0]),
  Q: forma('lado', EST, FECH, FECH, FECH),
  R: forma('sobre', EST, EST, FECH, FECH, [-7, 9, 0, 0]),
  S: forma('sobre', FECH, FECH, FECH, FECH),
  T: forma('oposto', [50, 70, 40], EST, EST, EST, [0, 4, -2, -8]),
  U: forma('sobre', EST, EST, FECH, FECH, [-2, 2, 0, 0]),
  V: forma('sobre', EST, EST, FECH, FECH, [10, -10, 0, 0]),
  W: forma('sobre', EST, EST, EST, FECH, [10, 0, -10, 0]),
  X: forma('sobre', [0, 85, 60], FECH, FECH, FECH),
  Y: forma('aberto', FECH, FECH, FECH, EST, [0, 0, 0, -18]),
  Z: forma('meio', EST, FECH, FECH, FECH),
};

const _e = new THREE.Euler();
const _a = new THREE.Vector3();

/** Aplica uma configuração de mão (MAOS[nome] ou objeto) ao esqueleto. */
export function aplicarMao(ossos, lado, config) {
  const cfg = typeof config === 'string' ? MAOS[config] : config;
  if (!cfg) return;
  const s = LADOS[lado];
  const rad = THREE.MathUtils.degToRad;
  ['Index', 'Middle', 'Ring', 'Little'].forEach((d, k) => {
    const flex = cfg.dedos[d];
    FALANGES.forEach((f, i) => {
      const o = ossos[`${lado}${d}${f}`];
      // flexão: gira em torno de X local (negativo leva a ponta para +Z, a palma)
      // abertura: só na falange proximal, em torno de Z (positivo = para o polegar)
      _e.set(-rad(flex[i]), 0, i === 0 ? s * rad(cfg.abertura[k] || 0) : 0, 'ZXY');
      o.quaternion.setFromEuler(_e);
    });
  });
  // polegar: aponta cada falange para a direção definida no espaço da mão
  const mao = ossos[`${lado}Hand`];
  mao.updateMatrixWorld(true);
  const qMao = mao.getWorldQuaternion(new THREE.Quaternion());
  P[cfg.polegar].forEach(([x, y, z], i) => {
    _a.set(s * x, y, z).normalize().applyQuaternion(qMao);
    apontar(ossos[`${lado}Thumb${FALANGES[i]}`], _a);
  });
}

/** Lista de nomes de ossos animáveis do braço/mão de um lado. */
export function ossosDoLado(lado) {
  const lista = [`${lado}UpperArm`, `${lado}LowerArm`, `${lado}Hand`];
  for (const d of DEDOS) for (const f of FALANGES) lista.push(`${lado}${d}${f}`);
  return lista;
}

export const OSSOS_ANIMAVEIS = ['spine', 'chest', 'neck', 'head', ...ossosDoLado('left'), ...ossosDoLado('right')];

/** Copia as rotações locais atuais do esqueleto para um "quadro" serializável. */
export function capturarQuadro(ossos, nomes = OSSOS_ANIMAVEIS) {
  const q = {};
  for (const n of nomes) {
    const o = ossos[n].quaternion;
    q[n] = [+o.x.toFixed(4), +o.y.toFixed(4), +o.z.toFixed(4), +o.w.toFixed(4)];
  }
  return q;
}

export function zerar(ossos, nomes = OSSOS_ANIMAVEIS) {
  for (const n of nomes) ossos[n].quaternion.identity();
  ossos.hips.parent.updateMatrixWorld(true);
}

