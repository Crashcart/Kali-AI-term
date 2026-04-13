# Kubernetes Multi-Node Cluster Setup

Complete all-in-one solution for setting up a dynamic Docker + Kubernetes cluster across multiple machines (Windows, Linux, macOS) connected via **ZeroTier One** virtual network.

## Overview

This toolkit provides automated scripts to:
- **Install Docker** on Linux, Windows, and macOS nodes
- **Set up Kubernetes** control plane (on one machine) and worker nodes (on others)
- **Manage dynamic nodes** that come and go (auto-join, health monitoring)
- **Monitor cluster health** and auto-remediate failures
- **Document node information** for system administration

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   ZeroTier One Virtual Network                   │
│  (Connects all nodes regardless of physical location/network)    │
└────────┬─────────────────────────┬──────────────────┬───────────┘
         │                         │                  │
    ┌────▼──────┐          ┌─────▼────────┐   ┌──────▼──────┐
    │  Control  │          │ Worker Node  │   │ Worker Node │
    │  Plane    │          │   (Linux)    │   │  (Windows)  │
    │ (Linux)   │          │              │   │             │
    │           │          │              │   │             │
    │ - Docker  │          │ - Docker     │   │ - Docker    │
    │ - K3s     │          │ - Kubelet    │   │ - Kubelet   │
    │ - CNI     │          │ - Pods       │   │ - Pods      │
    └───────────┘          └──────────────┘   └─────────────┘
```

## Quick Start

### 1. Run Interactive Setup Wizard (Recommended)

```bash
# On your primary control machine
cd kubernetes
chmod +x quick-deploy.sh
./quick-deploy.sh
```

Follow the interactive menus to:
- Check prerequisites
- Set up control plane
- Get join token for worker nodes
- Set up worker nodes
- Monitor cluster health

### 2. Manual Setup

#### On Control Plane Machine (Linux)

```bash
# Make scripts executable
chmod +x setup-control-plane.sh setup-node.sh node-health-monitor.sh

# Run setup (with sudo)
sudo ./setup-control-plane.sh --k3s --cluster-name "my-cluster"

# This will:
# - Install Docker
# - Install K3s (lightweight Kubernetes)
# - Install Flannel CNI plugin
# - Generate join token for workers
# - Save configuration to config/cluster-config.env
```

**Output files:**
- `logs/join-token.txt` - Token and instructions for worker nodes
- `logs/cluster-events.log` - Cluster event log
- `config/cluster-config.env` - Cluster configuration

#### On Worker Nodes (Linux or Windows)

**For Linux Workers:**

```bash
# Get join token from control plane
# Copy the token from /logs/join-token.txt

# On worker node:
sudo ./setup-node.sh \
  --control-plane-ip 192.168.1.10 \
  --token "your-token-here" \
  --node-name "worker-1"
```

**For Windows Workers:**

```powershell
# Use PowerShell instead (requires creating setup-node.ps1)
# For now, follow manual Docker + Kubernetes installation
# Then run: kubeadm join <control-plane-ip>:6443 --token <token>
```

## File Structure

```
kubernetes/
├── setup-control-plane.sh          # Initialize K8s control plane
├── setup-node.sh                   # Join worker node to cluster
├── node-health-monitor.sh          # Monitor cluster health
├── quick-deploy.sh                 # Interactive setup wizard
├── config/
│   ├── cluster-config.env          # Cluster configuration
│   ├── kubeadm-config.yaml         # Kubeadm initialization config
│   └── docker-daemon.json          # Docker daemon settings
├── logs/
│   ├── join-token.txt              # Worker join token (generated)
│   ├── cluster-events.log          # Event log (generated)
│   ├── node-status-latest.json     # Node status JSON (generated)
│   └── health-summary.txt          # Health summary (generated)
├── README.md                       # This file
└── QUICKSTART.md                   # Quick reference guide
```

## Configuration

Edit `config/cluster-config.env` to customize:

```bash
# Cluster information
CLUSTER_NAME="my-cluster"
K8S_TYPE="k3s"              # k3s or kubeadm
CNI_PLUGIN="flannel"        # flannel or calico

# Networking
POD_SUBNET="10.244.0.0/16"
SERVICE_SUBNET="10.96.0.0/12"

# ZeroTier network
ZEROTIER_NETWORK_ID="12ac4a63c9a4520f"
ZEROTIER_MEMBER_ID="462d8eabc4"

# Node expectations
EXPECTED_LINUX_NODES=3
EXPECTED_WINDOWS_NODES=2
```

## Monitoring Cluster Health

### Start Real-time Monitor

```bash
./node-health-monitor.sh --interval 30 --log-dir ./logs
```

This will:
- Check node status every 30 seconds
- Detect failures automatically
- Log all events
- Generate JSON status reports
- Create human-readable health summaries

### View Status

```bash
# List all nodes
kubectl get nodes -o wide

# Watch nodes (auto-refresh)
kubectl get nodes --watch

# Node details
kubectl describe node <node-name>

# Cluster info
kubectl cluster-info

# Recent events
cat logs/cluster-events.log
```

## Managing Nodes

### Check Node Status

```bash
# All nodes
kubectl get nodes

# Detailed view
kubectl get nodes -o wide

# Node info (JSON)
cat logs/node-status-latest.json
```

### Cordon Node (Prevent New Pods)

```bash
kubectl cordon <node-name>
```

### Uncordon Node (Re-enable Pod Scheduling)

```bash
kubectl uncordon <node-name>
```

### Drain Node (Safely Remove All Pods)

```bash
kubectl drain <node-name> --ignore-daemonsets
```

### Remove Node from Cluster

```bash
# On the node being removed:
kubeadm reset

