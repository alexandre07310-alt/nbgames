#!/bin/bash
# Crée une NOUVELLE clé d'upload Android, à utiliser après réinitialisation par Google
# (Play Console → Intégrité des applis → Signature d'application → réinitialiser la clé d'importation).
# Produit aussi le certificat (.pem) à envoyer à Google.
# Le mot de passe est choisi et saisi par TOI, dans TON terminal. Il n'est ni stocké ni transmis.
set -e
cd "$(dirname "$0")/.."
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"

DIR="android-keys"
KEYSTORE="$DIR/upload-keystore.jks"
ALIAS="upload"
PEM="$HOME/Desktop/nbgames-upload-certificate.pem"
mkdir -p "$DIR"

if [ -f "$KEYSTORE" ]; then
  echo "⚠️  Une nouvelle clé existe déjà : $(pwd)/$KEYSTORE"
  echo "   Je ne l'écrase pas. Supprime-la d'abord si tu veux vraiment en refaire une."
  exit 1
fi

echo "──────────────────────────────────────────────────────────────"
echo " Nouvelle clé d'upload Android"
echo ""
echo " 1. Choisis un mot de passe (6 caractères minimum)."
echo " 2. NOTE-LE TOUT DE SUITE dans l'app Mots de passe du Mac"
echo "    (nom : « NBgAmes clé Android »)."
echo " Les caractères ne s'affichent pas quand tu tapes : c'est normal."
echo "──────────────────────────────────────────────────────────────"

for attempt in 1 2 3; do
  read -r -s -p "Nouveau mot de passe : " P1; echo
  read -r -s -p "Confirme le mot de passe : " P2; echo
  if [ "$P1" != "$P2" ]; then echo "❌ Les deux saisies sont différentes."; continue; fi
  if [ ${#P1} -lt 6 ]; then echo "❌ 6 caractères minimum."; continue; fi
  break
done
[ "$P1" = "$P2" ] && [ ${#P1} -ge 6 ] || exit 1

keytool -genkeypair -v \
  -keystore "$KEYSTORE" -alias "$ALIAS" \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$P1" -keypass "$P1" \
  -dname "CN=NBgAmes, OU=NBgAmes, O=NBgAmes, L=Paris, C=FR" >/dev/null 2>&1

keytool -export -rfc -keystore "$KEYSTORE" -alias "$ALIAS" -storepass "$P1" -file "$PEM" >/dev/null 2>&1

echo ""
echo "✅ Nouvelle clé créée : $(pwd)/$KEYSTORE"
echo "✅ Certificat pour Google, sur ton Bureau : $PEM"
echo ""
echo "⚠️  Sauvegarde le fichier $KEYSTORE (iCloud Drive ou disque externe)."
echo "   Fichier + mot de passe = indispensables pour chaque mise à jour."
