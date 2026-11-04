import { criarAvatar3D } from './avatar3d/avatar.js';
import { falar, criarOuvinte, reconhecimentoDisponivel } from './libras/fala.js';
import { carregarDicionario, mesclarLocais, obterDicionario, traduzir } from './libras/sinais.js';
import {
  criarDetector, criarLaco, carregarModelo, salvarModelo, importarModelo, limiar,
} from './libras/reconhecedor.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

// ------------------------------------------------------------- Lia --------
const balao = $('#balao');
const letreiro = $('#letreiro');
let timerBalao;
function dizer(texto, { ms = 5000, voz = false } = {}) {
  balao.textContent = texto;
  balao.classList.remove('oculto');
  clearTimeout(timerBalao);
  if (ms) timerBalao = setTimeout(() => balao.classList.add('oculto'), ms);
  if (voz) falarComLia(texto);
}

let glosaAtualEl = null;
const lia = criarAvatar3D($('#avatar'), {
  aoMarcar(ev) {
    if (ev.tipo === 'inicio') {
      const el = ev.clip._chip;
      glosaAtualEl?.classList.remove('atual');
      if (el) { el.classList.add('atual'); glosaAtualEl = el; }
      if (ev.clip.tipo !== 'datilologia' && ev.clip.tipo) mostrarLetreiro(ev.clip.nome);
    } else if (ev.tipo === 'marca' && ev.clip.tipo === 'datilologia') {
      mostrarLetreiro(ev.marca.texto, ev.clip.nome.replace('datilologia:', ''));
    } else if (ev.tipo === 'ocioso') {
      letreiro.hidden = true;
      glosaAtualEl?.classList.remove('atual');
    }
  },
});

function mostrarLetreiro(texto, sub) {
  letreiro.hidden = false;
  letreiro.innerHTML = '';
  letreiro.append(texto);
  if (sub) { const s = document.createElement('small'); s.textContent = sub; letreiro.append(s); }
  letreiro.style.fontSize = texto.length > 3 ? '1.3rem' : '';
}

function falarComLia(texto) {
  falar(texto, { aoIniciar: () => lia.falando(true), aoTerminar: () => lia.falando(false) });
}

const DICAS = [
  'Toque em “Ouvir alguém” e eu traduzo a fala para Libras.',
  'Na aba Libras→Voz eu leio seus sinais pela câmera e falo em voz alta.',
  'Você pode me ensinar novos sinais na aba Treinar!',
  'Quando eu ainda não sei um sinal, eu soletro a palavra no alfabeto manual.',
];
let dica = 0;
$('#avatar').addEventListener('click', () => {
  lia.gesto('explicar');
  dizer(DICAS[dica++ % DICAS.length]);
});

let vel = 1;
$('#btnVelocidade').addEventListener('click', (e) => {
  vel = vel === 1 ? 0.7 : vel === 0.7 ? 1.3 : 1;
  lia.velocidade(vel);
  e.currentTarget.textContent = `${vel}×`;
  dizer(vel < 1 ? 'Vou sinalizar mais devagar.' : vel > 1 ? 'Vou sinalizar mais rápido.' : 'Velocidade normal.', { ms: 2000 });
});
$('#btnPararAvatar').addEventListener('click', () => lia.parar());

