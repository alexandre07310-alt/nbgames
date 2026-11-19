# Publication NBgAmes sur le Google Play Store

## Ce qui est déjà fait

- Projet Android TWA généré : `android-twa/` (package **com.nbgames.app**, targetSdk 36)
- Build validé : `BUILD SUCCESSFUL`, APK debug 7,6 Mo
- JDK 17 + Android SDK 34/35/36 installés
- Manifest PWA complet (icônes maskable, scope, orientation, description)
- `.well-known/assetlinks.json` servi en HTTP 200 (placeholder `[]`, à compléter)
- Politique de confidentialité en ligne : https://nbgames-ea27a.web.app/privacy.html
- Visuels : `store-assets/feature-graphic-1024x500.png`, `store-assets/play-icon-512.png`
- Keystore exclu de git

## Étapes à faire

### 1. Créer le compte Play Console — 25 $ une fois
https://play.google.com/console/signup

> **Compte personnel** : depuis nov. 2023, il faut un test fermé avec
> **12 testeurs pendant 14 jours consécutifs** avant d'accéder à la production.
> Un compte **organisation** (avec SIRET) en est exempté. À décider avant de payer.

### 2. Générer la clé et construire l'AAB

```bash
./android-twa/build-release.sh
```

Le script demande un mot de passe — choisis-le et **note-le dans ton gestionnaire**.
Sans lui, plus aucune mise à jour n'est possible.

**Sauvegarde `android-twa/android.keystore` hors du Mac** (cloud + disque externe).

### 3. Créer l'app dans la Play Console

- Nom : `NBgAmes`
- Langue par défaut : français
- Type : Application · Gratuite
- Téléverser `android-twa/app/build/outputs/bundle/release/app-release.aab`

### 4. Récupérer l'empreinte SHA-256 et finaliser assetlinks

**Étape indispensable** — sans elle, l'app s'ouvre avec une barre d'adresse Chrome visible.

Play Console → **Configuration → Intégrité de l'app → Signature de l'app**
→ copier le **SHA-256 de la clé de signature de l'app** (celle de Google, pas celle d'upload).

Puis remplacer `public/.well-known/assetlinks.json` par :

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.nbgames.app",
    "sha256_cert_fingerprints": ["LE:SHA:256:ICI"]
  }
}]
```

Puis `npm run build && firebase deploy --only hosting`.

Vérification : https://developers.google.com/digital-asset-links/tools/generator

### 5. Fiche du store

| Élément | Valeur |
|---|---|
| Description courte (80 car. max) | Pronostique le match NBA du soir, défie tes amis et grimpe au classement. |
| Icône 512×512 | `store-assets/play-icon-512.png` |
| Bannière 1024×500 | `store-assets/feature-graphic-1024x500.png` |
| Captures téléphone | **min. 2** — à faire toi-même une fois connecté |
| Politique de confidentialité | https://nbgames-ea27a.web.app/privacy.html |

Captures à prendre : onglet Match (pronostic en cours), Mini-jeux, Classement, Profil.

### 6. Questionnaires obligatoires

- **Sécurité des données** : déclarer e-mail (compte), pseudo + photo (facultative),
  données de jeu. Chiffrement en transit : oui. Suppression sur demande : oui.
  Aucune donnée partagée avec des tiers, aucune publicité.
- **Classification du contenu** : catégorie Sport/Jeu, pas de contenu sensible.
  Bien répondre **non** aux questions sur les jeux d'argent : NBgAmes n'a ni mise ni gain réel.
- **Public cible** : 13 ans et plus (cohérent avec la politique de confidentialité).

## Mises à jour ultérieures

Incrémenter dans `android-twa/twa-manifest.json` :

```json
"appVersion": "1.0.1",
"appVersionCode": 2
```

Puis `npx bubblewrap update --skipVersionUpgrade && ./build-release.sh`.

> Le contenu web se met à jour tout seul sans repasser par le store —
> une TWA charge le site en ligne. Un nouvel AAB n'est nécessaire que pour
> changer l'icône, le nom, ou la configuration Android.
