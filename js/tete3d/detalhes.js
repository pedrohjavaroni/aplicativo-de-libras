// Pequenos detalhes presos aos ossos: unhas, aliança e colar.
import * as THREE from '../vendor/three.module.min.js';
import { DEDOS, COMP_DEDOS } from '../movimento/rig.js';
import { RAIOS_DEDOS } from './escultura.js';

export function criarDetalhes(ossos, mat) {
  for (const lado of ['left', 'right']) {
    for (const d of DEDOS) {
      const r = RAIOS_DEDOS[d][3];
      const comp = COMP_DEDOS[d][2];
      const unha = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), mat.unha);
      unha.scale.set(r * 0.62, comp * 0.36, r * 0.22);
      unha.position.set(0, -comp * 0.66, -r * 0.84); // costas do dedo (−Z), rente à pele
      ossos[`${lado}${d}Distal`].add(unha);
    }
  }
  // aliança dourada na mão esquerda (como na foto)
  const anel = new THREE.Mesh(new THREE.TorusGeometry(RAIOS_DEDOS.Ring[0] * 1.02, 0.0016, 10, 28), mat.ouro);
  anel.rotation.x = Math.PI / 2;
  anel.position.y = -0.016;
  ossos.leftRingProximal.add(anel);
  criarColar(ossos, mat);
}

/** Corrente dourada fina no colo (como nas fotos), presa ao peito. */
export function criarColar(ossos, mat) {
  const peito = ossos.chest;
  peito.updateWorldMatrix(true, false);
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * Math.PI * 2;
    const frente = (Math.cos(t) + 1) / 2; // 1 na frente, 0 atrás
    // contorna a base do pescoço e desce em "U" no colo
    pts.push(new THREE.Vector3(Math.sin(t) * (0.047 + frente * 0.012), 1.452 - frente * frente * 0.058, Math.cos(t) * 0.044 + 0.004 + frente * 0.028));
  }
  const curva = new THREE.CatmullRomCurve3(pts, true);
  const g = new THREE.TubeGeometry(curva, 160, 0.0011, 6, true);
  g.applyMatrix4(peito.matrixWorld.clone().invert());
  const colar = new THREE.Mesh(g, mat.ouro);
  peito.add(colar);
  return colar;
}
