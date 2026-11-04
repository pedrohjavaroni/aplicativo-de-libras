// Voz: síntese (texto → fala) e reconhecimento (fala → texto) em pt-BR,
// usando as APIs nativas do navegador (funcionam offline em muitos aparelhos).

let vozEscolhida = null;

function escolherVoz() {
  const vozes = speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('pt'));
  // prefere pt-BR e vozes femininas conhecidas (combina com a personagem)
  const preferidas = ['Luciana', 'Francisca', 'Google português do Brasil', 'Maria', 'Thalita'];
  vozEscolhida =
    vozes.find((v) => v.lang === 'pt-BR' && preferidas.some((p) => v.name.includes(p))) ||
    vozes.find((v) => v.lang === 'pt-BR') ||
    vozes[0] ||
    null;
}
if ('speechSynthesis' in window) {
  escolherVoz();
  speechSynthesis.onvoiceschanged = escolherVoz;
}

export function falar(texto, { aoIniciar, aoTerminar } = {}) {
  if (!('speechSynthesis' in window) || !texto) { aoTerminar?.(); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = 'pt-BR';
  if (vozEscolhida) u.voice = vozEscolhida;
  u.rate = 1;
  u.onstart = () => aoIniciar?.();
  u.onend = u.onerror = () => aoTerminar?.();
  speechSynthesis.speak(u);
}

export const reconhecimentoDisponivel = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

/** Cria um ouvinte contínuo. Retorna { iniciar, parar, ativo } */
export function criarOuvinte({ aoParcial, aoFinal, aoMudarEstado, aoErro }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = 'pt-BR';
  rec.continuous = true;
  rec.interimResults = true;
  let querAtivo = false;

  rec.onresult = (ev) => {
    let parcial = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) aoFinal?.(r[0].transcript.trim());
      else parcial += r[0].transcript;
    }
    aoParcial?.(parcial);
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') querAtivo = false;
    aoErro?.(e.error);
  };
  rec.onend = () => {
    // o navegador encerra sozinho após silêncio: reinicia se ainda queremos ouvir
    if (querAtivo) { try { rec.start(); } catch { /* já iniciado */ } } else aoMudarEstado?.(false);
  };
  return {
    iniciar() { querAtivo = true; try { rec.start(); } catch { /* já iniciado */ } aoMudarEstado?.(true); },
    parar() { querAtivo = false; rec.stop(); },
    get ativo() { return querAtivo; },
  };
}
