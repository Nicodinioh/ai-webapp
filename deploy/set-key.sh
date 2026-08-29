#!/usr/bin/env bash
# Traegt den Anthropic-Schluessel in die .env ein, ohne Editor.
# Die Eingabe bleibt unsichtbar und landet weder in der Shell-Historie noch in
# der Prozessliste.
#
#   bash /opt/kompass/deploy/set-key.sh
#
set -euo pipefail

ENV_FILE="${1:-/opt/kompass/.env}"
EXAMPLE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.env.example"

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$EXAMPLE" ]; then
    cp "$EXAMPLE" "$ENV_FILE"
    echo "→ $ENV_FILE aus der Vorlage angelegt"
  else
    : > "$ENV_FILE"
  fi
fi

printf 'Anthropic API-Schlüssel einfügen (die Eingabe bleibt unsichtbar), dann Enter:\n> '
read -rs KEY
printf '\n'

# Leerzeichen, Tabulatoren und Zeilenumbrueche entfernen - beim Einfuegen
# rutschen die leicht mit hinein.
KEY="${KEY//[$'\t\r\n ']/}"
KEY="${KEY%\"}"; KEY="${KEY#\"}"
KEY="${KEY%\'}"; KEY="${KEY#\'}"

if [ -z "$KEY" ]; then
  echo "Nichts eingegeben — abgebrochen, die Datei bleibt unverändert."
  exit 1
fi

case "$KEY" in
  sk-ant-*) ;;
  *) echo "Hinweis: Der Schlüssel beginnt nicht mit 'sk-ant-'. Ich trage ihn trotzdem ein." ;;
esac

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
found=0
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    ANTHROPIC_API_KEY=*)
      printf 'ANTHROPIC_API_KEY=%s\n' "$KEY" >> "$tmp"
      found=1
      ;;
    *) printf '%s\n' "$line" >> "$tmp" ;;
  esac
done < "$ENV_FILE"
[ "$found" -eq 1 ] || printf 'ANTHROPIC_API_KEY=%s\n' "$KEY" >> "$tmp"

cat "$tmp" > "$ENV_FILE"
chmod 600 "$ENV_FILE"
if id kompass >/dev/null 2>&1 && [ "$(id -u)" = "0" ]; then
  chown kompass:kompass "$ENV_FILE"
fi

echo "✓ Eingetragen: ${KEY:0:14}…${KEY: -4}  (${#KEY} Zeichen)"
echo "  Datei: $ENV_FILE"
echo
echo "Weiter:  systemctl restart kompass   (falls der Dienst schon läuft)"