# On control plane:
kubectl delete node <node-name>
```

## Adding New Nodes

When a new machine powers on and has ZeroTier network access:

1. **Copy setup files to new node:**
   ```bash
   scp -r kubernetes/ user@new-node:/path/to/
   ```

2. **On new node, join cluster:**
   ```bash
   cd kubernetes
   sudo ./setup-node.sh \
     --control-plane-ip <control-plane-ip> \
     --token <token-from-join-token.txt> \
     --node-name "new-worker"
   ```

3. **Verify node joined:**
   ```bash
   kubectl get nodes  # From control plane
   ```

## Troubleshooting

### Node Not Joining Cluster

**Check connectivity:**
```bash
ping <control-plane-ip>
telnet <control-plane-ip> 6443
```

**Verify join token:**
- Token should be in `logs/join-token.txt`
- Token expires in 24 hours (generate new one if needed)

**Check logs:**
```bash
cat logs/cluster-events.log
journalctl -u kubelet -f      # kubelet logs
systemctl status docker        # Docker status
```

**Reset and retry:**
```bash
sudo kubeadm reset
sudo ./setup-node.sh --control-plane-ip <IP> --token <TOKEN>
```

### Pods Not Scheduling

```bash
# Check node capacity
kubectl top nodes
kubectl describe node <node-name>

# Check pod events
kubectl describe pod <pod-name> -n <namespace>

# Check network plugin
kubectl get pods -n kube-system | grep flannel  # or calico
```

### Docker Issues

```bash
# Check Docker status
systemctl status docker
docker ps
docker version

# Check logs
journalctl -u docker -f

# Restart Docker
sudo systemctl restart docker
```

### Windows Node Issues

Windows nodes require specific network configuration:
- Flannel (recommended) or Calico CNI
- Windows Server 2019 or later
- Compatible Docker version (Desktop or Engine)

For detailed Windows setup, see Microsoft's [Windows Containers on Kubernetes](https://kubernetes.io/docs/setup/production-environment/windows/intro-windows-in-kubernetes/) documentation.

## Cluster Operations

### View Cluster Information

```bash
kubectl cluster-info
kubectl get nodes -o wide
kubectl get namespaces
kubectl get all --all-namespaces
```

### Deploy Test Workload

```bash
# Create test namespace
kubectl create namespace test

# Deploy nginx
kubectl run nginx --image=nginx -n test

# Verify pod
kubectl get pods -n test
```

### Scale Cluster

Cluster automatically scales based on:
- Available hardware
- Pod resource requests
- Node availability

To add more nodes:
1. Ensure new machine has ZeroTier network access
2. Run `setup-node.sh` to join
3. Monitor with `kubectl get nodes --watch`

## Performance Tuning

### For Larger Clusters (10+ nodes)

Update `config/cluster-config.env`:

```bash
# Increase resource allocations
POD_SUBNET="10.0.0.0/8"              # Larger pod network
SERVICE_SUBNET="10.96.0.0/12"        # Keep services same

# Kubernetes version for better stability
KUBE_VERSION="1.28.0"                # Specific stable version

# Health check tuning
HEALTH_CHECK_INTERVAL=60             # Slower checks for large clusters
```

### For Edge/IoT Deployments

```bash
# Use lightweight Kubernetes
K8S_TYPE="k3s"

# Minimal resource usage
# - Automatically handles low-memory nodes
# - K3s: ~512MB RAM minimum
```

## Security Considerations

> **Warning**: This setup is suitable for **development, testing, and home labs**. For production:
> - Enable RBAC and Pod Security Policies
> - Use TLS for inter-node communication
> - Implement network policies
> - Use private container registries
> - Enable audit logging
> - Implement backup/disaster recovery

## Network Architecture

### ZeroTier One Integration

Nodes communicate via ZeroTier virtual network overlay:

```
Node A (IP: 192.168.1.100)  ─┐
                              ├─> ZeroTier Network ─> Kubernetes Network
Node B (IP: 10.0.0.50)      ─┤    (172.26.0.0/7)    (10.244.0.0/16)
                              │
Node C (Windows Server)      ─┘
```

**Benefits:**
- ✓ Works across any physical network (home, office, cloud)
- ✓ Unified virtual network for all nodes
- ✓ Automatic routing and discovery
- ✓ Works through firewalls/NAT
- ✓ Encrypted by default

## Getting Help

### View Logs

```bash
# Cluster events
cat logs/cluster-events.log

# Health status
cat logs/health-summary.txt

# Node information
cat logs/node-status-latest.json

# Kubelet logs (on node)
journalctl -u kubelet -f

# Docker logs (on node)
journalctl -u docker -f
```

### Debug Commands

```bash
# Cluster connectivity
kubectl cluster-info

# Node status
kubectl get nodes -o yaml

# Node conditions
kubectl describe node <node-name>

# Pod status
kubectl get pods --all-namespaces

# Events
kubectl get events --all-namespaces --sort-by='.lastTimestamp'
```

### Documentation

- [Kubernetes Official Docs](https://kubernetes.io/docs/)
- [K3s Documentation](https://docs.k3s.io/)
- [Docker Documentation](https://docs.docker.com/)
- [ZeroTier Documentation](https://docs.zerotier.com/)

## Support & Contributing

For issues or improvements:
1. Check logs in `logs/` directory
2. Review troubleshooting section above
3. Check official Kubernetes/K3s documentation

## License

This setup toolkit is provided as-is for learning and development purposes.

---

**Version**: 1.0  
**Last Updated**: 2026-04-13  
**Target**: Multi-node Kubernetes cluster with 5-10 nodes
