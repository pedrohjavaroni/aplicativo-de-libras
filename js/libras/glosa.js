// Português → sequência de glosas (sinais) de Libras.
//
// A Libras tem gramática própria: não usa artigos nem a maioria das
// preposições, e os verbos aparecem no infinitivo. Esta conversão é
// simplificada (baseada em dicionário + regras) e cobre frases do dia a dia.
// Palavras sem sinal conhecido são soletradas (datilologia).

export function normalizar(txt) {
  return txt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u0326\u0328-\u036f]/g, '') // remove acentos, mantém o ç
    .normalize('NFC')
    .replace(/[^a-zç0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const DESCARTAR = new Set([
  'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das',
  'no', 'na', 'nos', 'nas', 'em', 'ao', 'aos', 'à', 'pelo', 'pela', 'e', 'que', 'é', 'e',
  'por', 'pra', 'pro', 'para', 'com', 'se', 'lhe', 'me', 'te', 'ser', 'sou', 'esta', 'estou', 'está', 'tá', 'ta',
]);

/**
 * @param {string} texto frase em português
 * @param {Array} dicionario entradas { id, glosa, palavras: [...] }
 * @returns {Array<{tipo: 'sinal'|'datilologia', id?, glosa, texto}>}
 */
export function paraGlosas(texto, dicionario) {
  // índice: expressão normalizada → entrada (expressões com várias palavras primeiro)
  const indice = new Map();
  for (const e of dicionario) for (const p of e.palavras) indice.set(normalizar(p), e);
  const maxPalavras = Math.max(1, ...[...indice.keys()].map((k) => k.split(' ').length));

  const palavras = normalizar(texto).split(' ').filter(Boolean);
  const saida = [];
  let i = 0;
  while (i < palavras.length) {
    let achou = null;
    for (let n = Math.min(maxPalavras, palavras.length - i); n >= 1 && !achou; n--) {
      const expr = palavras.slice(i, i + n).join(' ');
      if (indice.has(expr)) achou = { e: indice.get(expr), n, expr };
    }
    if (achou) {
      saida.push({ tipo: 'sinal', id: achou.e.id, glosa: achou.e.glosa, texto: achou.expr });
      i += achou.n;
      continue;
    }
    const p = palavras[i];
    if (!DESCARTAR.has(p)) {
      saida.push({ tipo: 'datilologia', glosa: p.toUpperCase(), texto: p });
    }
    i++;
  }
  return saida;
}
