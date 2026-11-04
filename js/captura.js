// Estúdio de captura: vídeo da intérprete → animação 3D da Teté.
import { criarTete } from './tete3d/tete.js';
import { associarMaos, quadroDeDeteccao, suavizar } from './movimento/retarget.js';
import { carregarVision, MEDIAPIPE } from './config.js';
import { carregarDicionario, mesclarLocais, animacoesLocais, salvarAnimacaoLocal, removerAnimacaoLocal, animacaoParaClipe } from './libras/sinais.js';

const $ = (s) => document.querySelector(s);
const FPS = 15;

const video = $('#video');
const status = $('#status');
const progresso = $('#progresso');
const letreiro = $('#letreiro');
let animacao = null;

const tete = criarTete($('#avatar'), {
  aoMarcar(ev) {
    if (ev.tipo === 'inicio') { letreiro.hidden = false; letreiro.textContent = ev.clip.nome; letreiro.style.fontSize = '1.2rem'; }
    if (ev.tipo === 'ocioso') {
      letreiro.hidden = true;
      if (animacao && $('#loop').checked && tocando) setTimeout(() => tocando && tete.tocar(animacaoParaClipe(animacao)), 500);
    }
  },
});
let tocando = false;

// ------------------------------------------------------------- vídeo ------
function carregarVideo(url) {
  video.srcObject = null;
  video.src = url;
  video.controls = true;
  $('#vazio').hidden = true;
  $('#btnProcessar').disabled = false;
  status.textContent = 'Vídeo carregado. Preencha a glosa e gere a animação.';
}
$('#arquivo').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (f) carregarVideo(URL.createObjectURL(f));
});

let gravador = null;
$('#btnGravar').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  if (gravador) { gravador.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, frameRate: 30 }, audio: false });
    video.srcObject = stream; video.controls = false; await video.play();
    $('#vazio').hidden = true;
    const partes = [];
    gravador = new MediaRecorder(stream);
    gravador.ondataavailable = (ev) => partes.push(ev.data);
    gravador.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      gravador = null;
      btn.textContent = '⏺ Gravar com a câmera'; btn.classList.remove('gravando');
      carregarVideo(URL.createObjectURL(new Blob(partes, { type: partes[0]?.type || 'video/webm' })));
    };
    gravador.start();
    btn.textContent = '⏹ Parar gravação'; btn.classList.add('gravando');
  } catch {
    status.textContent = 'Não foi possível acessar a câmera.';
  }
});

// ---------------------------------------------------------- detecção ------
let detectores = null;
async function carregarDetectores() {
  if (detectores) return detectores;
  status.textContent = 'Carregando modelos de detecção (pose, mãos e rosto)…';
  const { vision, fileset } = await carregarVision();
  const [pose, maos, rosto] = await Promise.all([
    vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MEDIAPIPE.modelos.pose, delegate: MEDIAPIPE.delegate }, runningMode: 'VIDEO', numPoses: 1,
    }),
    vision.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MEDIAPIPE.modelos.maos, delegate: MEDIAPIPE.delegate }, runningMode: 'VIDEO', numHands: 2,
      minHandDetectionConfidence: 0.4, minTrackingConfidence: 0.4,
    }),
    vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MEDIAPIPE.modelos.rosto, delegate: MEDIAPIPE.delegate }, runningMode: 'VIDEO', numFaces: 1,
      outputFaceBlendshapes: true,
    }),
  ]);
  detectores = { pose, maos, rosto };
  return detectores;
}

// quadro atual do vídeo num canvas (permite desfazer o espelhamento da câmera frontal)
const tela = document.createElement('canvas');
function quadroAtual() {
  tela.width = video.videoWidth; tela.height = video.videoHeight;
  const ctx = tela.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if ($('#espelhado').checked) ctx.setTransform(-1, 0, 0, 1, tela.width, 0);
  ctx.drawImage(video, 0, 0);
  return tela;
}

// posiciona o vídeo no instante t e espera o quadro ficar disponível
const buscar = (t) => new Promise((res) => {
  if (Math.abs(video.currentTime - t) < 1e-4 && video.readyState >= 2) { res(); return; }
  const pronto = () => { clearTimeout(limite); res(); };
  const limite = setTimeout(() => { video.removeEventListener('seeked', pronto); res(); }, 3000);
  video.addEventListener('seeked', pronto, { once: true });
  video.currentTime = t;
});

