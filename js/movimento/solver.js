// "Solver": um esqueleto invisível onde montamos poses (IK + configuração de
// mão) para gerar quadros-chave. As animações resultantes são listas de
// quatérnios locais por osso — o mesmo formato produzido pela captura de
// movimento dos vídeos da modelo.

import * as THREE from '../vendor/three.module.min.js';
import { criarEsqueleto } from './rig.js';
import { ikBraco, quatMao, rotacaoMundo, aplicarMao, capturarQuadro, zerar, LADOS } from './pose.js';

const { ossos } = criarEsqueleto();
const V = (a) => new THREE.Vector3(...a);
const rad = THREE.MathUtils.degToRad;

export const REPOUSO = {
  right: { alvo: [-0.21, 0.99, 0.05], dedos: [0.05, -1, 0.15], palma: [1, 0, 0.1], mao: 'relaxada' },
  left: { alvo: [0.21, 0.99, 0.05], dedos: [-0.05, -1, 0.15], palma: [-1, 0, 0.1], mao: 'relaxada' },
};

function poseBraco(lado, spec) {
  const p = spec === 'repouso' || !spec ? REPOUSO[lado] : spec;
  ikBraco(ossos, lado, V(p.alvo), p.polo && V(p.polo));
  rotacaoMundo(ossos[`${lado}Hand`], quatMao(V(p.dedos), V(p.palma)));
  aplicarMao(ossos, lado, p.mao || 'relaxada');
}

/**
 * Resolve uma pose descrita em alto nível e devolve o quadro (quatérnios locais).
 * spec = { right: {...}|'repouso', left: {...}|'repouso', cabeca: [x,y,z] graus, tronco: [x,y,z] graus }
 */
export function resolverPose(spec = {}) {
  zerar(ossos);
  if (spec.tronco) ossos.chest.quaternion.setFromEuler(new THREE.Euler(...spec.tronco.map(rad)));
  if (spec.cabeca) ossos.head.quaternion.setFromEuler(new THREE.Euler(...spec.cabeca.map(rad)));
  ossos.hips.parent.updateMatrixWorld(true);
  poseBraco('right', spec.right);
  poseBraco('left', spec.left);
  return capturarQuadro(ossos);
}

export const POSE_REPOUSO = resolverPose({});

// ----------------------------------------------------------- gestos ------
// Gestos de interação da personagem (não são sinais de Libras).

const DATILO = { alvo: [-0.17, 1.39, 0.23], dedos: [0, 1, 0], palma: [0, 0, 1], polo: [-0.5, -1, -0.1] };

function clip(nome, quadros, extra = {}) {
  return { nome, quadros, ...extra };
}

export function gestoAcenar() {
  const base = { alvo: [-0.27, 1.6, 0.12], palma: [0.05, 0, 1], mao: 'aberta', polo: [-1, -0.6, -0.3] };
  const q = [];
  for (let i = 0; i < 6; i++) {
    const ang = i % 2 ? 0.35 : -0.25;
    q.push({ t: 0.35 + i * 0.28, q: resolverPose({ right: { ...base, dedos: [Math.sin(ang), Math.cos(ang), 0] }, cabeca: [0, 0, 4] }), rosto: { sorriso: 1 } });
  }
  return clip('acenar', q);
}

export function gestoExplicar() {
  // as duas mãos abertas, palmas para cima, apresentando (como na foto)
  const pose = resolverPose({
    right: { alvo: [-0.06, 1.2, 0.3], dedos: [0.85, 0.2, 0.45], palma: [-0.15, 1, 0.25], mao: 'aberta', polo: [-1, -0.4, -0.4] },
    left: { alvo: [0.36, 1.21, 0.18], dedos: [0.6, 0.45, 0.4], palma: [-0.3, 1, 0.35], mao: 'aberta', polo: [1, -0.6, -0.3] },
    cabeca: [0, 7, -3],
  });
  return clip('explicar', [{ t: 0.4, q: pose, rosto: { sorriso: 1 } }, { t: 2.2, q: pose, rosto: { sorriso: 1 } }]);
}

