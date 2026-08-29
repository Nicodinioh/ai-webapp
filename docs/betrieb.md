# KOMPASS auf einem eigenen Server betreiben

Für `srv1803271.hstgr.cloud` (Hostinger VPS, Ubuntu). Alle Befehle als Zeile für Zeile
einzufügen, ohne Kommentare dahinter.

---

## Vorher lesen: die Anwendung hat keine Anmeldung

KOMPASS ist als Werkzeug für **einen** Menschen an **einem** Rechner gebaut. Es gibt keine
Benutzerverwaltung, keine Rollen, keine Sitzungen. Wer die Adresse kennt, kann alles:

- deine hochgeladenen Quellen lesen und herunterladen — überwiegend urheberrechtlich geschütztes Material
- deine Notizen, Belegstellen und Leseantworten lesen
- Dateien hochladen, bis die Festplatte voll ist
- **Agentenläufe starten, die auf deine Anthropic-Rechnung gehen**

Der letzte Punkt ist der teuerste. Ein offener Endpunkt, der Modellaufrufe auslöst, wird im Netz
gefunden — nicht durch böse Absicht, sondern durch Scanner, die jede IP durchprobieren.

**Der Server startet deshalb seit dieser Fassung nur auf `127.0.0.1`.** Er ist von außen nicht
erreichbar, bis du eine der beiden Türen unten aufmachst. `HOST=0.0.0.0` hebelt das aus und
schreibt eine Warnung ins Protokoll — tu das nicht.

### Zwei Wege

| | **A · SSH-Tunnel** | **B · Reverse Proxy mit Passwort** |
|---|---|---|
| Erreichbar von | nur von Rechnern mit deinem SSH-Schlüssel | überall, auch vom Handy |
| Aufwand | fünf Minuten, keine Konfiguration | zwanzig Minuten, Caddy einrichten |
| Angriffsfläche | keine — nichts ist öffentlich offen | ein Passwort vor der Anwendung |
| Verschlüsselung | über SSH | HTTPS mit eigenem Zertifikat |
| Gut wenn | du ohnehin am Rechner arbeitest | du unterwegs Quellen ablegen willst |

**Empfehlung:** Fang mit **A** an. Es kostet nichts, funktioniert sofort, und du kannst jederzeit
auf B wechseln. Nimm B erst, wenn du merkst, dass dir der Tunnel im Weg ist.

Beides ersetzt keine echte Anmeldung. Sobald jemand außer dir die Plattform nutzen soll — der
ADG-Fall aus `docs/ideen.md`, Eintrag I-05 —, braucht es Benutzerkonten und Mandantentrennung.
Ein geteiltes Passwort ist dafür nicht genug.

---

## 1 · Grundeinrichtung auf dem Server

Verbinden:

```
ssh root@srv1803271.hstgr.cloud
```

System aktualisieren:

```
apt update && apt upgrade -y
```

Node 22 aus der offiziellen Quelle — die Version aus dem Ubuntu-Paket ist zu alt:

```
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs git
node --version
```

Da muss `v22.` stehen.

Einen eigenen Dienstnutzer anlegen. Die Anwendung läuft **nicht** als root:

```
adduser --system --group --home /opt/kompass kompass
```

## 2 · Code holen und bauen

```
cd /opt
git clone https://github.com/Nicodinioh/ai-webapp.git kompass
cd /opt/kompass
git checkout claude/research-organization-platform-p159u8
chown -R kompass:kompass /opt/kompass
```

Als Dienstnutzer installieren und bauen:

```
sudo -u kompass npm install --no-audit --no-fund
sudo -u kompass npm run build
```

`npm run build` erzeugt `dist/`. Ohne diesen Schritt liefert der Server nur die API und keine
Oberfläche.

## 3 · Zugangsdaten

```
sudo -u kompass cp /opt/kompass/.env.example /opt/kompass/.env
nano /opt/kompass/.env
```

Eintragen:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Rechte einschränken — die Datei enthält deinen Schlüssel:

```
chmod 600 /opt/kompass/.env
chown kompass:kompass /opt/kompass/.env
```

> **Setz im Anthropic-Konto ein Ausgabenlimit.** Console → Settings → Limits. Das ist das
> Sicherheitsnetz, das unabhängig von allem anderen greift.

Beispieldaten anlegen (optional):

```
sudo -u kompass npm --prefix /opt/kompass run seed
```

## 4 · Als Dienst einrichten

```
cp /opt/kompass/deploy/kompass.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now kompass
systemctl status kompass
```

Prüfen, dass er antwortet:

```
curl -s localhost:5177/api/status
```

