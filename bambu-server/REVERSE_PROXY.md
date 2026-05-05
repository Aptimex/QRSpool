# Setting Up HTTPS with Caddy and DuckDNS

This guide walks through adding a real HTTPS certificate to the QRSpool backend using [Caddy](https://caddyserver.com/) as a reverse proxy and [DuckDNS](https://www.duckdns.org/) for a free domain name. Caddy automatically obtains and renews a certificate from Let's Encrypt — no manual cert management needed.

The result: your backend is reachable at `https://yourname.duckdns.org`, with a certificate browsers trust natively.

## How it works

```
Phone browser
  → https://yourname.duckdns.org (port 443)
  → Caddy (handles TLS, proxies internally)
  → Flask server on port 5123 (HTTP, not exposed externally)
```

Caddy replaces the self-signed certificate that the default Docker setup uses. Flask runs in plain HTTP mode inside the Docker network — Caddy handles all encryption.

Certificate issuance uses the **DNS-01 ACME challenge**: Caddy proves domain ownership to Let's Encrypt by writing a temporary TXT record to DuckDNS via its API, rather than by serving a file over HTTP. This means Let's Encrypt never needs to reach your server, so **no port forwarding is required** if your phone stays on the same network as the backend. If you want to reach the backend from outside your home network, forward only port 443 on your router — port 80 is not needed.

## Prerequisites

- The machine running the backend must have a stable local IP address (set a DHCP reservation in your router if needed)

That's it. No router port forwarding is required for LAN-only use.

## Step 1: Get a DuckDNS domain

1. Go to [duckdns.org](https://www.duckdns.org/) and sign in (GitHub, Google, etc.)
2. Create a subdomain — e.g. `myprinter` → `myprinter.duckdns.org`
3. Copy your **token** from the top of the page — it's used for both the IP updater and the DNS challenge

Set the subdomain's IP to your backend server's **local IP address** (e.g. `192.168.1.100`) on the DuckDNS website. This ensures your phone connects to the right machine on your LAN. If you also want remote access from outside your network, use your external IP instead and forward port 443 on your router (dangerous, not recommended unless you know what you're doing).

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
yourname.duckdns.org {
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

  duckdns:
    image: lscr.io/linuxserver/duckdns:latest
    container_name: duckdns-qrspool
    restart: unless-stopped
    environment:
      - SUBDOMAINS=yourname
      - TOKEN=your-duckdns-token
      - IPADDRESS=192.168.1.100    # this machine's local IP; omit for external IP

volumes:
  caddy_data:
  caddy_config:
```

The `duckdns` container keeps the subdomain's IP current every five minutes. Set `IPADDRESS` to this machine's static LAN IP for home-only use. It can be ommitted to track your external IP if you understand the security risks with that approach. 

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

**Validate fails in QRSpool settings**
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

Update the `caddy` service ports in the compose file to `"5123:5123"`. Certificate issuance still works with no changes to port forwarding, since DNS-01 challenge doesn't require any inbound connections.
