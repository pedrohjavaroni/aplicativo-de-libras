// Teté 3D: a intérprete de Libras do app, em estilo de animação.
//
// - Malhas esculpidas (assets/tete/, geradas por ferramentas/gerar-tete.mjs)
//   ligadas ao esqueleto do motor de movimento (SkinnedMesh).
// - Rosto vivo: olhos com íris e córnea, pálpebras que piscam, lábios que
//   falam e sorriem, sobrancelhas expressivas, óculos dourados.
// - Cabelo: volume esculpido + cachos em mola.

import * as THREE from '../vendor/three.module.min.js';
import { criarMotor } from '../movimento/motor.js';
import { criarMateriais, criarAmbiente } from './materiais.js';
import { carregarMalhas } from './carregar.js';
import { criarRosto } from './rosto.js';
import { criarCachos } from './cachos.js';
import { criarDetalhes } from './detalhes.js';

export function criarTete(container, { aoMarcar, base } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Teté, intérprete de Libras');

  const cena = new THREE.Scene();
  cena.environment = criarAmbiente(renderer);
  const camera = new THREE.PerspectiveCamera(24, 1, 0.05, 20);

  // luz de estúdio: principal quente, preenchimento frio, contornos
  cena.add(new THREE.HemisphereLight(0xfff1e8, 0x8f736a, 0.45));
  const principal = new THREE.DirectionalLight(0xfff0e0, 1.6);
  principal.position.set(1.0, 2.4, 2.4);
  principal.castShadow = true;
  principal.shadow.mapSize.set(2048, 2048);
  Object.assign(principal.shadow.camera, { left: -0.6, right: 0.6, top: 2.0, bottom: 0.7, near: 0.5, far: 6 });
  principal.shadow.bias = -0.0003;
  principal.shadow.normalBias = 0.003;
  cena.add(principal);
  const preench = new THREE.DirectionalLight(0xdbe6ff, 0.45);
  preench.position.set(-2, 1.3, 1.6);
  cena.add(preench);
  const contorno = new THREE.DirectionalLight(0xffd7bd, 1.3);
  contorno.position.set(-0.8, 2.2, -2.2);
  cena.add(contorno);
  const contorno2 = new THREE.DirectionalLight(0xffe8d6, 0.7);
  contorno2.position.set(1.3, 1.7, -1.8);
  cena.add(contorno2);

  const motor = criarMotor({ aoMarcar });
  const { ossos } = motor;
  cena.add(ossos.hips.parent);
  const mat = criarMateriais();
  let rosto = null;
  const pronto = carregarMalhas(ossos, mat, base).then((malhas) => {
    rosto = criarRosto(ossos.head, mat);
    ossos.head.add(criarCachos(malhas.cabelo, mat));
    criarDetalhes(ossos, mat);
    return malhas;
  });

  function enquadrar() {
    const w = container.clientWidth || 300, h = container.clientHeight || 300;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // palco alto: da cintura até acima da cabeça; palco baixo e largo: rosto e mãos
    const compacto = camera.aspect > 1.25;
    const [cy, alt, larg] = compacto ? [1.56, 0.62, 0.72] : [1.4, 1.0, 1.0];
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const dist = Math.max(alt / 2 / Math.tan(fov / 2), larg / 2 / (Math.tan(fov / 2) * camera.aspect));
    camera.position.set(0, cy + 0.03, dist);
    camera.lookAt(0, cy, 0);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(enquadrar).observe(container);
  enquadrar();

  const relogio = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const { rosto: r, tempo } = motor.atualizar(relogio.getDelta());
    rosto?.atualizar(r, tempo);
    renderer.render(cena, camera);
  });

  return {
    renderer, camera, cena, ossos, pronto,
    tocar: motor.tocar,
    parar: motor.parar,
    datilologia: motor.datilologia,
    gesto: motor.gesto,
    falando: motor.falando,
    velocidade: motor.velocidade,
    get ocupado() { return motor.ocupado; },
  };
}
