// Rosto da Teté: olhos, pálpebras, cílios, sobrancelhas, lábios e óculos.
// Tudo no espaço do osso "head", em coordenadas da escultura-base (o grupo é
// escalado por CABECA.escala). Lábios e sobrancelhas são assentados sobre a
// superfície esculpida (sdfCabeca) para acompanhar as curvas do rosto.

import * as THREE from '../vendor/three.module.min.js';
import { sdfCabeca, CABECA } from './escultura.js';
import { textura } from './materiais.js';
import { aleatorio } from './sdf.js';

const K = CABECA.escala;
const gauss = (d, s) => Math.exp(-(d * d) / (2 * s * s));

/** z da superfície do rosto (coordenadas-base) para (x, y), com cache. */
function superficie() {
  const cache = new Map();
  return (x, y) => {
    const ch = `${Math.round(x * 5000)}|${Math.round(y * 5000)}`;
    let z = cache.get(ch);
    if (z !== undefined) return z;
    z = 0.2;
    for (let i = 0; i < 80; i++) {
      const d = sdfCabeca(x * K, y * K, z * K) / K;
      z -= d;
      if (Math.abs(d) < 0.00003 || z < -0.1) break;
    }
    cache.set(ch, z);
    return z;
  };
}

function projetar(geo, zEm, off) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, zEm(x, y) + (typeof off === 'function' ? off(x, y) : off));
  }
  geo.computeVertexNormals();
  return geo;
}

function texturaIris() {
  return textura(512, (g, t) => {
    const c = t / 2, r = t * 0.46;
    g.fillStyle = '#fbf6f1'; g.fillRect(0, 0, t, t);
    const base = g.createRadialGradient(c, c, r * 0.15, c, c, r);
    base.addColorStop(0, '#d2a35c');
    base.addColorStop(0.3, '#a8a36e');
    base.addColorStop(0.5, '#86a397');
    base.addColorStop(0.85, '#5f7d73');
    base.addColorStop(1, '#2b3a36');
    g.fillStyle = base; g.beginPath(); g.arc(c, c, r, 0, 7); g.fill();
    const rnd = aleatorio(5);
    for (let i = 0; i < 520; i++) {
      const a = rnd() * Math.PI * 2;
      g.strokeStyle = rnd() < 0.5 ? 'rgba(230,240,225,.22)' : 'rgba(35,55,50,.28)';
      g.lineWidth = 0.8 + rnd() * 1.8;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * r * 0.3, c + Math.sin(a) * r * 0.3);
      g.lineTo(c + Math.cos(a) * r * (0.7 + rnd() * 0.25), c + Math.sin(a) * r * (0.7 + rnd() * 0.25));
      g.stroke();
    }
    g.fillStyle = '#0b0d0c'; g.beginPath(); g.arc(c, c, r * 0.34, 0, 7); g.fill();
    g.strokeStyle = 'rgba(20,28,26,.9)'; g.lineWidth = t * 0.035; g.beginPath(); g.arc(c, c, r * 0.98, 0, 7); g.stroke();
  });
}

// ----------------------------------------------------------------- olhos ---

