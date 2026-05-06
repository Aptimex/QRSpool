# Setting Up HTTPS with Caddy and DuckDNS

This guide walks through adding a real HTTPS certificate to your QRSpool backend server using [Caddy](https://caddyserver.com/) as a reverse proxy and [DuckDNS](https://www.duckdns.org/) for a free domain name. Caddy automatically obtains and renews a certificate from Let's Encrypt, so no manual cert management is needed.

The result: your backend is reachable at `https://yourname.duckdns.org` while connected to your local network, with no certificate warnings.

## How it works

Caddy replaces the self-signed certificate that the default Docker setup uses. Flask runs in plain HTTP mode inside a Docker container (not exposed to your network), and Caddy accepts web requests on behalf of Flask and adds a layer of HTTPS encryption to the traffic. 

Certificate issuance through Caddy for DuckDNS uses the DNS-01 ACME challenge. This avoids the need to expose any of your ports to the Internet. 

## Prerequisites

The machine running the backend should have a stable local IP address. Many modern home routers will let you set a DHCP reservation for specific devices. 

If you can't accomplish this, an additional script is provided that will periodically update your DuckDNS IP address to match you server's current local IP

## Step 1: Get a DuckDNS domain

1. Go to [duckdns.org](https://www.duckdns.org/) and sign in
2. Create a free subdomain. For example, `myserver.duckdns.org`
3. Copy your **token** from the top of the page, you'll need it in several places later

On the DuckDNS website, set the subdomain's IP to your backend server's **local IP address** (e.g. `192.168.1.100`). This ensures your phone connects to the right machine on your LAN. If you also want remote access from outside your network, you can use your external IP instead and forward port 443 on your router (dangerous, and not recommended unless you know what you're doing).

## Step 2: Create the Caddy files

Create a `caddy/` folder inside `bambu-server/`:

```bash
mkdir -p bambu-server/caddy
```

**`bambu-server/caddy/Dockerfile`** — builds a Caddy image with the DuckDNS DNS plugin:

```dockerfile
FROM caddy:builder AS builder
RUN xcaddy build --with github.com/caddy-dns/duckdns

FROM caddy:latest
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
```

**`bambu-server/caddy/Caddyfile`** — replace `yourname` with your DuckDNS subdomain:

```
yourname.duckdns.org:443 {
    tls {
        dns duckdns {env.DUCKDNS_TOKEN}
    }
    reverse_proxy bambu-api-server:5123
}
```

Caddy reads the token from the `DUCKDNS_TOKEN` environment variable set in the compose file, so the secret never lives in the config file.

## Step 3: Create the Caddy-enabled compose file

Create `bambu-server/docker-compose.caddy.yml`. This is a drop-in replacement for the default `docker-compose.yml` — keep the original intact as a fallback.

Replace `yourname` and `your-duckdns-token` with your actual values.

**`bambu-server/docker-compose.caddy.yml`:**

```yaml
services:
  bambu-api-server:
    container_name: bambu-api-server
    restart: unless-stopped
    environment:
      - PYTHONUNBUFFERED=1
    build:
      context: .
    volumes:
      - .:/bambu-server
    command: ["flask", "run", "--host=0.0.0.0", "--port=5123"]
    # No ports: entry — Flask is only reachable within the Docker network

  caddy:
    build: ./caddy
    container_name: caddy-qrspool
    restart: unless-stopped
    ports:
      - "443:443"
    environment:
      - DUCKDNS_TOKEN=your-duckdns-token
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config

volumes:
  caddy_data:
  caddy_config:
```

## (Optional) Keep DuckDNS updated if your IP changes

If the machine's IP is stable (static assignment or DHCP reservation), skip this. You already set the correct IP on the DuckDNS website in Step 1.

If you can't obtain a static LAN IP for your backend server, modify and run this `duckdns-local.sh` script via cron to keep your DuckDNS subdomain updated with the server's current local IP:
```bash
#!/bin/bash
# Updates DuckDNS with this machine's current local LAN IP.

SUBDOMAIN="yourname"           # your DuckDNS subdomain (without .duckdns.org)
TOKEN="your-duckdns-token"     # from duckdns.org dashboard
INTERFACE="eth0"               # LAN interface to read the IP from (e.g. eth0, wlan0, enp3s0)
LOG="/var/log/duckdns-local.log"

LOCAL_IP=$(ip -4 addr show "$INTERFACE" 2>/dev/null | grep -oP '(?<=inet )\d+\.\d+\.\d+\.\d+')

if [ -z "$LOCAL_IP" ]; then
    echo "$(date -Iseconds) ERROR could not detect local IP" >> "$LOG"
    exit 1
fi

RESPONSE=$(curl -sf "https://www.duckdns.org/update?domains=${SUBDOMAIN}&token=${TOKEN}&ip=${LOCAL_IP}")
CURL_EXIT=$?

if [ $CURL_EXIT -ne 0 ]; then
    echo "$(date -Iseconds) ERROR curl failed (exit ${CURL_EXIT})" >> "$LOG"
    exit 1
fi

# Uncomment this line if you need to log all server responses
# echo "$(date -Iseconds) ip=${LOCAL_IP} response=${RESPONSE}" >> "$LOG"
```

Cron setup:
```bash
chmod +x bambu-server/duckdns-local.sh
crontab -e
# Add this line (runs every 5 minutes):
# */5 * * * * /path/to/bambu-server/duckdns-local.sh
```

If you know what you're doing and are exposing the server to the Internet, you can instead add this to your `docker-compose.caddy.yml` file to dynamically tie your subdomain to your public-facing IP:
```yaml
  duckdns:
    image: lscr.io/linuxserver/duckdns:latest
    container_name: duckdns-qrspool
    restart: unless-stopped
    environment:
      - SUBDOMAINS=yourname
      - TOKEN=your-duckdns-token
```

## Step 4: Start the stack

```bash
cd bambu-server/
sudo docker compose -f docker-compose.caddy.yml up --build -d
```

On first start, Docker builds the custom Caddy image (takes a minute or two), then Caddy contacts Let's Encrypt via the DuckDNS API to issue the certificate. To confirm it succeeded:

```bash
sudo docker logs caddy-qrspool
```

Look for a line like `certificate obtained successfully`. Subsequent starts skip certificate issuance (it's cached in the `caddy_data` volume) and are nearly instant.

## Step 5: Update QRSpool settings

1. Open `https://qrspool.com/settings.html` on your phone
2. Set the server URL to `https://yourname.duckdns.org` (no port number — standard HTTPS port 443)
3. Tap **Save**, then **Validate**

## Troubleshooting

**Certificate issuance fails (`no token provided` or `error setting DNS record` in Caddy logs)**
- Double-check `DUCKDNS_TOKEN` in the compose file matches the token shown at the top of duckdns.org
- Verify the subdomain belongs to your account and is not mispelled

**Certificate issuance fails (`timeout` or `DNS record not found` in Caddy logs)**
- DNS propagation can take 1–2 minutes; Caddy retries automatically — wait and re-check logs
- Confirm the DuckDNS API is reachable from the backend machine: `curl "https://www.duckdns.org/update?domains=yourname&token=YOUR_TOKEN&ip="`

**`certificate obtained successfully` appears but the browser still shows a warning**
- Clear the browser cache or try a private/incognito window
- Confirm `nslookup yourname.duckdns.org` resolves to this machine's IP

**Validation fails in QRSpool settings**
- Confirm the URL is `https://yourname.duckdns.org` with no trailing slash and no port number, and that you hit Save
- Check Caddy is running: `sudo docker ps` should show `caddy-qrspool` as Up
- Check Flask is running: `sudo docker logs bambu-api-server`

**Want to keep using port 5123 instead of 443?**

Change the Caddyfile to listen on a specific port:

```
yourname.duckdns.org:5123 {
    tls {
        dns duckdns {env.DUCKDNS_TOKEN}
    }
    reverse_proxy bambu-api-server:5123
}
```

Update the `caddy` service ports in the compose file to `"5123:5123"`.