// --------------------------------------------------------- navegação ------
const principal = $('#principal');
let ouvinte = null; // reconhecimento de voz (definido mais abaixo)
function irPara(tela) {
  principal.dataset.tela = tela;
  $$('.tela').forEach((t) => t.classList.toggle('ativa', t.id === `tela-${tela}`));
  $$('nav.abas button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.ir === tela)));
  if (tela !== 'voz' && ouvinte?.ativo) ouvinte.parar();
  const falas = {
    voz: ['Quando a pessoa falar, eu mostro em Libras.', 'ouvir'],
    libras: ['Pode sinalizar! Eu falo em voz alta para a pessoa ouvinte.', 'explicar'],
    treinar: ['Me ensine sinais: grave alguns exemplos de cada um.', 'explicar'],
  };
  if (falas[tela]) { dizer(falas[tela][0]); lia.gesto(falas[tela][1]); }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
$$('[data-ir]').forEach((b) => b.addEventListener('click', () => irPara(b.dataset.ir)));
irPara('inicio');

// ---------------------------------------------------- frases rápidas -----
const FRASES = [
  'Olá! Eu sou surdo(a). Podemos conversar por aqui?',
  'Pode falar devagar, por favor?',
  'Pode repetir, por favor?',
  'Pode escrever, por favor?',
  'Obrigado(a)!',
  'Onde fica o banheiro?',
  'Preciso de ajuda.',
  'Estou sentindo dor.',
  'Preciso de um médico.',
  'Quanto custa?',
  'Sim.',
  'Não.',
];
for (const f of FRASES) {
  const b = document.createElement('button');
  b.className = 'btn';
  b.textContent = f;
  b.addEventListener('click', () => {
    const texto = f.replace(/\((a|o)\)/g, '');
    falarComLia(texto);
    lia.gesto('explicar');
    dizer(`🔊 “${texto}”`, { ms: 4000 });
  });
  $('#frasesRapidas').append(b);
}

// ------------------------------------------------------ voz → libras -----
const transcricao = $('#transcricao');
const glosasEl = $('#glosas');
let ultimoTexto = '';

async function sinalizarTexto(texto) {
  if (!texto.trim()) return;
  ultimoTexto = texto;
  lia.parar();
  const itens = await traduzir(texto);
  glosasEl.innerHTML = '';
  for (const it of itens) {
    const chip = document.createElement('span');
    chip.className = `glosa ${it.tipo}`;
    chip.textContent = it.glosa;
    chip.title = { capturado: 'Sinal', procedural: 'Sinal', pendente: 'Sinal ainda não capturado — soletrado', datilologia: 'Soletrado (datilologia)' }[it.tipo];
    glosasEl.append(chip);
    for (const c of it.clipes) { c._chip = chip; lia.tocar(c); }
  }
}

const btnOuvir = $('#btnOuvir');
if (!reconhecimentoDisponivel) {
  $('#avisoFala').hidden = false;
  btnOuvir.disabled = true;
} else {
  let finalAcumulado = '';
  ouvinte = criarOuvinte({
    aoParcial(p) {
      transcricao.innerHTML = '';
      transcricao.append(finalAcumulado);
      const s = document.createElement('span');
      s.className = 'interim';
      s.textContent = (finalAcumulado ? ' ' : '') + p;
      transcricao.append(s);
    },
    aoFinal(txt) {
      finalAcumulado = txt;
      transcricao.textContent = txt;
      sinalizarTexto(txt);
    },
    aoMudarEstado(ativo) {
      btnOuvir.classList.toggle('gravando', ativo);
      btnOuvir.textContent = ativo ? '⏹ Parar de ouvir' : '🎤 Começar a ouvir';
      if (ativo) { lia.gesto('ouvir'); dizer('Estou ouvindo…', { ms: 0 }); } else dizer('Parei de ouvir.', { ms: 2000 });
    },
    aoErro(e) {
      if (e === 'not-allowed') dizer('Preciso de permissão para usar o microfone.');
      else if (e === 'no-speech') { /* silêncio: segue ouvindo */ } else dizer(`Problema no microfone (${e}).`);
    },
  });
  btnOuvir.addEventListener('click', () => (ouvinte.ativo ? ouvinte.parar() : ouvinte.iniciar()));
}
$('#btnTraduzirTexto').addEventListener('click', () => {
  const t = $('#textoDigitado').value;
  transcricao.textContent = t;
  sinalizarTexto(t);
});
$('#btnRepetir').addEventListener('click', () => sinalizarTexto(ultimoTexto));

// ------------------------------------------------------ libras → voz -----
let modelo = carregarModelo();
modelo._limiar = limiar(modelo);
const camVideo = $('#camVideo');
const camCanvas = $('#camCanvas');
const camStatus = $('#camStatus');
let laco = null;
let stream = null;
const frase = [];

function atualizarFrase() {
  const el = $('#fraseMontada');
  el.innerHTML = '';
  if (!frase.length) el.innerHTML = '<span class="muted">Os sinais aparecem aqui…</span>';
  else el.textContent = frase.join(' ');
}
function textoParaFala(sinal) {
  return sinal.toLowerCase().replace(/-/g, ' ');
}

const CONEXOES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
function desenhar(det) {
  const ctx = camCanvas.getContext('2d');
  camCanvas.width = camVideo.videoWidth; camCanvas.height = camVideo.videoHeight;
  ctx.clearRect(0, 0, camCanvas.width, camCanvas.height);
  ctx.lineWidth = 3;
  for (const mao of det.maos?.landmarks || []) {
    ctx.strokeStyle = '#ffd7cc'; ctx.fillStyle = '#b8786a';
    for (const [a, b] of CONEXOES) {
      ctx.beginPath();
      ctx.moveTo(mao[a].x * camCanvas.width, mao[a].y * camCanvas.height);
      ctx.lineTo(mao[b].x * camCanvas.width, mao[b].y * camCanvas.height);
      ctx.stroke();
    }
    for (const p of mao) { ctx.beginPath(); ctx.arc(p.x * camCanvas.width, p.y * camCanvas.height, 4, 0, 7); ctx.fill(); }
  }
}

async function ligarCamera() {
  if (stream) return;
  try {
    camStatus.textContent = 'abrindo câmera…';
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false });
    camVideo.srcObject = stream;
    await camVideo.play();
    $('#camPlaceholder').hidden = true;
    $$('[data-acao="camera"]').forEach((b) => { b.textContent = '📷 Desligar câmera'; });
    camStatus.textContent = 'carregando detector de mãos…';
    const detector = await criarDetector();
    laco = criarLaco({
      detector, video: camVideo, obterModelo: () => modelo,
      aoQuadro(det, temMao) { desenhar(det); camStatus.textContent = temMao ? '✋ mãos detectadas' : 'mostre as mãos'; },
      aoSinal(r) {
        $('#reconhecido').textContent = r.nome;
        frase.push(r.nome);
        atualizarFrase();
        if ($('#falaAutomatica').checked) falarComLia(textoParaFala(r.nome));
        dizer(`Você sinalizou: ${r.nome}`, { ms: 2500 });
      },
    });
    laco.iniciar();
    $('#avisoTreino').hidden = Object.keys(modelo.classes).length > 0;
  } catch (e) {
    console.error(e);
    camStatus.textContent = 'câmera indisponível';
    dizer(e.name === 'NotAllowedError' ? 'Preciso de permissão para usar a câmera.' : 'Não consegui iniciar a câmera ou o detector. Verifique a conexão e a permissão.');
    desligarCamera();
  }
}
function desligarCamera() {
  laco?.parar(); laco = null;
  stream?.getTracks().forEach((t) => t.stop()); stream = null;
  camVideo.srcObject = null;
  $('#camPlaceholder').hidden = false;
  camStatus.textContent = 'câmera desligada';
  camCanvas.getContext('2d').clearRect(0, 0, camCanvas.width, camCanvas.height);
  $$('[data-acao="camera"]').forEach((b) => { b.textContent = '📷 Ligar câmera'; });
}
$$('[data-acao="camera"]').forEach((b) => b.addEventListener('click', () => (stream ? desligarCamera() : ligarCamera())));

