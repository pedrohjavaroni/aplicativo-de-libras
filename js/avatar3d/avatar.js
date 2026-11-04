// Avatar 3D da Lia: cena Three.js + player de animação.
//
// Fluidez: toda animação define um ALVO de rotação por osso; a pose exibida
// persegue esse alvo com interpolação esférica (slerp) amortecida a cada
// quadro. Isso gera transições suaves entre letras, sinais e gestos
// (coarticulação), sem saltos, independentemente da taxa de quadros.

import * as THREE from '../vendor/three.module.min.js';
import { criarEsqueleto, vestirPersonagem } from './rig.js';
import { OSSOS_ANIMAVEIS } from './pose.js';
import { POSE_REPOUSO, clipDatilologia, gestoAcenar, gestoExplicar, gestoOuvir, gestoComemorar } from './solver.js';

const ROSTO_NEUTRO = { boca: 0, sorriso: 0.6, sobrancelha: 0, piscar: 0 };

function paraQuat(arr, destino = new THREE.Quaternion()) {
  return destino.set(arr[0], arr[1], arr[2], arr[3]);
}

/** Amostra um clipe no tempo t: devolve {q: {osso: Quaternion}, rosto} */
function amostrar(clip, t) {
  const qs = clip.quadros;
  let i = 0;
  while (i < qs.length - 1 && qs[i + 1].t <= t) i++;
  const a = qs[i];
  const b = qs[Math.min(i + 1, qs.length - 1)];
  let k = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
  k = THREE.MathUtils.clamp(k, 0, 1);
  k = k * k * (3 - 2 * k); // suaviza (ease in-out) entre quadros-chave
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

export function criarAvatar3D(container, { aoMarcar } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Lia, avatar 3D intérprete de Libras');

  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
  camera.position.set(0, 1.4, 2.05);
  camera.lookAt(0, 1.38, 0);

  cena.add(new THREE.HemisphereLight(0xfff4ec, 0xb89c8c, 1.6));
  const sol = new THREE.DirectionalLight(0xffffff, 1.6);
  sol.position.set(0.8, 2.4, 2.2);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  sol.shadow.camera.left = -0.6; sol.shadow.camera.right = 0.6;
  sol.shadow.camera.top = 2; sol.shadow.camera.bottom = 0.6;
  sol.shadow.bias = -0.0005;
  cena.add(sol);
  const preenchimento = new THREE.DirectionalLight(0xffe2d6, 0.5);
  preenchimento.position.set(-1.5, 1.2, 1);
  cena.add(preenchimento);

  const esqueleto = criarEsqueleto();
  const { ossos, raiz } = esqueleto;
  const rosto = vestirPersonagem(esqueleto);
  raiz.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  cena.add(raiz);

  // ---------------------------------------------------------- estado ----
  const exibido = {};
  for (const n of OSSOS_ANIMAVEIS) {
    exibido[n] = paraQuat(POSE_REPOUSO[n]);
    ossos[n].quaternion.copy(exibido[n]);
  }
  const rostoAtual = { ...ROSTO_NEUTRO };
  let fila = [];
  let atual = null; // { clip, t, resolve, marcasEmitidas }
  let falando = false;
  let velocidade = 1;
  let proximoPiscar = 2;
  let piscarT = -1;
  let olharAlvo = new THREE.Vector2();
  let olharAtual = new THREE.Vector2();
  let proximoOlhar = 1;

  const alvoQ = {};
  for (const n of OSSOS_ANIMAVEIS) alvoQ[n] = new THREE.Quaternion();
  const repousoQ = {};
  for (const n of OSSOS_ANIMAVEIS) repousoQ[n] = paraQuat(POSE_REPOUSO[n]);

  function iniciarProximo() {
    atual = null;
    const item = fila.shift();
    if (!item) return;
    atual = { ...item, t: 0, marcasEmitidas: 0 };
    aoMarcar?.({ tipo: 'inicio', clip: item.clip });
  }

  const relogio = new THREE.Clock();
  let tempo = 0;
  const qTmp = new THREE.Quaternion();
  const eTmp = new THREE.Euler();

  function quadro() {
    const dt = Math.min(relogio.getDelta(), 0.05);
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

    // 3) vida: respiração e micro-movimentos de cabeça (aditivos)
    const resp = Math.sin(tempo * 1.6);
    qTmp.setFromEuler(eTmp.set(resp * 0.012, 0, 0));
    ossos.chest.quaternion.multiply(qTmp);
    qTmp.setFromEuler(eTmp.set(Math.sin(tempo * 0.7) * 0.02, Math.sin(tempo * 0.45) * 0.03, Math.sin(tempo * 0.6) * 0.012));
    ossos.head.quaternion.multiply(qTmp);
    raiz.position.y = resp * 0.002;

    // 4) rosto
    if (falando) rostoAlvo.boca = 0.25 + 0.75 * Math.abs(Math.sin(tempo * 13) * Math.sin(tempo * 7.3));
    for (const ch in rostoAtual) {
      const alvo = rostoAlvo[ch] ?? ROSTO_NEUTRO[ch];
      rostoAtual[ch] += (alvo - rostoAtual[ch]) * (1 - Math.exp(-dt * 16));
    }
    if (tempo > proximoPiscar) { piscarT = 0; proximoPiscar = tempo + 2.2 + Math.random() * 3.5; }
    let fechar = rostoAtual.piscar;
    if (piscarT >= 0) {
      piscarT += dt;
      fechar = Math.max(fechar, Math.sin(Math.min(piscarT / 0.16, 1) * Math.PI));
      if (piscarT > 0.16) piscarT = -1;
    }
    if (tempo > proximoOlhar) {
      olharAlvo.set((Math.random() - 0.5) * 0.004, (Math.random() - 0.5) * 0.002);
      proximoOlhar = tempo + 1 + Math.random() * 2.5;
    }
    olharAtual.lerp(olharAlvo, 1 - Math.exp(-dt * 20));
    for (const o of rosto.olhos) {
      o.scale.y = Math.max(0.08, 1 - fechar);
      o.children[1].position.x = olharAtual.x; o.children[2].position.x = olharAtual.x;
      o.children[1].position.y = olharAtual.y; o.children[2].position.y = olharAtual.y;
    }
    rosto.abertura.scale.y = 0.001 + rostoAtual.boca * 0.011;
    rosto.abertura.scale.x = 0.012 + rostoAtual.boca * 0.002;
    rosto.sorriso.visible = rostoAtual.boca < 0.15;
    rosto.sorriso.scale.y = 0.6 + rostoAtual.sorriso * 0.6;
    for (const sb of rosto.sobrancelhas) {
      sb.mesh.position.y = sb.y0 + rostoAtual.sobrancelha * 0.008;
      sb.mesh.rotation.z = Math.PI / 2 + sb.s * (0.12 - rostoAtual.sobrancelha * 0.12);
    }

    renderer.render(cena, camera);
  }

  function redimensionar() {
    const w = container.clientWidth || 300;
    const h = container.clientHeight || 300;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Palco alto: corpo da cintura para cima, com o espaço de sinalização.
    // Palco baixo e largo (modo compacto): rosto, ombros e mãos.
    const compacto = camera.aspect > 1.25;
    const larguraNecessaria = compacto ? 0.7 : 1.0;
    const alturaNecessaria = compacto ? 0.62 : 0.98;
    const centroY = compacto ? 1.5 : 1.38;
    const fovV = THREE.MathUtils.degToRad(camera.fov);
    const distAltura = alturaNecessaria / 2 / Math.tan(fovV / 2);
    const distLargura = larguraNecessaria / 2 / (Math.tan(fovV / 2) * camera.aspect);
    camera.position.set(0, centroY + 0.02, Math.max(distAltura, distLargura));
    camera.lookAt(0, centroY, 0);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(redimensionar).observe(container);
  redimensionar();
  renderer.setAnimationLoop(quadro);

  function tocar(clip) {
    return new Promise((resolve) => fila.push({ clip, resolve }));
  }

  return {
    ossos,
    renderer,
    camera,
    /** Enfileira um clipe (sinal capturado, datilologia ou gesto). */
    tocar,
    /** Interrompe tudo e volta ao repouso. */
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