function criarOlho(mat, s, iris) {
  const R = 0.0172;
  const c = [s * 0.036, 0.123, 0.074];
  const grupo = new THREE.Group();
  grupo.position.set(...c);

  const geo = new THREE.SphereGeometry(R, 48, 32);
  const uv = geo.attributes.uv, p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { // íris mapeada de frente (projeção planar)
    const frente = p.getZ(i) > 0;
    uv.setXY(i, frente ? 0.5 + (p.getX(i) / R) * 0.45 : 0.03, frente ? 0.5 + (p.getY(i) / R) * 0.45 : 0.03);
  }
  const giro = new THREE.Group();
  giro.add(new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map: iris, roughness: 0.4 })));
  // córnea: bolha transparente e brilhante na frente da íris
  const cornea = new THREE.Mesh(new THREE.SphereGeometry(R * 0.55, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, roughness: 0, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 2.5, depthWrite: false }));
  cornea.rotation.x = Math.PI / 2;
  cornea.position.z = R * 0.84;
  cornea.scale.set(1, 0.42, 1);
  giro.add(cornea);
  // brilho do olhar (catchlight)
  const brilho = new THREE.Mesh(new THREE.CircleGeometry(R * 0.13, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
  brilho.position.set(R * 0.22, R * 0.26, R * 1.075);
  giro.add(brilho);
  grupo.add(giro);

  // pálpebra superior (casca de pele que desce para piscar) + cílios
  const Rp = R * 1.07, th = Math.PI * 0.42;
  const sup = new THREE.Group();
  sup.add(new THREE.Mesh(new THREE.SphereGeometry(Rp, 48, 20, 0, Math.PI * 2, 0, th), mat.pele));
  const rB = Rp * Math.sin(th), yB = Rp * Math.cos(th);
  const borda = new THREE.Mesh(new THREE.TorusGeometry(rB, 0.00078, 8, 48, Math.PI), mat.cilios);
  borda.rotation.x = Math.PI / 2;
  borda.position.y = yB;
  sup.add(borda);
  for (let k = 0; k < 13; k++) {
    const t = k / 12;
    const ang = Math.PI * (s > 0 ? 0.62 - 0.56 * t : 0.38 + 0.56 * t);
    const fio = new THREE.Mesh(new THREE.ConeGeometry(0.0004, 0.0024 + 0.0024 * t * t, 4), mat.cilios);
    fio.position.set(Math.cos(ang) * rB * 1.01, yB + 0.0004, Math.sin(ang) * rB * 1.01);
    fio.rotation.set(1.05, 0, -s * 0.5 * t);
    sup.add(fio);
  }
  grupo.add(sup);
  const inf = new THREE.Mesh(new THREE.SphereGeometry(R * 1.05, 48, 10, 0, Math.PI * 2, Math.PI * 0.82, Math.PI * 0.18), mat.pele);
  grupo.add(inf);

  return {
    grupo,
    atualizar(fechar, sorriso, sobr, ox, oy) {
      sup.rotation.x = -0.4 + fechar * 1.45 + sorriso * 0.04 - sobr * 0.08;
      inf.rotation.x = -sorriso * 0.14 - fechar * 0.06;
      giro.rotation.set(-oy * 0.25, ox * 0.35, 0);
    },
  };
}

// ---------------------------------------------------------- sobrancelhas ---

function criarSobrancelha(mat, s, zEm) {
  const forma = new THREE.Shape();
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const x = 0.0135 + 0.043 * t;
    const y = 0.1505 + 0.0075 * Math.sin(Math.PI * Math.min(t / 0.62, 1) * 0.5) - (t > 0.62 ? 0.0075 * ((t - 0.62) / 0.38) ** 1.4 : 0);
    const e = 0.0028 * (1 - t) + 0.0012 * t + 0.0011 * Math.sin(Math.PI * t);
    pts.push([x, y, e]);
  }
  forma.moveTo(pts[0][0], pts[0][1] - pts[0][2] / 2);
  for (const [x, y, e] of pts) forma.lineTo(x, y + e / 2);
  for (const [x, y, e] of [...pts].reverse()) forma.lineTo(x, y - e / 2);
  const g = new THREE.ShapeGeometry(forma, 8);
  if (s < 0) g.scale(-1, 1, 1);
  return new THREE.Mesh(projetar(g, zEm, (x) => 0.0012 + 0.0006 * (1 - Math.abs(Math.abs(x) - 0.035) / 0.03)), mat.sobrancelha);
}

// ------------------------------------------------------------------ boca ---

function criarBoca(mat, zEm) {
  const grupo = new THREE.Group();
  const m = {
    interior: new THREE.Mesh(new THREE.BufferGeometry(), mat.boca),
    dentes: new THREE.Mesh(new THREE.BufferGeometry(), mat.dentes),
    sup: new THREE.Mesh(new THREE.BufferGeometry(), mat.labios),
    inf: new THREE.Mesh(new THREE.BufferGeometry(), mat.labios),
  };
  m.sup.material = mat.labios.clone();
  m.sup.material.color.offsetHSL(0, 0.02, -0.06); // lábio superior um pouco mais escuro
  Object.values(m).forEach((x, i) => { x.renderOrder = i; grupo.add(x); });
  const YM = 0.063;
  let ultimo = '';
  const curva = (fn, a, b, n = 30) => Array.from({ length: n + 1 }, (_, i) => { const x = a + ((b - a) * i) / n; return new THREE.Vector2(x, fn(x)); });
  const geo = (pts, off) => projetar(new THREE.ShapeGeometry(new THREE.Shape(pts), 1), zEm, off);

  return {
    grupo,
    atualizar(sorriso, abre) {
      const ch = `${sorriso.toFixed(2)}|${abre.toFixed(2)}`;
      if (ch === ultimo) return;
      ultimo = ch;
      const w = 0.0172 + sorriso * 0.0032 - abre * 0.002;
      const yc = YM + 0.0008 + sorriso * 0.005;
      const ab = abre * 0.012;
      const n = (x) => x / w;
      const lS = (x) => YM + ab * 0.22 * (1 - n(x) ** 2) + (yc - YM) * n(x) ** 2;
      const lI = (x) => YM - ab * Math.max(0, 1 - n(x) ** 2) ** 0.8 + (yc - YM) * n(x) ** 2;
      const topo = (x) => {
        const a = Math.abs(n(x));
        return lS(x) + (0.0044 * Math.max(0, 1 - a ** 2.2) + 0.0013 * gauss(a - 0.3, 0.12) - 0.0012 * gauss(a, 0.065)) * (1 - sorriso * 0.2);
      };
      const base = (x) => lI(x) - 0.0058 * Math.max(0, 1 - Math.abs(n(x)) ** 1.8) * (1 - sorriso * 0.12);
      const vol = (k) => (x) => 0.0009 + k * Math.max(0, 1 - Math.abs(n(x)) ** 2);
      for (const x of Object.values(m)) x.geometry.dispose();
      m.sup.geometry = geo([...curva(topo, -w, w), ...curva(lS, w, -w)], vol(0.0019));
      m.inf.geometry = geo([...curva(lI, -w, w), ...curva(base, w, -w)], vol(0.0024));
      const lInt = (x) => Math.min(lI(x), lS(x) - 0.0005);
      m.interior.geometry = geo([...curva(lS, -w * 1.01, w * 1.01), ...curva(lInt, w * 1.01, -w * 1.01)], 0.0004);
      const wd = w * 0.6;
      m.dentes.visible = abre > 0.12;
      m.dentes.geometry = geo([...curva((x) => lS(x) + 0.0003, -wd, wd), ...curva((x) => lS(x) - Math.min(ab * 0.45, 0.0034) * Math.max(0, 1 - (x / wd) ** 4), wd, -wd)], 0.0007);
    },
  };
}

