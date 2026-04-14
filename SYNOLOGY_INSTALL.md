# Kali-AI-term on Synology DSM 7

This guide installs Kali-AI-term on a Synology NAS running **DSM 7** with access via a self-hosted **ZeroTier moon**.

> **ZeroTier moon setup:** [Crashcart/Zerotierone-moon](https://github.com/Crashcart/Zerotierone-moon)
> Complete that setup first — this installer expects the `zerotierone-moon` container to already be running.

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Synology DSM 7 | DS918+ or compatible |
| Container Manager | Install from Package Center |
| SSH access | Control Panel → Terminal & SNMP |
| ZeroTier moon running | [Crashcart/Zerotierone-moon](https://github.com/Crashcart/Zerotierone-moon) |
| ZeroTier Network ID | 16-char hex from your ZeroTier network |

---

## Method A — SSH Installer (Recommended)

SSH into your Synology as an administrator and run:

```bash
cd /volume1/docker
git clone https://github.com/Crashcart/Kali-AI-term.git kali-ai-term
cd kali-ai-term
bash install-synology.sh
```

The script will prompt for:

| Prompt | Description |
|--------|-------------|
| Admin password | Web UI login password |
| ZeroTier Network ID | 16-character hex network ID |

It will then:
1. Verify the `zerotierone-moon` container is running
2. Join your ZeroTier network via the moon
3. Configure iptables to allow ZeroTier traffic into Docker
4. Start the Kali-AI-term containers
5. Print the access URL using your ZeroTier IP

> **Authorize the node** — if your network requires it, approve the NAS node in your ZeroTier network admin after joining.

---

## Method B — Container Manager GUI (No SSH for app install)

### Step 1 — Set up the ZeroTier moon

Follow [Crashcart/Zerotierone-moon](https://github.com/Crashcart/Zerotierone-moon) to deploy your moon on the NAS. Once complete the `zerotierone-moon` container will be running and you'll have a Moon ID.

### Step 2 — Join your ZeroTier network (SSH)

```bash
# Join the network
docker exec zerotierone-moon zerotier-cli join <YOUR_NETWORK_ID>

# Confirm the IP once authorized
docker exec zerotierone-moon zerotier-cli listnetworks
```

### Step 3 — Allow ZeroTier traffic into Docker (SSH)

```bash
iptables -I DOCKER-USER -i zt+ -j ACCEPT 2>/dev/null || \
iptables -I FORWARD -i zt+ -j ACCEPT 2>/dev/null
```

To persist across reboots: **Control Panel → Task Scheduler → Create Triggered Task (Boot-up)** and paste the command above.

### Step 4 — Deploy Kali-AI-term via Container Manager

1. Download [`docker-compose.synology.yml`](./docker-compose.synology.yml) from this repo
2. In DSM, open **Container Manager → Project → Create**
3. Name: `kali-ai-term`
4. Path: `/volume1/docker/kali-ai-term`
5. Upload or paste the contents of `docker-compose.synology.yml`
6. In the **Environment** section, add:
   - `ADMIN_PASSWORD` — your chosen login password
   - `AUTH_SECRET` — output of `openssl rand -hex 32` (run in SSH)
7. Click **Next → Done**

---

## Accessing the App

From any device that has orbited the moon ([Crashcart/Zerotierone-moon](https://github.com/Crashcart/Zerotierone-moon)):

```
http://<synology-zerotier-ip>:31337
```

Find your Synology's ZeroTier IP:

```bash
docker exec zerotierone-moon zerotier-cli listnetworks
```

---

## Orbiting the moon on client devices

After the moon is set up, run this on every device that needs access:

```bash
zerotier-cli orbit <MOON_ID> <MOON_ID>
```

> The Moon ID is printed by the [Crashcart/Zerotierone-moon](https://github.com/Crashcart/Zerotierone-moon) installer, or retrieve it with:
> ```bash
> docker exec zerotierone-moon zerotier-cli listmoons
> ```

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Can't reach `:31337` | ZeroTier IP assigned? iptables rule added? Containers running? |
| No ZeroTier IP | Node authorized in network admin? Moon running? |
| `zerotierone-moon` not found | Set it up: [Crashcart/Zerotierone-moon](https://github.com/Crashcart/Zerotierone-moon) |
| Ollama slow / no AI | CPU-only mode on NAS — default `smollm2:135m` (91 MB) is optimal |

View logs:

```bash
docker logs kali-ai-term-app
docker logs zerotierone-moon
```
