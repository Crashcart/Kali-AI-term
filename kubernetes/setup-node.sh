#!/bin/bash

################################################################################
# Kubernetes Worker Node Setup Script
#
# Purpose: Install Docker + Kubernetes on a worker node (Linux or Windows)
# This script auto-detects the OS and configures appropriately
#
# Usage: sudo ./setup-node.sh [OPTIONS]
#   --control-plane-ip IP_ADDRESS   IP of the control plane (required)
#   --token TOKEN                   Kubeadm/K3s join token (required)
#   --node-name NAME                Name for this node (optional)
#   --k3s                           Join K3s cluster (default)
#   --kubeadm                       Join Kubeadm cluster
#   --help                          Show this help message
#
# Examples:
#   Linux:   sudo ./setup-node.sh --control-plane-ip 192.168.1.10 --token mytoken123
#   Windows: powershell -ExecutionPolicy Bypass -File setup-node.ps1 -ControlPlaneIP 192.168.1.10 -Token mytoken123
#
# Requirements:
#   - Linux: Ubuntu 20.04+, CentOS 8+, or similar
#   - Windows: Windows Server 2019 or later
#   - Network access to control plane IP
#   - Root/Administrator access
#
# Author: Generated for multi-node Kubernetes setup
# Date: 2026-04-13
################################################################################

set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration variables
CONTROL_PLANE_IP=""
K3S_TOKEN=""
NODE_NAME=""
K8S_TYPE="k3s"
LOG_FILE="/var/log/k8s-node-setup.log"
CONFIG_DIR="${HOME}/.kube"

# Functions
log_info() {
    local msg="$1"
    echo -e "${BLUE}[INFO]${NC} $msg" | tee -a "$LOG_FILE"
}

log_success() {
    local msg="$1"
    echo -e "${GREEN}[SUCCESS]${NC} $msg" | tee -a "$LOG_FILE"
}

log_warning() {
    local msg="$1"
    echo -e "${YELLOW}[WARNING]${NC} $msg" | tee -a "$LOG_FILE"
}

log_error() {
    local msg="$1"
    echo -e "${RED}[ERROR]${NC} $msg" | tee -a "$LOG_FILE" >&2
}

show_help() {
    grep "^#" "$0" | grep "^#" | sed 's/#\s*//' | head -25
}

detect_os() {
    log_info "Detecting operating system..."

    # Try to detect Windows first (when running under WSL or native)
    if uname -a | grep -qi "microsoft"; then
        echo "wsl"
        return 0
    fi

    if uname -a | grep -qi "windows"; then
        echo "windows"
        return 0
    fi

    # Detect Linux distributions
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo "$ID"
    else
        log_warning "Cannot reliably detect OS"
        echo "unknown"
    fi
}

check_requirements() {
    log_info "Checking system requirements..."

    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run with sudo or as root"
        exit 1
    fi

    # Validate required parameters
    if [ -z "$CONTROL_PLANE_IP" ]; then
        log_error "Missing required parameter: --control-plane-ip"
        show_help
        exit 1
    fi

    if [ -z "$K3S_TOKEN" ]; then
        log_error "Missing required parameter: --token"
        show_help
        exit 1
    fi

    # Test connectivity to control plane
    log_info "Testing connectivity to control plane ($CONTROL_PLANE_IP)..."
    if timeout 5 bash -c "echo >/dev/tcp/$CONTROL_PLANE_IP/6443" 2>/dev/null; then
        log_success "Control plane is reachable"
    else
        log_warning "Cannot reach control plane yet. Continuing anyway..."
    fi

    log_success "Requirements check passed"
}

