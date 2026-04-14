# Kali-AI-term on Synology DSM 7 (ZeroTier)

This guide covers installing Kali-AI-term on a Synology NAS running **DSM 7** with access via a **ZeroTier** network. A self-hosted ZeroTier moon is supported.

> **Prerequisites**
> - Synology DSM 7 with **Container Manager** installed (Package Center)
> - SSH access enabled (Control Panel → Terminal & SNMP)
> - A ZeroTier network — see [zerotier/ZeroTierOne](https://github.com/zerotier/ZeroTierOne) to get started
> - (Optional) A self-hosted ZeroTier moon — reference your moon's World ID and Seed ID

---

## Method A — SSH Installer (Recommended)

SSH into your Synology as an administrator and run:

```bash
cd /volume1/docker
git clone https://github.com/Crashcart/Kali-AI-term.git kali-ai-term
cd kali-ai-term
bash install-synology.sh
```

The script will prompt you for:
| Prompt | Notes |
|--------|-------|
| Admin password | Web UI login password |
| ZeroTier Network ID | 16-character hex ID from your ZeroTier network |
| ZeroTier Moon World ID | Leave blank to skip (uses ZeroTier's central infra) |
| ZeroTier Moon Seed ID | Required only if you provided a Moon World ID |

Once complete, the script will print your ZeroTier IP and the app URL.

> **Authorize the device** — after joining, approve the NAS node in ZeroTier Central
> (or your moon admin panel) if your network requires authorization.

---

## Method B — Container Manager GUI (No SSH)

Use this if you prefer the DSM web interface.

### Step 1 — Set up ZeroTier on the NAS

Follow the Docker instructions from [zerotier/ZeroTierOne](https://github.com/zerotier/ZeroTierOne) to run ZeroTier as a container on DSM 7:

```yaml
# Add this as a separate Project in Container Manager named "zerotier-one"
services:
  zerotier:
    image: zerotier/zerotier-synology:latest
    container_name: zerotier-one
    restart: unless-stopped
    network_mode: host
    devices:
      - /dev/net/tun
    cap_add:
      - NET_ADMIN
      - SYS_ADMIN
    volumes:
      - /volume1/docker/zerotier-one/data:/var/lib/zerotier-one
```

After the container starts, SSH in and run:

```bash
# Join your network
docker exec zerotier-one zerotier-cli join <YOUR_NETWORK_ID>

# (Optional) Orbit your moon
docker exec zerotier-one zerotier-cli orbit <MOON_WORLD_ID> <MOON_SEED_ID>
```

Authorize the NAS node in your ZeroTier network admin, then confirm the IP:

```bash
docker exec zerotier-one zerotier-cli listnetworks
```

### Step 2 — Allow ZeroTier traffic into Docker

SSH in and run (add to DSM Task Scheduler → Triggered Task → Boot-up for persistence):

```bash
iptables -I DOCKER-USER -i zt+ -j ACCEPT 2>/dev/null || \
iptables -I FORWARD -i zt+ -j ACCEPT 2>/dev/null
```

### Step 3 — Install Kali-AI-term via Container Manager

1. Download [`docker-compose.synology.yml`](./docker-compose.synology.yml) from this repo
2. In DSM, open **Container Manager → Project → Create**
3. Give it the name `kali-ai-term`
4. Set the path to `/volume1/docker/kali-ai-term`
5. Upload or paste the contents of `docker-compose.synology.yml`
6. In the **Environment** section, add:
   - `ADMIN_PASSWORD` = your chosen password
   - `AUTH_SECRET` = output of `openssl rand -hex 32` (run in SSH)
7. Click **Next → Done**

---

## Accessing the App

Once running, open a browser on any device in your ZeroTier network:

```
http://<synology-zerotier-ip>:31337
```

Find your Synology's ZeroTier IP:

```bash
docker exec zerotier-one zerotier-cli listnetworks
```

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Can't reach `:31337` | ZeroTier IP assigned? iptables rule added? Container running? |
| ZeroTier not getting IP | Device authorized in network admin? Moon reachable? |
| Ollama slow / no AI | CPU-only mode — use `smollm2:135m` (default, 91 MB) |
| `docker exec zerotier-one ...` fails | Container not running: `docker start zerotier-one` |

View container logs:

```bash
docker logs kali-ai-term-app
docker logs zerotier-one
```

---

## References

- [zerotier/ZeroTierOne](https://github.com/zerotier/ZeroTierOne) — ZeroTier source and packages
- [Synology Container Manager docs](https://kb.synology.com/en-global/DSM/help/ContainerManager/docker_project?version=7)
