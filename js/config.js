// Endereços do MediaPipe (detecção de mãos, pose e rosto).
// Para uso 100% offline, copie o pacote @mediapipe/tasks-vision e os modelos
// .task para uma pasta local e aponte estes caminhos para ela.
export const MEDIAPIPE = {
  versao: '0.10.14',
  // 'GPU' é mais rápido; use 'CPU' em aparelhos com problemas de WebGL
  delegate: 'GPU',
  get bundle() { return `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${this.versao}/vision_bundle.mjs`; },
  get wasm() { return `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${this.versao}/wasm`; },
  modelos: {
    maos: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
    pose: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
    rosto: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  },
};

// Permite sobrescrever (ex.: testes locais) via localStorage "mediapipe-base".
try {
  const delegate = localStorage.getItem('mediapipe-delegate');
  if (delegate) MEDIAPIPE.delegate = delegate;
  const base = localStorage.getItem('mediapipe-base');
  if (base) {
    Object.defineProperty(MEDIAPIPE, 'bundle', { get: () => `${base}/vision_bundle.mjs` });
    Object.defineProperty(MEDIAPIPE, 'wasm', { get: () => `${base}/wasm` });
  }
} catch { /* armazenamento indisponível */ }

let visionPromise = null;
export function carregarVision() {
  visionPromise ??= (async () => {
    const vision = await import(/* @vite-ignore */ MEDIAPIPE.bundle);
    const fileset = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE.wasm);
    return { vision, fileset };
  })();
  return visionPromise;
}