Erwartete Ausgabe: `{"online":true,"model":"claude-opus-5"}`. Steht dort `"online":false`, wurde
der Schlüssel nicht gelesen — dann `journalctl -u kompass -n 50` ansehen.

Falls der Dienst wegen der Härtung in der Unit nicht startet (Meldungen mit `Read-only file
system`), in `/etc/systemd/system/kompass.service` `ProtectSystem=strict` auf `ProtectSystem=full`
setzen und `systemctl daemon-reload && systemctl restart kompass`.

## 5 · Firewall

```
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

Port 5177 bleibt zu. Er wird nie von außen gebraucht.

---

## Weg A · Über einen SSH-Tunnel arbeiten

Nichts weiter auf dem Server nötig. Auf deinem Mac:

```
ssh -N -L 5177:127.0.0.1:5177 root@srv1803271.hstgr.cloud
```

Das Fenster offen lassen. Im Browser: **http://localhost:5177**

Beenden mit `Strg + C`. Wer es bequemer will, legt in `~/.ssh/config` an:

```
Host kompass
  HostName srv1803271.hstgr.cloud
  User root
  LocalForward 5177 127.0.0.1:5177
```

Danach genügt `ssh -N kompass`.

---

## Weg B · Öffentlich mit HTTPS und Passwort

**Voraussetzung:** `srv1803271.hstgr.cloud` zeigt auf diesen Server. Prüfen mit `dig +short
srv1803271.hstgr.cloud` — die IP muss die deines VPS sein.

Caddy installieren:

```
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```

Passwort-Hash erzeugen:

```
caddy hash-password
```

Passwort zweimal eingeben, die Ausgabe beginnt mit `$2a$` — vollständig kopieren.

Konfiguration übernehmen und den Hash eintragen:

```
cp /opt/kompass/deploy/Caddyfile /etc/caddy/Caddyfile
nano /etc/caddy/Caddyfile
```

`HASH_HIER_EINSETZEN` durch den kopierten Hash ersetzen, den Benutzernamen bei Bedarf ändern.
Dann:

```
systemctl reload caddy
systemctl status caddy
```

Im Browser: **https://srv1803271.hstgr.cloud** — es erscheint eine Passwortabfrage.

Das Zertifikat holt Caddy beim ersten Aufruf selbst. Klappt das nicht, zeigt
`journalctl -u caddy -n 50` den Grund; meist sind Port 80 oder 443 blockiert oder der Name zeigt
woandershin.

---

## Betrieb

**Neuen Stand einspielen**

```
sudo -u kompass /opt/kompass/deploy/update.sh
```

Holt den Stand, installiert, baut und startet den Dienst neu. Deine Daten unter `data/` bleiben
unberührt — der Ordner ist nicht versioniert.

**Protokoll ansehen**

```
journalctl -u kompass -f
```

**Daten sichern.** Das ist der wichtige Teil: `data/` enthält deine Datenbank, die hochgeladenen
PDF und alle extrahierten Volltexte, und liegt in keinem Repository.

```
tar czf ~/kompass-$(date +%F).tar.gz -C /opt/kompass data
```

Regelmäßig, und auf einen anderen Rechner kopieren. Ein VPS ist kein Backup.

**Zurückspielen**

```
systemctl stop kompass
tar xzf kompass-2026-08-29.tar.gz -C /opt/kompass
chown -R kompass:kompass /opt/kompass/data
systemctl start kompass
```

---

## Wenn etwas nicht geht

**`systemctl status kompass` zeigt `failed`**
`journalctl -u kompass -n 50 --no-pager`. Die häufigsten Ursachen: falscher Pfad zu `node`
(prüfen mit `which node`, in der Unit anpassen), fehlende Schreibrechte auf `data/`
(`chown -R kompass:kompass /opt/kompass/data`), oder `dist/` fehlt (`npm run build` nachholen).

**Die Seite zeigt nur JSON oder „Cannot GET /"**
`dist/` fehlt. Als Dienstnutzer `npm run build` ausführen und neu starten.

**Agenten melden Offline-Modus**
`.env` wurde nicht gelesen. Prüfen, ob die Datei `/opt/kompass/.env` heißt, `kompass` gehört und
der Schlüssel ohne Anführungszeichen darin steht. Nach jeder Änderung `systemctl restart kompass`.

**Ein Agentenlauf bricht nach einer Minute ab**
Wenn du hinter einem anderen Proxy als Caddy sitzt: dessen Zeitlimit hochsetzen. Läufe über
Volltexte dauern Minuten. Im mitgelieferten Caddyfile stehen dafür 15 Minuten.

**`npm install` bricht mit Speichermangel ab**
Bei einem VPS mit 1 GB RAM Auslagerungsdatei anlegen:
```
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
```
