// Service worker del panel: solo recibe avisos. No cachea nada — el panel es
// dinámico y una copia vieja en caché sería peor que no tener nada.
self.addEventListener('push', (evento) => {
  let d = { titulo: 'Consultorio', cuerpo: '', enlace: '/panel' };
  try { d = { ...d, ...evento.data.json() }; } catch { d.cuerpo = evento.data ? evento.data.text() : ''; }

  evento.waitUntil(
    self.registration.showNotification(d.titulo, {
      body: d.cuerpo,
      icon: '/marca/monograma.png',
      badge: '/marca/monograma.png',
      tag: d.enlace,                 // un aviso por pantalla: no se apilan diez iguales
      renotify: true,
      data: { enlace: d.enlace },
    })
  );
});

// Al tocar el aviso: si el panel ya está abierto en alguna pestaña, se enfoca
// esa en vez de abrir una nueva.
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.enlace) || '/panel';
  evento.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if (c.url.includes('/panel') && 'focus' in c) { c.navigate(destino); return c.focus(); }
      }
      return clients.openWindow(destino);
    })
  );
});