// ----------------------------------------------------------------- óculos --

function criarOculos(mat, zEm) {
  const g = new THREE.Group();
  const r = 0.0262;
  const zL = 0.072 + 0.0195 + 0.0105; // na frente da córnea
  for (const s of [1, -1]) {
    const cx = s * 0.0372, cy = 0.1235;
    const aro = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0013, 12, 72), mat.ouro);
    aro.position.set(cx, cy, zL);
    aro.rotation.y = s * 0.1;
    g.add(aro);
    const lente = new THREE.Mesh(new THREE.CircleGeometry(r, 48), mat.lente);
    lente.position.copy(aro.position); lente.rotation.copy(aro.rotation);
    g.add(lente);
    const plaqueta = new THREE.Mesh(new THREE.SphereGeometry(0.0024, 10, 8), mat.lente);
    plaqueta.scale.set(0.5, 1, 0.8);
    plaqueta.position.set(s * 0.0092, 0.116, zEm(s * 0.0092, 0.116) + 0.0012);
    g.add(plaqueta);
    const haste = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx + s * r * 0.99, cy + 0.002, zL - 0.002),
      new THREE.Vector3(s * 0.087, cy + 0.004, zL - 0.024),
      new THREE.Vector3(s * 0.092, cy + 0.004, -0.0)]), 20, 0.0012, 6), mat.ouro);
    g.add(haste);
  }
  const ponte = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.0112, 0.1305, zL), new THREE.Vector3(0, 0.1345, zL + 0.004), new THREE.Vector3(0.0112, 0.1305, zL)]), 16, 0.0011, 6), mat.ouro);
  g.add(ponte);
  return g;
}

// ------------------------------------------------------------------ montar -

export function criarRosto(cabeca, mat) {
  const zEm = superficie();
  const grupo = new THREE.Group();
  grupo.scale.setScalar(K);
  cabeca.add(grupo);
  const iris = texturaIris();
  const olhos = [criarOlho(mat, 1, iris), criarOlho(mat, -1, iris)];
  olhos.forEach((o) => grupo.add(o.grupo));
  const sobrancelhas = new THREE.Group();
  sobrancelhas.add(criarSobrancelha(mat, 1, zEm), criarSobrancelha(mat, -1, zEm));
  grupo.add(sobrancelhas);
  const boca = criarBoca(mat, zEm);
  grupo.add(boca.grupo);
  grupo.add(criarOculos(mat, zEm));
  grupo.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });

  return {
    /** Atualiza a expressão a partir do estado do motor. */
    atualizar(r) {
      const sorriso = THREE.MathUtils.clamp(r.sorriso, 0, 1);
      boca.atualizar(sorriso, THREE.MathUtils.clamp(r.boca, 0, 1));
      for (const o of olhos) o.atualizar(THREE.MathUtils.clamp(r.fechar ?? 0, 0, 1), sorriso, r.sobrancelha, r.olharX, r.olharY);
      sobrancelhas.position.y = r.sobrancelha * 0.004;
      sobrancelhas.position.z = r.sobrancelha * 0.0008;
    },
  };
}
