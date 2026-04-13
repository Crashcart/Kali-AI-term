# Quick Start Guide

Fast-track setup for experienced users.

## 30-Second Setup

```bash
# Control Plane (Linux)
sudo ./setup-control-plane.sh --k3s

# Worker Nodes (after getting join token from logs/join-token.txt)
sudo ./setup-node.sh --control-plane-ip <IP> --token <TOKEN>

# Monitor
./node-health-monitor.sh
```

## One-Minute Commands

### Control Plane

```bash
# 1. Make executable
chmod +x setup-control-plane.sh setup-node.sh node-health-monitor.sh

# 2. Install (choose one)
sudo ./setup-control-plane.sh --k3s              # Lightweight (recommended)
sudo ./setup-control-plane.sh --kubeadm --cni calico  # Standard K8s

# 3. Get join token
cat logs/join-token.txt
```

### Worker Nodes

```bash
# Linux worker
sudo ./setup-node.sh --control-plane-ip 192.168.1.10 --token <TOKEN>

# Verify
kubectl get nodes  # From control plane
```

## Configuration Quick Reference

### Use Interactive Wizard

```bash
./quick-deploy.sh
```

### Manual Configuration

Edit `config/cluster-config.env`:
```bash
CLUSTER_NAME="my-cluster"
K8S_TYPE="k3s"
CNI_PLUGIN="flannel"
ZEROTIER_NETWORK_ID="your-network-id"
```

## Common Operations

| Task | Command |
|------|---------|
| List nodes | `kubectl get nodes -o wide` |
| Watch nodes | `kubectl get nodes --watch` |
| Node status | `kubectl describe node <node>` |
| Node logs | `journalctl -u kubelet -f` |
| Cordon node | `kubectl cordon <node>` |
| Uncordon node | `kubectl uncordon <node>` |
| Drain node | `kubectl drain <node> --ignore-daemonsets` |
| Cluster info | `kubectl cluster-info` |
| Events | `kubectl get events -A` |
| Monitor cluster | `./node-health-monitor.sh` |

## Setup Scenarios

### Scenario 1: Local Network Cluster (Recommended)

```bash
# Control: Ubuntu machine on 192.168.1.100
sudo ./setup-control-plane.sh --k3s

# Worker 1: Ubuntu on 192.168.1.101
sudo ./setup-node.sh --control-plane-ip 192.168.1.100 --token <TOKEN>

# Worker 2: Windows Server on 192.168.1.102
# (Use manual kubeadm join after Docker + K8s installed)
```

### Scenario 2: ZeroTier Virtual Network

```bash
# All nodes on ZeroTier network (172.26.x.x)
# Use ZeroTier IPs for control-plane-ip

# Control Plane (ZeroTier IP: 172.26.0.1)
sudo ./setup-control-plane.sh --k3s

# Workers (join via ZeroTier IP)
sudo ./setup-node.sh --control-plane-ip 172.26.0.1 --token <TOKEN>
```

### Scenario 3: Mixed Windows + Linux

```bash
# Control: Linux (Ubuntu 20.04+)
sudo ./setup-control-plane.sh --k3s --cni flannel

# Linux Workers
sudo ./setup-node.sh --control-plane-ip <IP> --token <TOKEN>

# Windows Workers
# - Install Docker Desktop/Engine
# - Install Kubernetes (kubeadm, kubelet, kubectl)
# - Run: kubeadm join <IP>:6443 --token <TOKEN> --discovery-token-ca-cert-hash sha256:<HASH>
```

## Troubleshooting Quick Checks

```bash
# 1. Network connectivity
ping <control-plane-ip>
telnet <control-plane-ip> 6443

# 2. Docker running
docker ps
systemctl status docker

# 3. Kubelet running
systemctl status kubelet
journalctl -u kubelet -n 20  # Last 20 lines

# 4. Cluster health
kubectl cluster-info
kubectl get nodes

# 5. Logs
cat logs/cluster-events.log
cat logs/health-summary.txt
```

## Token Management

```bash
# View current token
cat logs/join-token.txt

# Generate new token (on control plane, if expired)
# K3s: cat /var/lib/rancher/k3s/server/node-token
# Kubeadm: kubeadm token create --ttl 24h
```

## Scaling Guide

| Size | Nodes | Notes |
|------|-------|-------|
| Small | 3-5 | Suitable for development/testing |
| Medium | 5-10 | Production home lab |
| Large | 10+ | Adjust monitoring interval, consider load balancing |

For 10+ nodes:
```bash
# Increase monitoring interval
./node-health-monitor.sh --interval 60
```

## One-Liners

```bash
# Check all node status with details
kubectl get nodes -o wide && kubectl get nodes -o yaml | grep -E 'name:|Ready'

# Watch for pod issues
kubectl get pods --all-namespaces --field-selector=status.phase!=Running --watch

# Monitor node resources
watch 'kubectl top nodes; kubectl top pods --all-namespaces'

# Quick cluster health
echo "Nodes:" $(kubectl get nodes --no-headers | wc -l) && \
echo "Pods:" $(kubectl get pods --all-namespaces --no-headers | wc -l) && \
echo "Services:" $(kubectl get services --all-namespaces --no-headers | wc -l)
```

## Default Configuration

```yaml
Control Plane:
  - K3s lightweight Kubernetes
  - Flannel CNI plugin
  - Pod Network: 10.244.0.0/16
  - Service Network: 10.96.0.0/12

Health Monitoring:
  - Interval: 30 seconds
  - Auto-cordon failed nodes: YES
  - Event logging: YES

Security:
  - Dev/Test mode (not production-ready)
  - Enable RBAC: NO
  - Enable Pod Security: NO
```

## Files Generated After Setup

```
logs/
├── join-token.txt              # Copy to worker nodes
├── cluster-events.log          # All cluster events
├── node-status-latest.json     # Current node status
├── health-summary.txt          # Human-readable summary
└── k8s-node-setup.log          # Detailed setup logs
```

## Next Steps

1. ✅ **Run setup** - Execute setup-control-plane.sh + setup-node.sh
2. 📊 **Monitor** - Run ./node-health-monitor.sh
3. 📋 **Deploy** - Use kubectl to deploy applications
4. 🔄 **Scale** - Add more nodes as needed

---

**For detailed help**: See `README.md`
