import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nbgames.app',
  appName: 'NBgAmes',
  // Les assets web sont EMBARQUÉS dans l'app (pas de server.url).
  // Charger un site distant est précisément ce qu'Apple rejette au titre
  // de la règle 4.2. Les données de jeu, elles, restent live via Firebase.
  webDir: 'build',
  ios: {
    // 'never' : le CSS gère déjà les zones de sécurité via env(safe-area-inset-*)
    // (viewport-fit=cover). Avec 'always', iOS les ajoutait une seconde fois :
    // le document dépassait l'écran et un second défilement apparaissait,
    // rendant tour à tour le haut ou le bas des pages inaccessible.
    contentInset: 'never',
    backgroundColor: '#07090E',
    // Conservé : l'écran de connexion a besoin du défilement natif quand le
    // clavier s'ouvre. Dans l'app connectée, le document est verrouillé en CSS.
    scrollEnabled: true,
  },
  android: {
    backgroundColor: '#07090E',
  },
  plugins: {
    // Android : la WebView s'étend sous les barres système (bord à bord) et
    // remplit env(safe-area-inset-*), déjà gérés par le CSS comme sur iOS.
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      style: 'DARK',
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#010101',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#07090E',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#D9A441',
    },
  },
};

export default config;
