// Retargeting: converte landmarks do MediaPipe (pose + mãos + rosto) extraídos
// dos vídeos da modelo em um quadro de animação do avatar (quatérnios locais).
//
// Coordenadas do MediaPipe (world landmarks): x para a direita da imagem,
// y para baixo, z para longe da câmera. Avatar: +X = esquerda da personagem
// (direita da imagem, pois ela está de frente), +Y para cima, +Z para a câmera.
// Logo: (x, y, z)_avatar = (x, -y, -z)_mediapipe.

import * as THREE from '../vendor/three.module.min.js';
import { criarEsqueleto, FALANGES } from './rig.js';
import { apontar, rotacaoMundo, quatMaoLandmarks, capturarQuadro, zerar, OSSOS_ANIMAVEIS } from './pose.js';
import { POSE_REPOUSO } from './solver.js';

const { ossos } = criarEsqueleto();

const conv = (p) => new THREE.Vector3(p.x, -p.y, -p.z);

// índices MediaPipe Pose
const POSE = { nariz: 0, orelhaE: 7, orelhaD: 8, ombroE: 11, ombroD: 12, cotoveloE: 13, cotoveloD: 14, punhoE: 15, punhoD: 16 };
// índices MediaPipe Hands
const DEDOS_MP = {
  Thumb: [1, 2, 3, 4],
  Index: [5, 6, 7, 8],
  Middle: [9, 10, 11, 12],
  Ring: [13, 14, 15, 16],
  Little: [17, 18, 19, 20],
};

function visivel(lm, i, min = 0.5) {
  return lm[i] && (lm[i].visibility ?? 1) >= min;
}

/**
 * Associa cada mão detectada ao lado do corpo comparando a posição do punho
 * da mão (imagem) com os punhos da pose. Mais robusto que o rótulo
 * "handedness", que assume imagem espelhada (selfie).
 */
export function associarMaos(poseImg, maos) {
  const res = {};
  if (!maos?.landmarks?.length) return res;
  maos.landmarks.forEach((lmImg, k) => {
    const w = lmImg[0];
    let lado;
    if (poseImg) {
      const dE = Math.hypot(w.x - poseImg[POSE.punhoE].x, w.y - poseImg[POSE.punhoE].y);
      const dD = Math.hypot(w.x - poseImg[POSE.punhoD].x, w.y - poseImg[POSE.punhoD].y);
      lado = dE < dD ? 'left' : 'right';
    } else {
      // sem pose: na imagem não espelhada a mão esquerda da pessoa aparece à direita
      lado = w.x > 0.5 ? 'left' : 'right';
    }
    if (!res[lado]) res[lado] = { img: lmImg, mundo: maos.worldLandmarks[k] };
  });
  return res;
}

/**
 * Gera um quadro a partir de um resultado de detecção.
 * @param {object} det { poseMundo, poseImg, maos: {left|right: {mundo}}, blend: {categoria: score} }
 * @param {object} anterior quadro anterior (para manter o que não foi detectado)
 */
