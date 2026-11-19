#!/bin/bash
# Retrouve le mot de passe de la clé d'upload à partir de celui que tu as noté.
# Tout se passe sur ton Mac ; le mot de passe n'est jamais affiché.
set -e
cd "$(dirname "$0")"
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
read -r -s -p "Colle le mot de passe que tu as enregistré : " P; echo
printf '%s\n' "$P" | "$JAVA_HOME/bin/java" tools/RecoverKeyPassword.java ../android-keys/upload-keystore.jks
