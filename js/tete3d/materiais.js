// Materiais da Teté (cores tiradas da foto de referência) e ambiente de luz.
import * as THREE from '../vendor/three.module.min.js';
import { aleatorio } from './sdf.js';
import { CABECA } from './escultura.js';

export const COR = {
  pele: 0xedb995,
  blusa: 0xb8664a, // pêssego/terracota das fotos, um tom mais forte que a pele (mãos legíveis)
  saia: 0x1d1c20,
  jeans: 0xa8c6e4,
  ouro: 0xd6ad62,
  cabelo: 0x3b2316,
  labios: 0xc9625a,
  sobrancelha: 0x5a3622,
};

export function textura(tam, desenhar, { repetir = false, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = tam;
  desenhar(c.getContext('2d'), tam);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function ruido(g, t, qtd, cor, alfa, raio, semente) {
  const r = aleatorio(semente);
  g.fillStyle = cor;
  for (let i = 0; i < qtd; i++) {
    g.globalAlpha = alfa * (0.4 + r() * 0.6);
    g.beginPath(); g.arc(r() * t, r() * t, raio * (0.5 + r()), 0, 7); g.fill();
  }
  g.globalAlpha = 1;
}

/**
 * Projeção de textura sem UV (a malha esculpida não tem UV): calcula a
 * coordenada no shader a partir da posição do vértice.
 *  - 'cilindro': em volta do eixo Y (texturas de tecido)
 *  - 'frente': projeção frontal (maquiagem do rosto)
 */
function projetar(material, modo, escala) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uEscala = { value: escala };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vUvProj;\nuniform vec2 uEscala;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        ${modo === 'cilindro'
          ? 'vUvProj = vec2(atan(position.x, position.z) / 6.2831853 + 0.5, position.y) * uEscala;'
          : `vUvProj = vec2(position.x * uEscala.x + 0.5, (position.y - ${(0.115 * CABECA.escala).toFixed(5)}) * uEscala.y + 0.5);`}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vUvProj;')
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 texel = texture2D(map, vUvProj);
          diffuseColor *= texel;
        #endif`)
      .replace('#include <bumpmap_pars_fragment>', `#include <bumpmap_pars_fragment>`);
    if (material.bumpMap) {
      shader.fragmentShader = shader.fragmentShader.replace('vec2 dHdxy_fwd() {', 'vec2 dHdxy_fwd_orig() {');
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
        #ifdef USE_BUMPMAP
          {
            vec2 dSTdx = dFdx(vUvProj), dSTdy = dFdy(vUvProj);
            float Hll = bumpScale * texture2D(bumpMap, vUvProj).x;
            vec2 dH = vec2(bumpScale * texture2D(bumpMap, vUvProj + dSTdx).x - Hll, bumpScale * texture2D(bumpMap, vUvProj + dSTdy).x - Hll);
            normal = perturbNormalArb(-vViewPosition, normal, dH, faceDirection);
          }
        #endif`);
    }
  };
  material.customProgramCacheKey = () => `proj-${modo}`;
  return material;
}

/** Maquiagem natural do rosto: blush, sardas, rubor no nariz. */
function texturaRosto() {
  const T = 1024;
  // projeção frontal: u = x * 4.5 + 0.5, v = (y - 0.115) * 4.5 + 0.5 (espaço da cabeça)
  const xy = (x, y) => [(x * 4.5 + 0.5) * T, (1 - ((y - 0.115) * 4.5 + 0.5)) * T];
  return textura(T, (g) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, T, T);
    const mancha = (x, y, r, cor, sx = 1, sy = 1) => {
      const [px, py] = xy(x, y);
      g.save(); g.translate(px, py); g.scale(sx, sy);
      const rr = r * 4.5 * T;
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, rr);
      grad.addColorStop(0, cor); grad.addColorStop(1, cor.replace(/[\d.]+\)$/, '0)'));
      g.fillStyle = grad; g.beginPath(); g.arc(0, 0, rr, 0, 7); g.fill();
      g.restore();
    };
    for (const s of [1, -1]) {
      mancha(s * 0.046, 0.072, 0.03, 'rgba(255,140,130,0.42)', 1.2, 0.95); // blush
      mancha(s * 0.036, 0.142, 0.018, 'rgba(230,160,150,0.3)', 1.3, 0.6); // pálpebras
    }
    mancha(0, 0.093, 0.01, 'rgba(255,150,140,0.35)'); // ponta do nariz
    const rnd = aleatorio(21);
    for (let i = 0; i < 18; i++) {
      const s = i % 2 ? 1 : -1;
      const x = s * (0.006 + rnd() * 0.05), y = 0.1 - rnd() * 0.03;
      if (Math.abs(x) < 0.01 && y < 0.095) continue;
      mancha(x, y, 0.0009 + rnd() * 0.0007, `rgba(175,110,80,${0.12 + rnd() * 0.15})`);
    }
  });
}

