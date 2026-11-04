// Service worker: guarda o app para funcionar offline (o reconhecimento pela
// câmera ainda baixa os modelos do MediaPipe na primeira vez).
const CACHE = 'ponte-libras-v2';
const ARQUIVOS = [
  './', 'index.html', 'captura.html', 'manifest.webmanifest', 'css/style.css',
  'js/app.js', 'js/captura.js', 'js/config.js',
  'js/movimento/motor.js', 'js/movimento/rig.js', 'js/movimento/pose.js', 'js/movimento/solver.js', 'js/movimento/retarget.js',
  'js/tete3d/tete.js', 'js/tete3d/carregar.js', 'js/tete3d/escultura.js', 'js/tete3d/sdf.js', 'js/tete3d/materiais.js',
  'js/tete3d/rosto.js', 'js/tete3d/cachos.js', 'js/tete3d/detalhes.js', 'assets/tete/tete.json', 'assets/tete/tete.bin',
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
