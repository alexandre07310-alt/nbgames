#!/bin/bash
# Construit l'AAB signé de l'app Android native (Capacitor) pour le Play Store.
# Signé avec la clé d'upload enregistrée chez Google pour com.nbgames.app :
# la nouvelle (android-keys/, créée par new-upload-key.sh après réinitialisation)
# si elle existe, sinon l'ancienne de la version TWA (android-twa/android.keystore).
# Le mot de passe est saisi par TOI, dans TON terminal. Il n'est ni stocké ni transmis.
set -e
cd "$(dirname "$0")"
ROOT="$(cd .. && pwd)"

export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$JAVA_HOME/bin:$PATH"

if [ -f "$ROOT/android-keys/upload-keystore.jks" ]; then
  KEYSTORE="$ROOT/android-keys/upload-keystore.jks"; ALIAS="upload"
else
  KEYSTORE="$ROOT/android-twa/android.keystore"; ALIAS="android"
fi
echo "Clé utilisée : $KEYSTORE"

if [ ! -f "$KEYSTORE" ]; then
  echo "❌ Clé introuvable : $KEYSTORE"
  echo "   Sans elle, Google refusera la mise à jour. Ne crée PAS de nouvelle clé."
  exit 1
fi

# Mot de passe rangé dans le trousseau du Mac (par recover-key-password.sh) : rien à taper.
SAVED="$(security find-generic-password -s "NBgAmes Android upload key" -a upload -w 2>/dev/null || true)"
if [ -n "$SAVED" ] && keytool -list -keystore "$KEYSTORE" -alias "$ALIAS" -storepass "$SAVED" >/dev/null 2>&1; then
  KS_PASS="$SAVED"; echo "✅ Mot de passe trouvé dans le trousseau du Mac."
fi

# Vérifie le mot de passe tout de suite plutôt que d'échouer après un build complet.
for attempt in 1 2 3; do
  [ -n "${KS_PASS:-}" ] && break
  read -r -s -p "Mot de passe du keystore : " KS_PASS; echo
  # Un copier-coller ajoute souvent une espace ou un retour invisible : on essaie aussi sans.
  TRIMMED="$(printf '%s' "$KS_PASS" | tr -d '\r\n' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  for CAND in "$KS_PASS" "$TRIMMED"; do
    if keytool -list -keystore "$KEYSTORE" -alias "$ALIAS" -storepass "$CAND" >/dev/null 2>&1; then
      KS_PASS="$CAND"; OK=1; break
    fi
  done
  if [ "${OK:-0}" = "1" ]; then
    echo "✅ Mot de passe correct."
    break
  fi
  echo "   (${#KS_PASS} caractères reçus)"
  echo "❌ Mot de passe incorrect (tentative $attempt/3)."
  [ "$attempt" = "3" ] && exit 1
done

echo "Compilation du site et copie dans l'app…"
(cd "$ROOT" && npm run build >/dev/null && npx cap sync android >/dev/null)

echo "Construction de l'AAB signé…"
./gradlew bundleRelease -q \
  -Pandroid.injected.signing.store.file="$KEYSTORE" \
  -Pandroid.injected.signing.store.password="$KS_PASS" \
  -Pandroid.injected.signing.key.alias="$ALIAS" \
  -Pandroid.injected.signing.key.password="$KS_PASS"

AAB="app/build/outputs/bundle/release/app-release.aab"
if [ -f "$AAB" ]; then
  echo ""
  echo "✅ AAB prêt : $(pwd)/$AAB"
  ls -lh "$AAB" | awk '{print "   taille :",$5}'
  echo "   Empreinte de la clé d'upload (doit être celle enregistrée dans la Play Console) :"
  keytool -J-Duser.language=en -printcert -jarfile "$AAB" 2>/dev/null | grep "SHA256:" | head -1
else
  echo "❌ AAB introuvable : le build a échoué."; exit 1
fi