export function quadroDeDeteccao(det, anterior) {
  zerar(ossos);
  // parte do quadro anterior (ou repouso) para ossos não detectados
  const base = anterior || POSE_REPOUSO;
  for (const n of OSSOS_ANIMAVEIS) ossos[n].quaternion.fromArray(base[n]);
  ossos.hips.parent.updateMatrixWorld(true);

  const pm = det.poseMundo;
  if (pm) {
    const ombroE = conv(pm[POSE.ombroE]), ombroD = conv(pm[POSE.ombroD]);
    // tronco: orientação a partir da linha dos ombros (giro e inclinação)
    if (visivel(pm, POSE.ombroE) && visivel(pm, POSE.ombroD)) {
      const x = ombroE.clone().sub(ombroD).normalize();
      const y = new THREE.Vector3(0, 1, 0);
      y.sub(x.clone().multiplyScalar(y.dot(x))).normalize();
      const z = new THREE.Vector3().crossVectors(x, y);
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      // aplica metade na coluna e metade no peito (movimento mais natural)
      ossos.spine.quaternion.identity().slerp(q, 0.4);
      ossos.spine.updateMatrixWorld(true);
      rotacaoMundo(ossos.chest, q);
    }
    // cabeça: orelhas definem o eixo lateral, nariz a frente
    if (visivel(pm, POSE.orelhaE) && visivel(pm, POSE.orelhaD) && visivel(pm, POSE.nariz)) {
      const oE = conv(pm[POSE.orelhaE]), oD = conv(pm[POSE.orelhaD]), nariz = conv(pm[POSE.nariz]);
      const x = oE.clone().sub(oD).normalize();
      const meio = oE.clone().add(oD).multiplyScalar(0.5);
      const z = nariz.clone().sub(meio);
      z.sub(x.clone().multiplyScalar(z.dot(x))).normalize();
      const y = new THREE.Vector3().crossVectors(z, x);
      // o nariz fica abaixo da linha das orelhas: corrige ~15° de inclinação natural
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z))
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(-15)));
      rotacaoMundo(ossos.neck, ossos.chest.getWorldQuaternion(new THREE.Quaternion()).slerp(q, 0.4));
      rotacaoMundo(ossos.head, q);
    }
    // braços: direções ombro→cotovelo e cotovelo→punho
    for (const [lado, o, c, p] of [
      ['left', POSE.ombroE, POSE.cotoveloE, POSE.punhoE],
      ['right', POSE.ombroD, POSE.cotoveloD, POSE.punhoD],
    ]) {
      if (!visivel(pm, o) || !visivel(pm, c, 0.35)) continue;
      const vO = conv(pm[o]), vC = conv(pm[c]), vP = conv(pm[p]);
      apontar(ossos[`${lado}UpperArm`], vC.clone().sub(vO));
      if (visivel(pm, p, 0.3)) apontar(ossos[`${lado}LowerArm`], vP.clone().sub(vC));
    }
  }

  // mãos: orientação absoluta + cada falange
  for (const lado of ['left', 'right']) {
    const m = det.maos?.[lado];
    if (!m) continue;
    const L = m.mundo.map(conv);
    rotacaoMundo(ossos[`${lado}Hand`], quatMaoLandmarks(lado, L[0], L[5], L[17], L[9]));
    for (const d in DEDOS_MP) {
      const idx = DEDOS_MP[d];
      for (let f = 0; f < 3; f++) {
        apontar(ossos[`${lado}${d}${FALANGES[f]}`], L[idx[f + 1]].clone().sub(L[idx[f]]));
      }
    }
  }

  const quadro = { q: capturarQuadro(ossos) };
  // expressões faciais (marcadores não manuais da Libras)
  if (det.blend) {
    const b = det.blend;
    const media = (...ks) => ks.reduce((s, k) => s + (b[k] || 0), 0) / ks.length;
    quadro.rosto = {
      boca: +Math.min(1, (b.jawOpen || 0) * 1.6).toFixed(2),
      sorriso: +media('mouthSmileLeft', 'mouthSmileRight').toFixed(2),
      sobrancelha: +(media('browInnerUp', 'browOuterUpLeft', 'browOuterUpRight') - media('browDownLeft', 'browDownRight')).toFixed(2),
      piscar: +media('eyeBlinkLeft', 'eyeBlinkRight').toFixed(2),
    };
  }
  return quadro;
}

/** Suavização temporal simples (média móvel por slerp) de uma sequência de quadros. */
export function suavizar(quadros, forca = 0.5) {
  if (quadros.length < 3) return quadros;
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  const saida = [quadros[0]];
  for (let i = 1; i < quadros.length; i++) {
    const prev = saida[i - 1], cur = quadros[i];
    const q = {};
    for (const n in cur.q) {
      qa.fromArray(prev.q[n] || cur.q[n]);
      qb.fromArray(cur.q[n]);
      if (qa.dot(qb) < 0) qb.set(-qb.x, -qb.y, -qb.z, -qb.w);
      qa.slerp(qb, 1 - forca);
      q[n] = [qa.x, qa.y, qa.z, qa.w].map((v) => +v.toFixed(4));
    }
    saida.push({ ...cur, q });
  }
  return saida;
}
