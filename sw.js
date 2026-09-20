/* Le Carnet — service worker : hors ligne + réception des partages Android */
const CACHE = 'carnet-v1';
const COQUILLE = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(cles => Promise.all(cles.filter(c => c !== CACHE && c !== 'carnet-partage').map(c => caches.delete(c))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);

  /* feuille de partage d'Android : Instagram, Facebook… envoient ici */
  if (e.request.method === 'POST' && u.pathname.endsWith('/partage')) {
    e.respondWith((async () => {
      try {
        const f = await e.request.formData();
        const c = await caches.open('carnet-partage');
        const fichiers = f.getAll('media').filter(x => x && x.size);
        for (let i = 0; i < fichiers.length; i++) {
          await c.put('/__partage-fichier-' + i, new Response(fichiers[i], {
            headers: { 'Content-Type': fichiers[i].type || 'application/octet-stream' }
          }));
        }
        await c.put('/__partage', new Response(JSON.stringify({
          titre: f.get('title') || '', texte: f.get('text') || '',
          url: f.get('url') || '', nbFichiers: fichiers.length
        }), { headers: { 'Content-Type': 'application/json' } }));
      } catch (err) { /* on ouvre l'app quand même */ }
      return Response.redirect(new URL('./?partage=1', self.location).href, 303);
    })());
    return;
  }

  if (e.request.method !== 'GET') return;

  e.respondWith(caches.match(e.request).then(rep => rep || fetch(e.request).then(reseau => {
    const memorisable = u.origin === self.location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
    if (memorisable) { const copie = reseau.clone(); caches.open(CACHE).then(c => c.put(e.request, copie)); }
    return reseau;
  }).catch(() => caches.match('./index.html'))));
});
