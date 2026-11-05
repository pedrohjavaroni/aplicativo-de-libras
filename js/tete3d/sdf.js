// Campos de distância com sinal (SDF) para esculpir a Teté como "argila
// digital": formas simples unidas suavemente (smin) viram superfícies
// orgânicas contínuas — a base do visual de animação.
// Funções com números soltos (sem alocação) para serem rápidas.

export const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);

export function esfera(px, py, pz, c, r) {
  return len3(px - c[0], py - c[1], pz - c[2]) - r;
}

/** Elipsoide (aproximação de Inigo Quilez). */
export function elipsoide(px, py, pz, c, r) {
  const x = (px - c[0]) / r[0], y = (py - c[1]) / r[1], z = (pz - c[2]) / r[2];
  const k0 = Math.sqrt(x * x + y * y + z * z);
  const k1 = Math.sqrt((x * x) / (r[0] * r[0]) + (y * y) / (r[1] * r[1]) + (z * z) / (r[2] * r[2]));
  return k1 === 0 ? -Math.min(r[0], r[1], r[2]) : (k0 * (k0 - 1)) / k1;
}

/** Cone de pontas arredondadas entre a (raio r1) e b (raio r2). */
export function cone(px, py, pz, a, b, r1, r2) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const pax = px - a[0], pay = py - a[1], paz = pz - a[2];
  const y = pax * bax + pay * bay + paz * baz;
  const z = y - l2;
  const xx = pax * l2 - bax * y, xy = pay * l2 - bay * y, xz = paz * l2 - baz * y;
  const x2 = xx * xx + xy * xy + xz * xz;
  const y2 = y * y * l2;
  const z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

/** Caixa arredondada centrada na origem (meias-dimensões h, raio r). */
export function caixa(px, py, pz, h, r) {
  const qx = Math.abs(px) - h[0] + r, qy = Math.abs(py) - h[1] + r, qz = Math.abs(pz) - h[2] + r;
  return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}

/** Toro horizontal (eixo Y) com seção elíptica no plano XZ (escala em z). */
export function toro(px, py, pz, c, R, r, ez = 1) {
  const x = px - c[0], y = py - c[1], z = (pz - c[2]) / ez;
  const q = Math.sqrt(x * x + z * z) - R;
  return Math.sqrt(q * q + y * y) - r;
}

/** União suave. */
export function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
/** Interseção suave. */
export const smax = (a, b, k) => -smin(-a, -b, k);
/** Subtração suave (a − b). */
export const ssub = (a, b, k) => smax(a, -b, k);

export const suave = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Matriz 4x4 (column-major, como no three.js) aplicada a um ponto. */
export function aplicar(m, x, y, z) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

/** Gradiente numérico (normal da superfície). */
export function normal(sdf, x, y, z, e = 0.0005) {
  const nx = sdf(x + e, y, z) - sdf(x - e, y, z);
  const ny = sdf(x, y + e, z) - sdf(x, y - e, z);
  const nz = sdf(x, y, z + e) - sdf(x, y, z - e);
  const l = len3(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}

/** Gerador pseudoaleatório determinístico. */
export function aleatorio(semente = 1) {
  let s = semente % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
