// Pequenos detalhes presos aos ossos: unhas, aliança e botão do jeans.
import * as THREE from '../vendor/three.module.min.js';
import { DEDOS, COMP_DEDOS } from '../movimento/rig.js';
import { RAIOS_DEDOS } from './escultura.js';

export function criarDetalhes(ossos, mat) {
  for (const lado of ['left', 'right']) {
    for (const d of DEDOS) {
      const r = RAIOS_DEDOS[d][3];
      const comp = COMP_DEDOS[d][2];
      const unha = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), mat.unha);
      unha.scale.set(r * 0.72, comp * 0.4, r * 0.32);
      unha.position.set(0, -comp * 0.62, -r * 0.82); // costas do dedo (−Z)
      ossos[`${lado}${d}Distal`].add(unha);
    }
  }
  // aliança dourada na mão esquerda (como na foto)
  const anel = new THREE.Mesh(new THREE.TorusGeometry(RAIOS_DEDOS.Ring[0] * 1.02, 0.0016, 10, 28), mat.ouro);
  anel.rotation.x = Math.PI / 2;
  anel.position.y = -0.016;
  ossos.leftRingProximal.add(anel);
  // botão do jeans
  const botao = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.004, 24), mat.ouro);
  botao.rotation.x = Math.PI / 2;
  botao.position.set(0, 1.031 - 0.95, 0.098);
  ossos.hips.add(botao);
}
