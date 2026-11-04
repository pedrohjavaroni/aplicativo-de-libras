// Esqueleto da personagem "Teté" (a malha 3D fica em js/tete3d/).
//
// Os ossos seguem os nomes do padrão VRM Humanoid (hips, spine, chest, neck,
// head, leftUpperArm, leftLowerArm, leftHand, leftIndexProximal, ...). Assim,
// um modelo feito por artista (.glb/.vrm no Blender ou VRoid) pode substituir a
// malha sem mudar as animações.
//
// Convenções (espaço do mundo): +Y para cima, +Z para a câmera, +X = lado
// ESQUERDO da personagem (direita de quem olha). Todo osso de membro tem a
// posição de repouso apontando para -Y local. Na mão: dedos em -Y, palma em +Z,
// polegar em (lado * X), onde lado = +1 (mão esquerda) e -1 (mão direita).

import * as THREE from '../vendor/three.module.min.js';


export const DEDOS = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'];
export const FALANGES = ['Proximal', 'Intermediate', 'Distal'];

// comprimentos das falanges (m)
export const COMP_DEDOS = {
  Thumb: [0.038, 0.03, 0.026],
  Index: [0.044, 0.026, 0.021],
  Middle: [0.048, 0.029, 0.022],
  Ring: [0.045, 0.027, 0.021],
  Little: [0.035, 0.021, 0.019],
};
// posição da base de cada dedo no osso da mão (x em unidades de "lado do polegar")
export const BASE_DEDOS = {
  Thumb: [0.026, -0.022, 0.012],
  Index: [0.0185, -0.085, 0],
  Middle: [0, -0.088, 0], // dedo médio no eixo da mão (como no MediaPipe)
  Ring: [-0.0175, -0.085, 0],
  Little: [-0.032, -0.077, 0],
};
export const MEDIDAS = { braco: 0.27, antebraco: 0.24 };

function osso(nome, pai, x, y, z) {
  const b = new THREE.Bone();
  b.name = nome;
  b.position.set(x, y, z);
  if (pai) pai.add(b);
  return b;
}

/** Cria só o esqueleto (sem malhas). Usado tanto no avatar visível quanto no "solver". */
export function criarEsqueleto() {
  const ossos = {};
  const add = (nome, pai, x, y, z) => (ossos[nome] = osso(nome, pai && ossos[pai], x, y, z));

  const raiz = new THREE.Object3D();
  ossos.hips = osso('hips', raiz, 0, 0.95, 0);
  add('spine', 'hips', 0, 0.1, 0);
  add('chest', 'spine', 0, 0.18, 0);
  add('neck', 'chest', 0, 0.22, 0);
  add('head', 'neck', 0, 0.08, 0);

  for (const [lado, s] of [['left', 1], ['right', -1]]) {
    add(`${lado}Shoulder`, 'chest', s * 0.03, 0.17, -0.01);
    add(`${lado}UpperArm`, `${lado}Shoulder`, s * 0.15, 0, 0);
    add(`${lado}LowerArm`, `${lado}UpperArm`, 0, -MEDIDAS.braco, 0);
    add(`${lado}Hand`, `${lado}LowerArm`, 0, -MEDIDAS.antebraco, 0);
    for (const d of DEDOS) {
      const [bx, by, bz] = BASE_DEDOS[d];
      const comp = COMP_DEDOS[d];
      add(`${lado}${d}Proximal`, `${lado}Hand`, s * bx, by, bz);
      add(`${lado}${d}Intermediate`, `${lado}${d}Proximal`, 0, -comp[0], 0);
      add(`${lado}${d}Distal`, `${lado}${d}Intermediate`, 0, -comp[1], 0);
    }
  }
  raiz.updateMatrixWorld(true);
  return { raiz, ossos };
}

/**
 * Pose de ligação ("bind pose") da malha: braços levemente abertos (pose A),
 * dedos afastados e polegar aberto — assim nenhuma parte da pele encosta em
 * outra na escultura, e cada vértice fica ligado ao osso certo.
 */
export function aplicarPoseLigacao(ossos) {
  for (const n in ossos) ossos[n].quaternion.identity();
  const rad = THREE.MathUtils.degToRad;
  const abertura = { Index: 7, Middle: 0, Ring: -7, Little: -15 };
  for (const [lado, s] of [['left', 1], ['right', -1]]) {
    ossos[`${lado}UpperArm`].quaternion.setFromEuler(new THREE.Euler(0, 0, s * rad(14)));
    ossos[`${lado}LowerArm`].quaternion.setFromEuler(new THREE.Euler(rad(-6), 0, 0));
    for (const d in abertura) ossos[`${lado}${d}Proximal`].quaternion.setFromEuler(new THREE.Euler(0, 0, s * rad(abertura[d])));
    ossos[`${lado}ThumbProximal`].quaternion.setFromUnitVectors(
      new THREE.Vector3(0, -1, 0), new THREE.Vector3(s * 0.72, -0.62, 0.32).normalize());
    ossos[`${lado}ThumbIntermediate`].quaternion.setFromEuler(new THREE.Euler(0, 0, s * rad(-12)));
  }
  ossos.hips.parent.updateMatrixWorld(true);
}