install_docker_linux() {
    log_info "Installing Docker on Linux..."

    if command -v docker &> /dev/null; then
        local docker_version=$(docker --version)
        log_success "Docker already installed: $docker_version"
        return 0
    fi

    local os_name="${1:-ubuntu}"

    case "$os_name" in
        ubuntu|debian)
            apt-get update -qq
            apt-get install -y -qq docker.io
            systemctl enable docker
            systemctl start docker
            ;;
        centos|rhel|fedora)
            yum install -y docker
            systemctl enable docker
            systemctl start docker
            ;;
        *)
            log_error "Unsupported Linux distribution: $os_name"
            exit 1
            ;;
    esac

    log_success "Docker installed successfully"
}

install_kubernetes_tools_linux() {
    log_info "Installing Kubernetes tools on Linux..."

    local os_name="${1:-ubuntu}"

    case "$os_name" in
        ubuntu|debian)
            apt-get update
            apt-get install -y apt-transport-https ca-certificates curl
            curl -fsSLo /etc/apt/keyrings/kubernetes-archive-keyring.gpg https://dl.k8s.io/apt/doc/apt-key.gpg
            echo "deb [signed-by=/etc/apt/keyrings/kubernetes-archive-keyring.gpg] https://apt.kubernetes.io/ kubernetes-xenial main" | tee /etc/apt/sources.list.d/kubernetes.list
            apt-get update
            apt-get install -y kubeadm kubelet kubectl
            apt-mark hold kubeadm kubelet kubectl
            ;;
        centos|rhel|fedora)
            cat <<EOF > /etc/yum.repos.d/kubernetes.repo
[kubernetes]
name=Kubernetes
baseurl=https://packages.cloud.google.com/yum/repos/kubernetes-el7-\$basearch
enabled=1
gpgcheck=1
repo_gpgcheck=1
gpgkey=https://packages.cloud.google.com/yum/doc/yum-key.gpg https://packages.cloud.google.com/yum/doc/rpm-package-key.gpg
EOF
            yum install -y kubeadm kubelet kubectl --disableexcludes=kubernetes
            ;;
        *)
            log_error "Unsupported OS: $os_name"
            exit 1
            ;;
    esac

    systemctl enable kubelet
    systemctl start kubelet

    log_success "Kubernetes tools installed successfully"
}

join_cluster_k3s() {
    log_info "Joining K3s cluster..."

    local k3s_url="https://${CONTROL_PLANE_IP}:6443"

    log_info "Downloading K3s and joining cluster..."
    curl -sfL https://get.k3s.io | K3S_URL="$k3s_url" K3S_TOKEN="$K3S_TOKEN" sh -

    if [ -n "$NODE_NAME" ]; then
        log_info "Setting node name to: $NODE_NAME"
        # K3s uses the hostname, so we need to update it
        hostnamectl set-hostname "$NODE_NAME" || true
    fi

    log_success "Successfully joined K3s cluster"
}

join_cluster_kubeadm() {
    log_info "Joining Kubeadm cluster..."

    # Parse token format (should contain ca-cert-hash)
    # Expected format: TOKEN --discovery-token-ca-cert-hash sha256:HASH
    local token_part=$(echo "$K3S_TOKEN" | cut -d' ' -f1)
    local hash_part=$(echo "$K3S_TOKEN" | grep -oP 'sha256:\K[a-f0-9]+' || echo "")

    if [ -z "$hash_part" ]; then
        log_error "Invalid token format. Expected: token --discovery-token-ca-cert-hash sha256:HASH"
        exit 1
    fi

    log_info "Running kubeadm join..."
    kubeadm join "${CONTROL_PLANE_IP}:6443" \
        --token "$token_part" \
        --discovery-token-ca-cert-hash "sha256:${hash_part}" \
        2>&1 | tee -a "$LOG_FILE"

    if [ -n "$NODE_NAME" ]; then
        log_info "Setting node name to: $NODE_NAME"
        hostnamectl set-hostname "$NODE_NAME" || true
    fi

    log_success "Successfully joined Kubeadm cluster"
}

