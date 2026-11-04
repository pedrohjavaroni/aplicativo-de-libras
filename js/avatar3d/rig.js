// Esqueleto e malha procedural da personagem "Lia".
//
// Os ossos seguem os nomes do padrão VRM Humanoid (hips, spine, chest, neck,
// head, leftUpperArm, leftLowerArm, leftHand, leftIndexProximal, ...). Assim,
// no futuro, um modelo profissional (.vrm feito no VRoid / Blender a partir da
// foto da modelo) pode substituir esta malha sem mudar as animações.
//
// Convenções (espaço do mundo): +Y para cima, +Z para a câmera, +X = lado
// ESQUERDO da personagem (direita de quem olha). Todo osso de membro tem a
// posição de repouso apontando para -Y local. Na mão: dedos em -Y, palma em +Z,
// polegar em (lado * X), onde lado = +1 (mão esquerda) e -1 (mão direita).

import * as THREE from '../vendor/three.module.min.js';

export const CORES = {
  pele: 0xf2c6a8,
  peleSombra: 0xe2a98a,
  cabelo: 0x3a2216,
  cabeloLuz: 0x5d3520,
  blusa: 0xb5715f,
  jeans: 0xa7c6e4,
  ouro: 0xc9a25e,
  iris: 0x6f8580,
  boca: 0xb5574e,
  sobrancelha: 0x3e2418,
};

export const DEDOS = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'];
export const FALANGES = ['Proximal', 'Intermediate', 'Distal'];

// comprimentos das falanges (m)
const COMP_DEDOS = {
  Thumb: [0.038, 0.03, 0.026],
  Index: [0.044, 0.026, 0.021],
  Middle: [0.048, 0.029, 0.022],
  Ring: [0.045, 0.027, 0.021],
  Little: [0.035, 0.021, 0.019],
};
// posição da base de cada dedo no osso da mão (x em unidades de "lado do polegar")
const BASE_DEDOS = {
  Thumb: [0.026, -0.022, 0.012],
  Index: [0.0185, -0.085, 0],
  Middle: [0, -0.088, 0], // dedo médio no eixo da mão (como no MediaPipe)
  Ring: [-0.0175, -0.085, 0],
  Little: [-0.032, -0.077, 0],
};
export const MEDIDAS = { braco: 0.27, antebraco: 0.24 };

