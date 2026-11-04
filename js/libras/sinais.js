// Banco de sinais: dicionário (dados/dicionario.json) + animações capturadas
// dos vídeos da modelo (dados/sinais/<id>.json ou salvas neste aparelho).

import { clipDatilologia, sinaisProcedurais } from '../avatar3d/solver.js';
import { paraGlosas } from './glosa.js';

const CHAVE_LOCAL = 'libras-animacoes-v1';
const procedurais = sinaisProcedurais();
let dicionario = [];
const cacheAnim = new Map();

export async function carregarDicionario() {
  const r = await fetch('dados/dicionario.json');
  dicionario = (await r.json()).sinais;
  return dicionario;
}
export const obterDicionario = () => dicionario;

// --------------------------------------- animações salvas neste aparelho --
export function animacoesLocais() {
  try { return JSON.parse(localStorage.getItem(CHAVE_LOCAL) || '{}'); } catch { return {}; }
}
export function salvarAnimacaoLocal(anim) {
  const todas = animacoesLocais();
  todas[anim.id] = anim;
  localStorage.setItem(CHAVE_LOCAL, JSON.stringify(todas));
  cacheAnim.set(anim.id, anim);
  // garante que a palavra aponte para o sinal
  if (!dicionario.some((e) => e.id === anim.id)) {
    dicionario.push({ id: anim.id, glosa: anim.glosa, palavras: anim.palavras?.length ? anim.palavras : [anim.glosa.toLowerCase()] });
  }
}
export function removerAnimacaoLocal(id) {
  const todas = animacoesLocais();
  delete todas[id];
  localStorage.setItem(CHAVE_LOCAL, JSON.stringify(todas));
  cacheAnim.delete(id);
}

/** Integra ao dicionário os sinais capturados localmente (com suas palavras). */
export function mesclarLocais() {
  for (const anim of Object.values(animacoesLocais())) {
    const e = dicionario.find((x) => x.id === anim.id);
    if (e) { for (const p of anim.palavras || []) if (!e.palavras.includes(p)) e.palavras.push(p); }
    else dicionario.push({ id: anim.id, glosa: anim.glosa, palavras: anim.palavras?.length ? anim.palavras : [anim.glosa.toLowerCase()] });
  }
}

async function buscarAnimacao(id) {
  if (cacheAnim.has(id)) return cacheAnim.get(id);
  const local = animacoesLocais()[id];
  if (local) { cacheAnim.set(id, local); return local; }
  const entrada = dicionario.find((e) => e.id === id);
  if (entrada?.animacao) {
    try {
      const r = await fetch(entrada.animacao);
      if (r.ok) { const a = await r.json(); cacheAnim.set(id, a); return a; }
    } catch { /* sem rede */ }
  }
  cacheAnim.set(id, null);
  return null;
}

/** Converte a animação capturada (lista de quadros a N fps) em clipe tocável. */
export function animacaoParaClipe(anim) {
  const fps = anim.fps || 15;
  const atraso = 0.2;
  return {
    nome: anim.glosa,
    quadros: anim.quadros.map((q, i) => ({ t: atraso + i / fps, q: q.q, rosto: q.rosto })),
    marcas: [{ t: 0, texto: anim.glosa }],
    tipo: 'capturado',
  };
}

/** Uma letra capturada ("letra-a") substitui a versão procedural na datilologia. */
async function clipeSoletrar(palavra) {
  const letras = [...palavra.toUpperCase()];
  const capturadas = await Promise.all(letras.map((l) => buscarAnimacao(`letra-${l.toLowerCase()}`)));
  if (!capturadas.some(Boolean)) return [clipDatilologia(palavra)];
  // mistura: trechos procedurais + letras capturadas
  const clipes = [];
  let trecho = '';
  letras.forEach((l, i) => {
    if (capturadas[i]) {
      if (trecho) { clipes.push(clipDatilologia(trecho)); trecho = ''; }
      const c = animacaoParaClipe(capturadas[i]);
      c.marcas = [{ t: 0, texto: l }];
      clipes.push(c);
    } else trecho += l;
  });
  if (trecho) clipes.push(clipDatilologia(trecho));
  return clipes;
}

/**
 * Texto em português → lista de { glosa, tipo, clipes[] } prontos para o avatar.
 */
export async function traduzir(texto) {
  const glosas = paraGlosas(texto, dicionario);
  const itens = [];
  for (const g of glosas) {
    let clipes = null;
    let tipo = g.tipo;
    if (g.tipo === 'sinal') {
      const anim = await buscarAnimacao(g.id);
      const entrada = dicionario.find((e) => e.id === g.id);
      if (anim) { clipes = [animacaoParaClipe(anim)]; tipo = 'capturado'; }
      else if (entrada?.procedural && procedurais[entrada.procedural]) {
        const c = procedurais[entrada.procedural]();
        Object.assign(c, { nome: entrada.glosa, tipo: 'procedural' });
        clipes = [c];
        tipo = 'procedural';
      }
      else { clipes = await clipeSoletrar(g.glosa.replace(/-/g, '')); tipo = 'pendente'; }
    } else {
      clipes = await clipeSoletrar(g.glosa);
    }
    itens.push({ ...g, tipo, clipes });
  }
  return itens;
}