configure_kubelet_on_boot() {
    log_info "Configuring kubelet to start on boot..."

    systemctl enable kubelet

    # Create systemd service dependency to ensure Docker starts first
    mkdir -p /etc/systemd/system/kubelet.service.d
    cat > /etc/systemd/system/kubelet.service.d/10-docker-dependency.conf <<EOF
[Unit]
After=docker.service
Requires=docker.service

[Service]
Restart=on-failure
RestartSec=10s
EOF

    systemctl daemon-reload
    log_success "Kubelet configured to start on boot"
}

setup_kubeconfig() {
    log_info "Setting up kubeconfig..."

    mkdir -p "$CONFIG_DIR"

    # For K3s nodes, kubeconfig is typically already set up
    # For kubeadm nodes, kubelet handles its own bootstrap
    log_success "Kubeconfig setup complete"
}

verify_node_joined() {
    log_info "Verifying node joined cluster..."

    # Wait a bit for the node to register
    sleep 10

    local node_status=$(kubectl get node --no-headers 2>/dev/null | wc -l)

    if [ "$node_status" -gt 0 ]; then
        log_success "Node successfully joined cluster"
        log_info "Current nodes:"
        kubectl get nodes -o wide || true
    else
        log_warning "Cluster info not yet available. Node may still be joining..."
        log_info "Check status later with: kubectl get nodes"
    fi
}

register_node_info() {
    log_info "Registering node information..."

    local node_info_file="/var/lib/k8s-node-info.json"
    local node_hostname=$(hostname)
    local node_os=$(detect_os)
    local docker_version=$(docker --version 2>/dev/null || echo "unknown")
    local k8s_version=$(kubectl version --client --short 2>/dev/null || echo "unknown")

    # Create node info JSON
    cat > "$node_info_file" <<EOF
{
  "hostname": "$node_hostname",
  "os_type": "$node_os",
  "docker_version": "$docker_version",
  "kubernetes_version": "$k8s_version",
  "join_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "control_plane_ip": "$CONTROL_PLANE_IP",
  "status": "joined"
}
EOF

    chmod 644 "$node_info_file"
    log_success "Node information registered: $node_info_file"
}

display_final_status() {
    echo ""
    echo -e "${BLUE}========== NODE SETUP COMPLETE ==========${NC}"
    echo "Node Hostname: $(hostname)"
    echo "OS: $(detect_os)"
    echo "Docker: $(docker --version 2>/dev/null || echo 'Not available')"
    echo "Control Plane: $CONTROL_PLANE_IP"
    echo ""
    echo -e "${GREEN}This node is now joining the cluster!${NC}"
    echo ""
    echo "From control plane, verify node with:"
    echo "  kubectl get nodes --watch"
    echo ""
}

# Main execution
main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --control-plane-ip)
                CONTROL_PLANE_IP="$2"
                shift 2
                ;;
            --token)
                K3S_TOKEN="$2"
                shift 2
                ;;
            --node-name)
                NODE_NAME="$2"
                shift 2
                ;;
            --k3s)
                K8S_TYPE="k3s"
                shift
                ;;
            --kubeadm)
                K8S_TYPE="kubeadm"
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    log_info "Starting Kubernetes worker node setup"

    check_requirements

    local os_type=$(detect_os)
    log_info "Detected OS: $os_type"

    if [ "$os_type" == "windows" ] || [ "$os_type" == "wsl" ]; then
        log_warning "Windows detected. Use PowerShell script instead: setup-node.ps1"
        exit 1
    fi

    # Linux setup
    install_docker_linux "$os_type"
    install_kubernetes_tools_linux "$os_type"

    if [ "$K8S_TYPE" == "k3s" ]; then
        join_cluster_k3s
    else
        join_cluster_kubeadm
    fi

    configure_kubelet_on_boot
    setup_kubeconfig
    register_node_info
    verify_node_joined
    display_final_status

    log_success "Worker node setup complete!"
}

main "$@"