function osso(nome, pai, x, y, z) {
  const b = new THREE.Object3D();
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

// ---------------------------------------------------------------- malhas ----

function mat(cor, extra = {}) {
  return new THREE.MeshStandardMaterial({ color: cor, roughness: 0.75, metalness: 0, ...extra });
}

function capsula(raio, comp, material) {
  // cápsula ao longo de -Y começando na origem
  const g = new THREE.CapsuleGeometry(raio, Math.max(comp - 2 * raio, 0.001), 6, 14);
  g.translate(0, -comp / 2, 0);
  const m = new THREE.Mesh(g, material);
  m.castShadow = true;
  return m;
}

function texturaTatuagem() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = '#3f4a5c';
  g.fillStyle = '#3f4a5c';
  g.lineWidth = 3;
  // livro aberto
  g.beginPath();
  g.moveTo(24, 92); g.quadraticCurveTo(44, 80, 64, 92); g.quadraticCurveTo(84, 80, 104, 92);
  g.lineTo(104, 104); g.quadraticCurveTo(84, 94, 64, 106); g.quadraticCurveTo(44, 94, 24, 104); g.closePath();
  g.stroke();
  g.beginPath(); g.moveTo(64, 92); g.lineTo(64, 106); g.stroke();
  // borboletas e pontinhos saindo do livro
  const borboleta = (x, y, s) => {
    g.beginPath(); g.ellipse(x - 5 * s, y, 5 * s, 3.5 * s, -0.5, 0, 7); g.ellipse(x + 5 * s, y, 5 * s, 3.5 * s, 0.5, 0, 7); g.fill();
  };
  borboleta(56, 60, 1.1); borboleta(78, 38, 0.9); borboleta(60, 18, 0.7);
  for (const [x, y] of [[70, 74], [52, 46], [84, 58], [68, 30], [46, 28]]) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function rngSemente(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** Cabelo cacheado volumoso: volume de esferas + muitas "molinhas" (anéis) na superfície. */
function criarCabelo() {
  const grupo = new THREE.Group();
  const rnd = rngSemente(42);

  // pontos numa casca elipsoidal em volta da cabeça, descendo até os ombros
  function pontos(qtd, escala) {
    const lista = [];
    for (let i = 0; i < qtd * 3 && lista.length < qtd; i++) {
      const u = rnd() * 2 - 1;
      const th = rnd() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const x = r * Math.cos(th), y = u, z = r * Math.sin(th);
      if (z > 0.1 && y < 0.4 && Math.abs(x) < 0.8) continue; // rosto livre
      if (y < -0.35 && z > -0.25 && Math.abs(x) < 0.62) continue; // pescoço livre
      const ry = y < 0 ? 0.2 : 0.13;
      const rx = 0.13 + (y < 0 ? -y * 0.035 : 0);
      lista.push(new THREE.Vector3(x * rx * escala, y * ry * escala, z * 0.122 * escala));
    }
    return lista;
  }
  const extras = [];
  for (let i = 0; i < 18; i++) { // franja na testa
    const a = Math.PI * (0.1 + 0.8 * (i / 17));
    extras.push(new THREE.Vector3(Math.cos(a) * 0.088, 0.064 + Math.sin(a) * 0.036 + rnd() * 0.01, 0.088 + rnd() * 0.012));
  }
  for (let i = 0; i < 22; i++) { // laterais emoldurando o rosto
    const s = i % 2 ? 1 : -1;
    extras.push(new THREE.Vector3(s * (0.098 + rnd() * 0.035), 0.03 - (i / 22) * 0.22, 0.04 + rnd() * 0.045));
  }

  const q = new THREE.Quaternion();
  const m = new THREE.Matrix4();
  const cor = new THREE.Color();
  const e = new THREE.Euler();

  const base = [...pontos(380, 1), ...extras];
  const esferas = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), mat(0xffffff, { roughness: 0.95 }), base.length);
  base.forEach((p, i) => {
    const r = 0.021 + rnd() * 0.012;
    m.compose(p, q.setFromEuler(e.set(rnd() * 6, rnd() * 6, rnd() * 6)), new THREE.Vector3(r, r * 0.9, r));
    esferas.setMatrixAt(i, m);
    esferas.setColorAt(i, cor.setHex(CORES.cabelo).offsetHSL(0, 0, (rnd() - 0.5) * 0.03));
  });
  esferas.castShadow = true;
  grupo.add(esferas);

  const sup = [...pontos(700, 1.12), ...extras.map((p) => p.clone().multiplyScalar(1.06))];
  const aneis = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.38, 6, 12), mat(0xffffff, { roughness: 0.8 }), sup.length);
  sup.forEach((p, i) => {
    const r = 0.0115 + rnd() * 0.007;
    m.compose(p, q.setFromEuler(e.set(rnd() * 6, rnd() * 6, rnd() * 6)), new THREE.Vector3(r, r, r));
    aneis.setMatrixAt(i, m);
    aneis.setColorAt(i, cor.setHex(rnd() < 0.45 ? CORES.cabeloLuz : CORES.cabelo).offsetHSL(0, 0, (rnd() - 0.3) * 0.05));
  });
  grupo.add(aneis);
  return grupo;
}