export function gestoOuvir() {
  const pose = resolverPose({
    left: { alvo: [0.2, 1.56, 0.1], dedos: [-0.1, 1, 0.2], palma: [-1, 0, 0.4], mao: 'C', polo: [1, -0.4, -0.3] },
    cabeca: [0, -8, -6],
  });
  return clip('ouvir', [{ t: 0.4, q: pose }, { t: 1.5, q: pose }]);
}

export function gestoComemorar() {
  const a = resolverPose({
    right: { alvo: [-0.33, 1.75, 0.05], dedos: [-0.2, 1, 0], palma: [0, 0, 1], mao: 'aberta', polo: [-1, 0, -0.5] },
    left: { alvo: [0.33, 1.75, 0.05], dedos: [0.2, 1, 0], palma: [0, 0, 1], mao: 'aberta', polo: [1, 0, -0.5] },
  });
  const b = resolverPose({
    right: { alvo: [-0.36, 1.7, 0.08], dedos: [-0.4, 1, 0], palma: [0, 0, 1], mao: 'aberta', polo: [-1, 0, -0.5] },
    left: { alvo: [0.36, 1.7, 0.08], dedos: [0.4, 1, 0], palma: [0, 0, 1], mao: 'aberta', polo: [1, 0, -0.5] },
  });
  return clip('comemorar', [a, b, a, b].map((q, i) => ({ t: 0.35 + i * 0.25, q, rosto: { sorriso: 1, sobrancelha: 0.6 } })));
}

// ------------------------------------------------- datilologia (alfabeto) --

// orientações da mão dominante (direita) no espaço de sinalização
const ORIENT = {
  frente: { dedos: [0, 1, 0], palma: [0, 0, 1] },
  lado: { dedos: [0.05, 1, 0.1], palma: [1, 0, 0.35] }, // palma voltada para o centro
  horizontal: { dedos: [1, 0.15, 0.1], palma: [0, 0, 1] },
  baixo: { dedos: [0.1, -1, 0.35], palma: [0, 0.1, 1] },
};

// letra → [configuração de mão, orientação, movimento?]
// ⚠ Aproximação procedural. Deve ser validada pela intérprete e, idealmente,
// substituída por captura de movimento (ids "letra-a", "letra-b", ...).
export const ALFABETO = {
  A: ['A', 'frente'], B: ['B', 'frente'], C: ['C', 'lado'], D: ['D', 'frente'],
  E: ['E', 'frente'], F: ['F', 'lado'], G: ['G', 'lado'], H: ['H', 'horizontal', 'h'],
  I: ['I', 'frente'], J: ['I', 'frente', 'j'], K: ['K', 'frente', 'k'], L: ['L', 'frente'],
  M: ['M', 'baixo'], N: ['N', 'baixo'], O: ['O', 'lado'], P: ['P', 'baixo'],
  Q: ['Q', 'baixo'], R: ['R', 'frente'], S: ['S', 'frente'], T: ['T', 'frente'],
  U: ['U', 'frente'], V: ['V', 'frente'], W: ['W', 'frente'], X: ['X', 'lado'],
  Y: ['Y', 'frente'], Z: ['Z', 'frente', 'z'], Ç: ['C', 'lado', 'ç'],
};

function poseLetra(letra, deslocar = [0, 0, 0], girar = 0) {
  const [mao, orient] = ALFABETO[letra];
  const o = ORIENT[orient];
  const alvo = DATILO.alvo.map((v, i) => v + deslocar[i]);
  const dedos = V(o.dedos).applyAxisAngle(V([0, 0, 1]), girar).toArray();
  return resolverPose({ right: { ...DATILO, alvo, dedos, palma: o.palma, mao } });
}

