#!/usr/bin/env bash
# Neuen Stand einspielen. Als Nutzer kompass ausführen:
#   sudo -u kompass -H /opt/kompass/deploy/update.sh
set -euo pipefail

cd /opt/kompass

echo "→ Stand holen"
git pull --ff-only

echo "→ Abhängigkeiten"
npm install --no-audit --no-fund

echo "→ Oberfläche bauen"
npm run build

echo "→ Dienst neu starten"
sudo systemctl restart kompass
sleep 2
systemctl is-active --quiet kompass && echo "✓ läuft" || {
  echo "✗ Dienst nicht aktiv - Protokoll:"
  journalctl -u kompass -n 30 --no-pager
  exit 1
}