function criarRosto(cabeca) {
  const rosto = {};
  const pele = mat(CORES.pele);
  // crânio / rosto
  // formato oval, afinando suavemente em direção ao queixo
  const geoCranio = new THREE.SphereGeometry(1, 48, 36);
  const pos = geoCranio.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < 0) {
      const afinar = 1 - 0.28 * y * y;
      pos.setX(i, pos.getX(i) * afinar);
      pos.setZ(i, pos.getZ(i) * (1 - 0.12 * y * y) + (-y) * 0.12 * Math.max(pos.getZ(i), 0));
    }
  }
  geoCranio.computeVertexNormals();
  const cranio = new THREE.Mesh(geoCranio, pele);
  cranio.scale.set(0.088, 0.114, 0.098);
  cabeca.add(cranio);
  // orelhas
  for (const s of [1, -1]) {
    const o = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), mat(CORES.peleSombra));
    o.scale.set(0.012, 0.024, 0.016);
    o.position.set(s * 0.088, -0.005, 0);
    cabeca.add(o);
    const brinco = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 10, 8), mat(CORES.ouro, { metalness: 0.8, roughness: 0.3 }));
    brinco.position.set(s * 0.09, -0.03, 0.004);
    cabeca.add(brinco);
  }
  // nariz
  const nariz = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mat(CORES.peleSombra));
  nariz.scale.set(0.0095, 0.016, 0.011);
  nariz.position.set(0, -0.02, 0.094);
  cabeca.add(nariz);
  // bochechas rosadas
  for (const s of [1, -1]) {
    const b = new THREE.Mesh(new THREE.CircleGeometry(0.017, 20), mat(0xeb9a8a, { transparent: true, opacity: 0.35 }));
    b.position.set(s * 0.05, -0.035, 0.086);
    b.rotation.y = s * 0.5;
    cabeca.add(b);
  }

  // olhos
  rosto.olhos = [];
  for (const s of [1, -1]) {
    const g = new THREE.Group();
    g.position.set(s * 0.034, 0.012, 0.083);
    const branco = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat(0xffffff, { roughness: 0.3 }));
    branco.scale.set(0.014, 0.009, 0.006);
    g.add(branco);
    const iris = new THREE.Mesh(new THREE.CircleGeometry(0.0068, 20), mat(CORES.iris, { roughness: 0.3 }));
    iris.position.z = 0.0062;
    g.add(iris);
    const pupila = new THREE.Mesh(new THREE.CircleGeometry(0.0032, 16), mat(0x14191a));
    pupila.position.z = 0.0064;
    g.add(pupila);
    const brilho = new THREE.Mesh(new THREE.CircleGeometry(0.0016, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    brilho.position.set(0.0022, 0.0022, 0.0066);
    g.add(brilho);
    // cílios / pálpebra superior
    const cilio = new THREE.Mesh(new THREE.TorusGeometry(0.0145, 0.0014, 6, 20, Math.PI), mat(0x24150e));
    cilio.scale.set(1, 0.72, 1);
    cilio.position.z = 0.003;
    g.add(cilio);
    cabeca.add(g);
    rosto.olhos.push(g);
  }

  // sobrancelhas
  rosto.sobrancelhas = [];
  for (const s of [1, -1]) {
    const sb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0032, 0.026, 4, 8), mat(CORES.sobrancelha));
    sb.rotation.z = Math.PI / 2 + s * 0.12;
    sb.position.set(s * 0.035, 0.044, 0.094);
    cabeca.add(sb);
    rosto.sobrancelhas.push({ mesh: sb, y0: 0.044, s });
  }

  // óculos redondos de aro dourado
  const ouro = mat(CORES.ouro, { metalness: 0.85, roughness: 0.3 });
  for (const s of [1, -1]) {
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0018, 8, 40), ouro);
    aro.scale.set(1.08, 0.95, 1);
    aro.position.set(s * 0.036, 0.01, 0.1);
    cabeca.add(aro);
    const lente = new THREE.Mesh(new THREE.CircleGeometry(0.026, 32),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.05 }));
    lente.scale.copy(aro.scale);
    lente.position.copy(aro.position);
    cabeca.add(lente);
    const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.0014, 0.0014, 0.1, 6), ouro);
    haste.rotation.x = Math.PI / 2;
    haste.position.set(s * 0.086, 0.012, 0.05);
    cabeca.add(haste);
    const lig = new THREE.Mesh(new THREE.CylinderGeometry(0.0014, 0.0014, 0.03, 6), ouro);
    lig.rotation.z = Math.PI / 2;
    lig.position.set(s * 0.072, 0.014, 0.097);
    cabeca.add(lig);
  }
  const ponte = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.0016, 6, 16, Math.PI), ouro);
  ponte.position.set(0, 0.016, 0.103);
  cabeca.add(ponte);

  // boca: sorriso (arco) + abertura (elipse escura que escala com a fala)
  const sorriso = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.0028, 8, 24, Math.PI * 0.75), mat(CORES.boca));
  sorriso.rotation.z = Math.PI + Math.PI * 0.125;
  sorriso.position.set(0, -0.047, 0.094);
  cabeca.add(sorriso);
  const abertura = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), mat(0x7d2f2c));
  abertura.scale.set(0.014, 0.001, 0.008);
  abertura.position.set(0, -0.056, 0.09);
  cabeca.add(abertura);
  rosto.sorriso = sorriso;
  rosto.abertura = abertura;

  // sardas
  const sarda = mat(0xc98c6c, { transparent: true, opacity: 0.6 });
  const rnd = rngSemente(7);
  for (let i = 0; i < 14; i++) {
    const s = i % 2 ? 1 : -1;
    const f = new THREE.Mesh(new THREE.CircleGeometry(0.0013, 6), sarda);
    f.position.set(s * (0.022 + rnd() * 0.03), -0.02 - rnd() * 0.02, 0.093 - rnd() * 0.006);
    f.rotation.y = s * 0.4;
    cabeca.add(f);
  }
  return rosto;
}