/** Gera um clipe de datilologia para uma palavra. */
export function clipDatilologia(palavra, { porLetra = 0.48 } = {}) {
  const semAcento = palavra.toUpperCase().normalize('NFD').replace(/[\u0300-\u0326\u0328-\u036f]/g, '').normalize('NFC');
  const letras = [...semAcento].filter((c) => ALFABETO[c]);
  const quadros = [];
  const marcas = [];
  let t = 0.25;
  let anterior = null;
  for (const l of letras) {
    marcas.push({ t, texto: l });
    // letra repetida: pequeno deslocamento lateral para marcar a repetição
    const desl = l === anterior ? [-0.035, 0, 0] : [0, 0, 0];
    const mov = ALFABETO[l][2];
    if (mov === 'j') {
      quadros.push({ t, q: poseLetra(l) });
      quadros.push({ t: t + porLetra * 0.45, q: poseLetra(l, [0.0, -0.05, 0.02], 0.5) });
      quadros.push({ t: t + porLetra * 0.9, q: poseLetra(l, [-0.03, -0.06, 0.02], 1.1) });
    } else if (mov === 'z') {
      const pts = [[0.04, 0.03], [0.1, 0.03], [0.04, -0.04], [0.1, -0.04]];
      pts.forEach(([x, y], i) => quadros.push({ t: t + (i / 3) * porLetra * 1.3, q: poseLetra(l, [x - 0.04, y, 0]) }));
      t += porLetra * 0.4;
    } else if (mov === 'k') {
      quadros.push({ t, q: poseLetra(l) });
      quadros.push({ t: t + porLetra * 0.8, q: poseLetra(l, [0, 0.05, 0]) });
    } else if (mov === 'h') {
      quadros.push({ t, q: poseLetra(l) });
      quadros.push({ t: t + porLetra * 0.8, q: poseLetra(l, [0, 0, 0], -0.5) });
    } else if (mov === 'ç') {
      quadros.push({ t, q: poseLetra(l) });
      quadros.push({ t: t + porLetra * 0.3, q: poseLetra(l, [0, -0.025, 0]) });
      quadros.push({ t: t + porLetra * 0.6, q: poseLetra(l, [0, 0.0, 0]) });
      quadros.push({ t: t + porLetra * 0.9, q: poseLetra(l, [0, -0.025, 0]) });
    } else {
      const q = poseLetra(l, desl);
      quadros.push({ t, q });
      quadros.push({ t: t + porLetra * 0.75, q });
    }
    t += porLetra;
    anterior = l;
  }
  return { nome: `datilologia:${palavra}`, quadros, marcas, tipo: 'datilologia' };
}

// --------------------------------------------- sinais procedurais básicos --
// Poucos sinais simples e bem conhecidos, como ponto de partida. O caminho
// recomendado para todos os outros é a captura a partir dos vídeos da modelo.

export function sinaisProcedurais() {
  const s = {};
  // OI / TCHAU: mão aberta, palma para frente, balançando
  s.oi = () => {
    const c = gestoAcenar();
    c.nome = 'OI';
    return c;
  };
  // SIM: mão em S balançando para cima e para baixo (como cabeça acenando)
  s.sim = () => {
    const a = resolverPose({ right: { ...DATILO, mao: 'S', dedos: [0, 1, 0.1], palma: [0, 0, 1] }, cabeca: [6, 0, 0] });
    const b = resolverPose({ right: { ...DATILO, mao: 'S', dedos: [0, 0.6, 0.8], palma: [0, -0.8, 0.6] }, cabeca: [-4, 0, 0] });
    return { nome: 'SIM', quadros: [a, b, a, b].map((q, i) => ({ t: 0.3 + i * 0.22, q })) };
  };
  // NÃO: dedo indicador erguido balançando de um lado para o outro + cabeça negando
  s.nao = () => {
    const pose = (ang, cab) => resolverPose({
      right: { ...DATILO, mao: 'indicador', dedos: [Math.sin(ang), Math.cos(ang), 0], palma: [0, 0, 1] },
      cabeca: [0, cab, 0],
    });
    return {
      nome: 'NÃO',
      quadros: [pose(-0.3, -8), pose(0.3, 8), pose(-0.3, -8), pose(0.3, 8)].map((q, i) => ({ t: 0.3 + i * 0.2, q, rosto: { sobrancelha: -0.5 } })),
    };
  };
  return s;
}

export { LADOS };