$('#btnProcessar').addEventListener('click', async () => {
  const glosa = $('#glosa').value.trim().toUpperCase().replace(/\s+/g, '-');
  if (!glosa) { status.textContent = 'Preencha a glosa do sinal.'; $('#glosa').focus(); return; }
  const btn = $('#btnProcessar');
  btn.disabled = true;
  try {
    const d = await carregarDetectores();
    video.pause();
    if (video.readyState < 1) await new Promise((r) => video.addEventListener('loadedmetadata', r, { once: true }));
    if (!isFinite(video.duration)) { // vídeos gravados (webm) às vezes não informam a duração
      await buscar(1e6); await buscar(0);
    }
    const dur = video.duration;
    const total = Math.floor(dur * FPS);
    progresso.hidden = false; progresso.max = total;
    const quadros = [];
    const comMao = [];
    let anterior = null;
    for (let i = 0; i < total; i++) {
      await buscar(i / FPS);
      const ts = Math.round((i / FPS) * 1000) + 1;
      const img = quadroAtual();
      const rp = d.pose.detectForVideo(img, ts);
      const rm = d.maos.detectForVideo(img, ts);
      const rr = $('#rosto').checked ? d.rosto.detectForVideo(img, ts) : null;
      const blend = rr?.faceBlendshapes?.[0]?.categories?.reduce((o, c) => ((o[c.categoryName] = c.score), o), {});
      const det = {
        poseMundo: rp.worldLandmarks?.[0],
        maos: associarMaos(rp.landmarks?.[0], rm),
        blend,
      };
      const q = quadroDeDeteccao(det, anterior?.q);
      quadros.push(q);
      comMao.push(Object.keys(det.maos).length > 0);
      anterior = q;
      progresso.value = i + 1;
      status.textContent = `Analisando quadro ${i + 1} de ${total}…`;
    }
    let ini = 0, fim = quadros.length - 1;
    if ($('#aparar').checked && comMao.some(Boolean)) {
      ini = Math.max(0, comMao.indexOf(true) - 3);
      fim = Math.min(quadros.length - 1, comMao.lastIndexOf(true) + 3);
    }
    const palavras = $('#palavras').value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    animacao = {
      id: glosa.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]/g, ''),
      glosa,
      palavras,
      fps: FPS,
      fonte: 'captura de vídeo da intérprete',
      criado: new Date().toISOString(),
      quadros: suavizar(quadros.slice(ini, fim + 1), 0.45),
    };
    const semMaos = comMao.slice(ini, fim + 1).filter((x) => !x).length;
    status.textContent = `Pronto! ${animacao.quadros.length} quadros (${(animacao.quadros.length / FPS).toFixed(1)} s).`
      + (semMaos ? ` Atenção: ${semMaos} quadro(s) sem mãos detectadas.` : '');
    $('#btnTocar').disabled = $('#btnSalvar').disabled = $('#btnBaixar').disabled = false;
    tocar();
  } catch (e) {
    console.error(e);
    status.textContent = `Erro ao processar: ${e.message || e}. Verifique a conexão (os modelos são baixados na primeira vez).`;
  } finally {
    btn.disabled = false;
    progresso.hidden = true;
  }
});

function tocar() {
  if (!animacao) return;
  tocando = true;
  tete.parar();
  tete.tocar(animacaoParaClipe(animacao));
  video.currentTime = 0; video.play().catch(() => {});
}
$('#btnTocar').addEventListener('click', tocar);
$('#loop').addEventListener('change', (e) => { if (!e.target.checked) tocando = false; });

// ------------------------------------------------------- salvar ----------
$('#btnSalvar').addEventListener('click', () => {
  try {
    salvarAnimacaoLocal(animacao);
    status.textContent = `Sinal ${animacao.glosa} salvo. A Teté já usa este sinal no app.`;
    tete.gesto('comemorar');
    listar();
  } catch {
    status.textContent = 'Sem espaço no armazenamento do navegador. Baixe o .json.';
  }
});
$('#btnBaixar').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(animacao)], { type: 'application/json' }));
  a.download = `${animacao.id}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

function listar() {
  const ul = $('#lista');
  ul.innerHTML = '';
  const todas = Object.values(animacoesLocais());
  if (!todas.length) ul.innerHTML = '<li class="muted">Nenhum ainda.</li>';
  for (const a of todas) {
    const li = document.createElement('li');
    const info = document.createElement('span');
    info.innerHTML = '<b></b> <code></code>';
    info.querySelector('b').textContent = a.glosa;
    info.querySelector('code').textContent = (a.palavras || []).join(', ');
    const ver = document.createElement('button');
    ver.className = 'btn'; ver.textContent = '▶';
    ver.addEventListener('click', () => { tete.parar(); tete.tocar(animacaoParaClipe(a)); });
    const del = document.createElement('button');
    del.className = 'btn'; del.textContent = 'Excluir';
    del.addEventListener('click', () => { if (confirm(`Excluir ${a.glosa}?`)) { removerAnimacaoLocal(a.id); listar(); } });
    const acoes = document.createElement('span');
    acoes.className = 'botoes';
    acoes.append(ver, del);
    li.append(info, acoes);
    ul.append(li);
  }
}

(async () => {
  await carregarDicionario();
  mesclarLocais();
  listar();
  tete.gesto('acenar');
})();