/** Adiciona as malhas (corpo, roupa, rosto, cabelo) sobre um esqueleto. */
export function vestirPersonagem({ ossos }) {
  const pele = mat(CORES.pele);
  const blusa = mat(CORES.blusa, { roughness: 0.95 });
  const jeans = mat(CORES.jeans, { roughness: 0.95 });

  // tronco (perfil torneado, achatado na profundidade)
  const perfil = [
    [0.0, -0.17], [0.15, -0.17], [0.155, -0.1], [0.14, 0.0], [0.135, 0.08], [0.15, 0.16],
    [0.165, 0.24], [0.16, 0.3], [0.13, 0.35], [0.07, 0.375], [0.0, 0.38],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const tronco = new THREE.Mesh(new THREE.LatheGeometry(perfil, 40), blusa);
  tronco.scale.set(1, 1, 0.62);
  tronco.position.y = 0.0;
  ossos.spine.add(tronco);
  // nervuras do tricô canelado
  const nervura = new THREE.MeshStandardMaterial({ color: 0x9e5f50, roughness: 1 });
  for (let i = -6; i <= 6; i++) {
    const n = new THREE.Mesh(new THREE.BoxGeometry(0.0015, 0.26, 0.001), nervura);
    n.position.set(i * 0.017, 0.15, 0.094 - Math.abs(i) * 0.0018);
    n.rotation.y = i * 0.04;
    ossos.spine.add(n);
  }
  // ombros com manga curtinha (cava)
  for (const lado of ['left', 'right']) {
    const s = lado === 'left' ? 1 : -1;
    const ombro = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), blusa);
    ombro.scale.set(0.052, 0.04, 0.05);
    ombro.position.set(s * 0.152, 0.165, -0.005);
    ossos.chest.add(ombro);
  }
  // pescoço + gola alta
  const pescoco = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.12, 20), pele);
  pescoco.position.set(0, 0.05, 0);
  ossos.neck.add(pescoco);
  const gola = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.06, 0.075, 28), blusa);
  gola.position.set(0, 0.0, 0);
  ossos.neck.add(gola);
  const golaBorda = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.006, 8, 28), blusa);
  golaBorda.rotation.x = Math.PI / 2;
  golaBorda.position.y = 0.037;
  ossos.neck.add(golaBorda);

  // calça jeans (cintura alta)
  const cintura = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.2, 32), jeans);
  cintura.scale.z = 0.66;
  cintura.position.y = -0.04;
  ossos.hips.add(cintura);
  const cos = new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.008, 8, 40), mat(0x95b5d6));
  cos.scale.set(1, 0.66, 1);
  cos.rotation.x = Math.PI / 2;
  cos.position.y = 0.058;
  ossos.hips.add(cos);
  const botao = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 16), mat(0xd8c39a, { metalness: 0.6, roughness: 0.4 }));
  botao.rotation.x = Math.PI / 2;
  botao.position.set(0, 0.04, 0.103);
  ossos.hips.add(botao);

  // braços
  const tattoo = new THREE.MeshStandardMaterial({ map: texturaTatuagem(), transparent: true, roughness: 0.8 });
  for (const lado of ['left', 'right']) {
    const s = lado === 'left' ? 1 : -1;
    ossos[`${lado}UpperArm`].add(capsula(0.036, MEDIDAS.braco + 0.02, pele));
    ossos[`${lado}LowerArm`].add(capsula(0.03, MEDIDAS.antebraco + 0.01, pele));
    if (lado === 'left') {
      // tatuagem: livro com borboletas, na face externa do antebraço esquerdo
      const t = new THREE.Mesh(new THREE.PlaneGeometry(0.055, 0.055), tattoo);
      t.position.set(0.0215, -0.12, 0.02);
      t.rotation.y = Math.PI / 3.2;
      ossos.leftLowerArm.add(t);
    }
    // palma
    const palma = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.082, 0.024, 2, 2, 2), pele);
    palma.geometry.translate(0, -0.044, 0);
    palma.castShadow = true;
    ossos[`${lado}Hand`].add(palma);
    const punho = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), pele);
    punho.scale.set(1, 0.7, 0.75);
    ossos[`${lado}Hand`].add(punho);
    // base arredondada do polegar (eminência tenar)
    const tenar = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), pele);
    tenar.position.set(s * 0.02, -0.03, 0.006);
    tenar.scale.set(1, 1.2, 0.8);
    ossos[`${lado}Hand`].add(tenar);
    for (const d of DEDOS) {
      const comp = COMP_DEDOS[d];
      const raio = d === 'Thumb' ? 0.0105 : d === 'Little' ? 0.0078 : 0.0088;
      FALANGES.forEach((f, i) => {
        ossos[`${lado}${d}${f}`].add(capsula(raio * (1 - i * 0.06), comp[i] + raio * 0.6, pele));
      });
    }
    if (lado === 'left') {
      // aliança dourada (como na foto)
      const anel = new THREE.Mesh(new THREE.TorusGeometry(0.0095, 0.0018, 8, 20), mat(CORES.ouro, { metalness: 0.9, roughness: 0.25 }));
      anel.rotation.x = Math.PI / 2;
      anel.position.y = -0.016;
      ossos.leftRingProximal.add(anel);
    }
  }

  // cabeça
  const cabecaGrupo = new THREE.Group();
  cabecaGrupo.position.set(0, 0.085, 0.01);
  ossos.head.add(cabecaGrupo);
  const rosto = criarRosto(cabecaGrupo);
  const cabelo = criarCabelo();
  cabelo.position.set(0, 0.012, -0.012);
  cabecaGrupo.add(cabelo);
  return rosto;
}
