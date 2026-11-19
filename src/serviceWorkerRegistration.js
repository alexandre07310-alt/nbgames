export function register(config) {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

    navigator.serviceWorker.register(swUrl).then(registration => {
      // Triggered when a new SW is found
      registration.onupdatefound = () => {
        const installing = registration.installing;
        if (!installing) return;

        installing.onstatechange = () => {
          if (installing.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // New content available — notify the app
              if (config && config.onUpdate) {
                config.onUpdate(registration);
              }
            }
          }
        };
      };

      // Also catch controller change (when skipWaiting fires externally)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Already handled by the onUpdate flow
      });
    }).catch(err => {
      console.error('Service worker registration failed:', err);
    });
  });
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(r => r.unregister()).catch(() => {});
  }
}
