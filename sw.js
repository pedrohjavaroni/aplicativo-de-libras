// Service worker: guarda o app para funcionar offline (o reconhecimento pela
// câmera ainda baixa os modelos do MediaPipe na primeira vez).
const CACHE = 'ponte-libras-v1';
const ARQUIVOS = [
  './', 'index.html', 'captura.html', 'manifest.webmanifest', 'css/style.css',
  'js/app.js', 'js/captura.js', 'js/config.js',
  'js/avatar3d/avatar.js', 'js/avatar3d/rig.js', 'js/avatar3d/pose.js', 'js/avatar3d/solver.js', 'js/avatar3d/retarget.js',
  'js/libras/glosa.js', 'js/libras/fala.js', 'js/libras/sinais.js', 'js/libras/reconhecedor.js',
  'js/vendor/three.module.min.js', 'dados/dicionario.json', 'assets/icone-192.png', 'assets/icone-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// rede primeiro (conteúdo sempre atualizado), cache como reserva offline
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok && new URL(e.request.url).origin === location.origin) {
          const copia = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copia));
        }
        return r;
      })
      .catch(() => caches.match(e.request)),
  );
});
