// Cachos da Teté: mechas em espiral (molas) grossas, no estilo de animação,
// nascendo da superfície do volume esculpido do cabelo. Raiz castanho-escura e
// pontas caramelo, como na foto de referência.

import * as THREE from '../vendor/three.module.min.js';
import { aleatorio } from './sdf.js';

const RAIZ = new THREE.Color(0x1d100a), MEIO = new THREE.Color(0x2e1b10), PONTA = new THREE.Color(0x5a3620);

/** Tubo de raio variável com cor por vértice (referencial por transporte paralelo). */
function tubo(pontos, raio, cor, lados = 7) {
  const n = pontos.length;
  const pos = new Float32Array(n * lados * 3), nor = new Float32Array(n * lados * 3), col = new Float32Array(n * lados * 3);
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), Tp = new THREE.Vector3().subVectors(pontos[1], pontos[0]).normalize();
  N.set(0, 1, 0).cross(Tp); if (N.lengthSq() < 1e-6) N.set(1, 0, 0); N.normalize();
  const c = new THREE.Color(), eixo = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    T.subVectors(pontos[Math.min(i + 1, n - 1)], pontos[Math.max(i - 1, 0)]).normalize();
    eixo.crossVectors(Tp, T);
    if (eixo.lengthSq() > 1e-12) N.applyAxisAngle(eixo.normalize(), Math.acos(THREE.MathUtils.clamp(Tp.dot(T), -1, 1)));
    Tp.copy(T);
    B.crossVectors(T, N).normalize();
    const t = i / (n - 1), r = raio(t);
    cor(t, c);
    for (let k = 0; k < lados; k++) {
      const a = (k / lados) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const nx = ca * N.x + sa * B.x, ny = ca * N.y + sa * B.y, nz = ca * N.z + sa * B.z;
      const o = (i * lados + k) * 3;
      pos[o] = pontos[i].x + nx * r; pos[o + 1] = pontos[i].y + ny * r; pos[o + 2] = pontos[i].z + nz * r;
      nor[o] = nx; nor[o + 1] = ny; nor[o + 2] = nz;
      col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
    }
  }
  const idx = [];
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < lados; k++) {
    const a = i * lados + k, b = i * lados + ((k + 1) % lados);
    idx.push(a, a + lados, b, b, a + lados, b + lados);
  }
  return { pos, nor, col, idx };
}

function juntar(partes) {
  let nv = 0, ni = 0;
  for (const p of partes) { nv += p.pos.length / 3; ni += p.idx.length; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
  const idx = new Uint32Array(ni);
  let o = 0, oi = 0;
  for (const p of partes) {
    pos.set(p.pos, o * 3); nor.set(p.nor, o * 3); col.set(p.col, o * 3);
    for (let i = 0; i < p.idx.length; i++) idx[oi + i] = p.idx[i] + o;
    o += p.pos.length / 3; oi += p.idx.length;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

/** Um cacho: mola que sai da raiz, acompanha a superfície e cai com a gravidade. */
function cacho(raiz, normal, rnd, { comprimento, raioMola, espessura, passoVolta, evitar }) {
  const lateral = new THREE.Vector3(normal.x, 0, normal.z);
  if (lateral.z > 0) lateral.z *= 0.2; // na frente, o cacho vai para o lado (rosto livre)
  if (lateral.lengthSq() < 0.04) lateral.set(rnd() - 0.5, 0, -0.4);
  lateral.normalize();
  const dir = normal.clone().multiplyScalar(0.6).add(lateral.clone().multiplyScalar(0.4)).normalize();
  const caminho = [];
  const p = raiz.clone();
  const passos = 18, passo = comprimento / passos;
  for (let i = 0; i <= passos; i++) {
    caminho.push(p.clone());
    const t = i / passos;
    const alvo = lateral.clone().multiplyScalar(0.9 - t * 0.5).add(normal.clone().multiplyScalar(0.25)).add(new THREE.Vector3(0, -(0.55 + t), 0)).normalize();
    dir.lerp(alvo, 0.18).normalize();
    p.addScaledVector(dir, passo);
  }
  const curva = new THREE.CatmullRomCurve3(caminho);
  const voltas = comprimento / passoVolta;
  const amostras = Math.max(16, Math.round(voltas * 10));
  const frames = curva.computeFrenetFrames(amostras, false);
  const fase = rnd() * Math.PI * 2;
  const pts = [];
  for (let i = 0; i <= amostras; i++) {
    const t = i / amostras;
    const c = curva.getPointAt(t);
    const r = raioMola * Math.min(1, t * 6) * (0.9 + 0.25 * t);
    const a = fase + t * voltas * Math.PI * 2;
    c.addScaledVector(frames.normals[i], Math.cos(a) * r).addScaledVector(frames.binormals[i], Math.sin(a) * r);
    pts.push(c);
  }
  const tom = rnd();
  if (evitar && pts.some(evitar)) return null;
  return tubo(pts, (t) => espessura * (1 - 0.6 * t * t) * Math.min(1, 0.6 + t * 4), (t, cor) => {
    if (t < 0.3) cor.copy(RAIZ).lerp(MEIO, t / 0.3);
    else cor.copy(MEIO).lerp(PONTA, ((t - 0.3) / 0.7) * (0.45 + 0.55 * tom));
  });
}

/** Cria os cachos sobre a malha-base do cabelo (no espaço do osso "head"). */
export function criarCachos(base, mat) {
  const g = base.geometry;
  const pos = g.attributes.position, nor = g.attributes.normal;
  const rnd = aleatorio(77);
  const partes = [];
  const usados = [];
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  // região do rosto (espaço da cabeça): nenhum cacho pode passar por ela
  // rosto livre e nada abaixo da linha dos ombros (não atravessa o corpo)
  const evitar = (q) => (q.z > 0.045 && Math.abs(q.x) < 0.085 && q.y > 0.03 && q.y < 0.19) || q.y < -0.06;
  for (let k = 0; k < 60000 && partes.length < 750; k++) {
    const i = Math.floor(rnd() * pos.count);
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i).normalize();
    if (n.y < -0.55) continue; // parte de baixo do volume (escondida)
    if (usados.some((u) => u.distanceToSquared(p) < 0.00015)) continue; // espaçamento ~1,2 cm
    const raiz = p.clone().addScaledVector(n, -0.008);
    const baixo = Math.max(0, 0.15 - p.y) * 1.5; // na parte de baixo: cachos um pouco mais longos
    const c = cacho(raiz, n.clone(), rnd, {
      comprimento: 0.03 + rnd() * 0.022 + baixo * 0.03,
      raioMola: 0.006 + rnd() * 0.0035,
      espessura: 0.0046 + rnd() * 0.0016,
      passoVolta: 0.012 + rnd() * 0.004,
      evitar,
    });
    if (!c) continue;
    usados.push(p.clone());
    partes.push(c);
  }
  const malha = new THREE.Mesh(juntar(partes), mat.cabelo);
  malha.castShadow = false; // sombras dos cachos finos ficariam manchadas no rosto
  malha.receiveShadow = true;
  return malha;
}
