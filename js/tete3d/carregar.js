// Carrega as malhas geradas (assets/tete/) e as liga ao esqueleto animado.
import * as THREE from '../vendor/three.module.min.js';
import { criarEsqueleto, aplicarPoseLigacao } from '../movimento/rig.js';

let cacheDados = null;

async function baixar(base) {
  cacheDados ??= Promise.all([
    fetch(`${base}tete.json`).then((r) => r.json()),
    fetch(`${base}tete.bin`).then((r) => r.arrayBuffer()),
  ]);
  return cacheDados;
}

/**
 * @param {object} ossos ossos animados (do motor de movimento)
 * @param {object} materiais { pele, rosto, blusa, jeans, cabeloBase }
 */
export async function carregarMalhas(ossos, materiais, base = 'assets/tete/') {
  const [manifesto, bin] = await baixar(base);

  // matrizes inversas da pose de ligação (a mesma usada na geração)
  const ligacao = criarEsqueleto();
  aplicarPoseLigacao(ligacao.ossos);
  const listaOssos = manifesto.ossos.map((n) => ossos[n]);
  const inversas = manifesto.ossos.map((n) => ligacao.ossos[n].matrixWorld.clone().invert());
  const esqueleto = new THREE.Skeleton(listaOssos, inversas);

  const malhas = {};
  for (const m of manifesto.malhas) {
    const qpos = new Uint16Array(bin, m.posicao.offset, m.vertices * 3);
    const pos = new Float32Array(m.vertices * 3);
    for (let i = 0; i < pos.length; i++) pos[i] = m.quantMin[i % 3] + qpos[i] * m.quantEscala[i % 3];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(bin, m.normal.offset, m.vertices * 3), 3, true));
    const Indices = m.indice.bits === 16 ? Uint16Array : Uint32Array;
    g.setIndex(new THREE.BufferAttribute(new Indices(bin, m.indice.offset, m.triangulos * 3), 1));
    let malha;
    if (m.rigido) {
      malha = new THREE.Mesh(g, materiais[m.material]);
      ossos[m.rigido].add(malha);
    } else {
      g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint8Array(bin, m.ossoIndice.offset, m.vertices * 4), 4));
      g.setAttribute('skinWeight', new THREE.BufferAttribute(new Uint8Array(bin, m.ossoPeso.offset, m.vertices * 4), 4, true));
      malha = new THREE.SkinnedMesh(g, materiais[m.material]);
      malha.bind(esqueleto, new THREE.Matrix4());
      malha.frustumCulled = false;
      ossos.hips.parent.add(malha);
    }
    malha.castShadow = true;
    malha.receiveShadow = true;
    malha.name = m.nome;
    malhas[m.nome] = malha;
  }
  return malhas;
}