$('#btnFalarFrase').addEventListener('click', () => frase.length && falarComLia(frase.map(textoParaFala).join(' ')));
$('#btnApagarUltimo').addEventListener('click', () => { frase.pop(); atualizarFrase(); });
$('#btnLimparFrase').addEventListener('click', () => { frase.length = 0; atualizarFrase(); $('#reconhecido').textContent = '—'; });

// ------------------------------------------------------------ treinar -----
const treinoStatus = $('#treinoStatus');
function atualizarListaSinais() {
  const ul = $('#listaSinais');
  ul.innerHTML = '';
  const nomes = Object.keys(modelo.classes).sort();
  if (!nomes.length) ul.innerHTML = '<li class="muted">Nenhum sinal ainda.</li>';
  for (const nome of nomes) {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.innerHTML = `<b></b> <span class="muted">· ${modelo.classes[nome].length} exemplo(s)</span>`;
    span.querySelector('b').textContent = nome;
    const del = document.createElement('button');
    del.className = 'btn';
    del.textContent = 'Excluir';
    del.addEventListener('click', () => {
      if (!confirm(`Excluir o sinal ${nome}?`)) return;
      delete modelo.classes[nome];
      salvarModelo(modelo); modelo._limiar = limiar(modelo); atualizarListaSinais();
    });
    li.append(span, del);
    ul.append(li);
  }
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
$('#btnGravarExemplo').addEventListener('click', async (ev) => {
  const nome = $('#nomeSinal').value.trim().toUpperCase();
  if (!nome) { treinoStatus.textContent = 'Digite o nome do sinal primeiro.'; return; }
  if (!laco) { await ligarCamera(); if (!laco) return; }
  const btn = ev.currentTarget;
  btn.disabled = true;
  const cont = $('#contagem');
  cont.hidden = false;
  for (const n of ['3', '2', '1']) { cont.textContent = n; await esperar(650); }
  cont.textContent = '●';
  const vetor = await laco.gravar();
  cont.hidden = true;
  btn.disabled = false;
  if (!vetor) { treinoStatus.textContent = 'Não vi nenhuma mão. Tente de novo, com as mãos visíveis.'; return; }
  (modelo.classes[nome] ||= []).push(vetor);
  salvarModelo(modelo);
  modelo._limiar = limiar(modelo);
  const n = modelo.classes[nome].length;
  treinoStatus.textContent = `Exemplo ${n} de “${nome}” gravado.${n < 5 ? ' Grave mais alguns.' : ' Ótimo!'}`;
  if (n === 5) { lia.gesto('comemorar'); dizer(`Aprendi o sinal ${nome}!`); }
  atualizarListaSinais();
});

$('#btnExportar').addEventListener('click', () => {
  const json = salvarModelo(modelo);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = 'sinais-treinados.json';
  a.click();
  URL.revokeObjectURL(a.href);
});
$('#arquivoImportar').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const novo = importarModelo(await f.text());
    for (const [nome, lista] of Object.entries(novo.classes)) (modelo.classes[nome] ||= []).push(...lista);
    salvarModelo(modelo); modelo._limiar = limiar(modelo); atualizarListaSinais();
    treinoStatus.textContent = 'Sinais importados.';
  } catch { treinoStatus.textContent = 'Arquivo inválido.'; }
  e.target.value = '';
});

// ------------------------------------------------------------- início -----
(async () => {
  await carregarDicionario();
  mesclarLocais();
  const dl = $('#sugestoesSinais');
  for (const e of obterDicionario()) { const o = document.createElement('option'); o.value = e.glosa; dl.append(o); }
  atualizarListaSinais();
  await esperar(400);
  dizer('Oi! Eu sou a Lia 👋 Sou sua intérprete de Libras. Toque em mim para dicas.', { ms: 7000 });
  lia.gesto('acenar');
})();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