export function criarMateriais() {
  const pele = new THREE.MeshPhysicalMaterial({
    color: COR.pele, roughness: 0.62, sheen: 0.3, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xff9a80),
    clearcoat: 0.04, clearcoatRoughness: 0.6,
  });
  const rosto = projetar(pele.clone(), 'frente', new THREE.Vector2(4.5 / CABECA.escala, 4.5 / CABECA.escala));
  rosto.map = texturaRosto();

  const blusa = projetar(new THREE.MeshPhysicalMaterial({
    color: COR.blusa, roughness: 0.85, sheen: 0.9, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xf2b49a),
    // tecido liso (sem relevo): visual mais limpo, de animação
  }), 'cilindro', new THREE.Vector2(60, 1));
  // saia preta de malha, com brilho suave para mostrar o volume
  const saia = new THREE.MeshPhysicalMaterial({ color: COR.saia, roughness: 0.78, sheen: 0.5, sheenRoughness: 0.5, sheenColor: new THREE.Color(0x6a6a78) });

  const sarja = textura(256, (g, t) => {
    g.fillStyle = '#a8c6e4'; g.fillRect(0, 0, t, t);
    g.strokeStyle = 'rgba(70,110,160,.3)'; g.lineWidth = 1.5;
    for (let i = -t; i < t * 2; i += 5) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + t, t); g.stroke(); }
    ruido(g, t, 2500, '#ffffff', 0.16, 1.4, 9);
  }, { repetir: true });
  const jeans = projetar(new THREE.MeshStandardMaterial({ map: sarja, roughness: 0.92, bumpMap: sarja, bumpScale: 0.4 }), 'cilindro', new THREE.Vector2(8, 8));

  const cabeloBase = new THREE.MeshPhysicalMaterial({
    color: 0x4a2c1a, roughness: 0.55, sheen: 0.6, sheenRoughness: 0.4, sheenColor: new THREE.Color(0x8a5c3a), envMapIntensity: 0.5,
  });
  const cabelo = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.45, sheen: 0.35, sheenRoughness: 0.4, sheenColor: new THREE.Color(0x6e4a32),
    clearcoat: 0.18, clearcoatRoughness: 0.4, envMapIntensity: 0.6,
  });
  const ouro = new THREE.MeshPhysicalMaterial({ color: COR.ouro, metalness: 1, roughness: 0.22, clearcoat: 0.5 });
  const lente = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, transparent: true, opacity: 0.06, clearcoat: 1, depthWrite: false });
  const labios = new THREE.MeshPhysicalMaterial({ color: COR.labios, roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.35, side: THREE.DoubleSide });
  const boca = new THREE.MeshStandardMaterial({ color: 0x5a2120, roughness: 0.85, side: THREE.DoubleSide });
  const dentes = new THREE.MeshPhysicalMaterial({ color: 0xfaf6f0, roughness: 0.3, clearcoat: 0.5, side: THREE.DoubleSide });
  const sobrancelha = new THREE.MeshStandardMaterial({ color: COR.sobrancelha, roughness: 0.9, side: THREE.DoubleSide });
  const cilios = new THREE.MeshStandardMaterial({ color: 0x1b100a, roughness: 0.7 });
  const unha = new THREE.MeshPhysicalMaterial({ color: 0xeaa792, roughness: 0.35, clearcoat: 0.35, clearcoatRoughness: 0.3 });
  const costura = new THREE.MeshStandardMaterial({ color: 0xe2b56c, roughness: 0.8 });
  return { pele, rosto, blusa, saia, jeans, cabeloBase, cabelo, ouro, lente, labios, boca, dentes, sobrancelha, cilios, unha, costura };
}

/** Ambiente de estúdio (reflexos suaves nos óculos, olhos e pele). */
export function criarAmbiente(renderer) {
  const cena = new THREE.Scene();
  const fundo = textura(256, (g, t) => {
    const grad = g.createLinearGradient(0, 0, 0, t);
    grad.addColorStop(0, '#fff3ea'); grad.addColorStop(0.5, '#e6d2c8'); grad.addColorStop(1, '#7a5e55');
    g.fillStyle = grad; g.fillRect(0, 0, t, t);
  });
  cena.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ map: fundo, side: THREE.BackSide })));
  const painel = (cor, k, x, y, z, w, h) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(cor).multiplyScalar(k) }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); cena.add(m);
  };
  painel(0xfff1e2, 2.2, 3, 3, 5, 4, 3);
  painel(0xdfe9ff, 0.9, -5, 1, 3, 3, 4);
  painel(0xffd2b8, 1.4, 0, 4, -6, 6, 2);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(cena, 0.04).texture;
  pmrem.dispose();
  return env;
}
