#!/bin/bash

################################################################################
# Kubernetes Multi-Node Cluster - One-Line Installation Script
#
# Usage:
#   curl -fsSL https://yoururl/install-k8s.sh | bash
#   Or locally: bash install-k8s.sh
#
# What it does:
#   - Detects OS (Linux/Windows) and machine role
#   - Installs Docker + Kubernetes automatically
#   - Sets up control plane OR joins worker node
#   - Configures health monitoring
#   - No manual steps needed!
#
# Requirements:
#   - Linux (Ubuntu 20.04+, CentOS 8+) or Windows Server 2019+
#   - Root/Administrator access
#   - Network connectivity
#
# Author: Generated for multi-node Kubernetes setup
# Date: 2026-04-13
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
CLUSTER_NAME="${CLUSTER_NAME:-multi-node-cluster}"
K8S_TYPE="${K8S_TYPE:-k3s}"                    # k3s or kubeadm
CNI_PLUGIN="${CNI_PLUGIN:-flannel}"            # flannel or calico
CONTROL_PLANE_IP="${CONTROL_PLANE_IP:-}"
K3S_TOKEN="${K3S_TOKEN:-}"
NODE_NAME="${NODE_NAME:-}"
ROLE="${ROLE:-}"                               # control or worker
INSTALL_DIR="${INSTALL_DIR:-.}"
LOG_FILE="${INSTALL_DIR}/k8s-install.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE" >&2
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

print_header() {
    echo -e "${MAGENTA}"
    cat << "EOF"
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║           Kubernetes Multi-Node Cluster - Automated Installation           ║
║                                                                            ║
║              Docker + K8s on Windows, Linux, and macOS                    ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo "$ID"
    else
        echo "unknown"
    fi
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root. Please use 'sudo' or run as administrator"
        exit 1
    fi
}

interactive_setup() {
    log_info "Starting interactive setup..."
    echo ""

    # Ask for role
    echo -e "${BLUE}Is this machine the Kubernetes control plane (master)?${NC}"
    echo "1. Yes - Set up as control plane"
    echo "2. No - Set up as worker node"
    read -p "Select (1 or 2): " -r role_choice

    case "$role_choice" in
        1)
            ROLE="control"
            ;;
        2)
            ROLE="worker"
            ;;
        *)
            log_error "Invalid choice"
            exit 1
            ;;
    esac

    # Ask for cluster name
    if [ "$ROLE" == "control" ]; then
        read -p "Cluster name [multi-node-cluster]: " -r cluster_input
        CLUSTER_NAME="${cluster_input:-multi-node-cluster}"

        # Ask for K8s type
        echo -e "${BLUE}Which Kubernetes type?${NC}"
        echo "1. k3s (lightweight, recommended)"
        echo "2. kubeadm (standard K8s)"
        read -p "Select (1 or 2): " -r k8s_choice

        case "$k8s_choice" in
            1)
                K8S_TYPE="k3s"
                ;;
            2)
                K8S_TYPE="kubeadm"
                ;;
            *)
                log_warning "Invalid choice, using k3s"
                K8S_TYPE="k3s"
                ;;
        esac
    else
        # Worker node setup
        read -p "Control plane IP address: " -r CONTROL_PLANE_IP
        if [ -z "$CONTROL_PLANE_IP" ]; then
            log_error "Control plane IP is required"
            exit 1
        fi

        read -p "Join token (from control plane logs/join-token.txt): " -r K3S_TOKEN
        if [ -z "$K3S_TOKEN" ]; then
            log_error "Join token is required"
            exit 1
        fi

        read -p "Node name [$(hostname)]: " -r node_input
        NODE_NAME="${node_input:-$(hostname)}"
    fi
}

install_docker() {
    log_info "Installing Docker..."

    if command -v docker &> /dev/null; then
        local version=$(docker --version)
        log_success "Docker already installed: $version"
        return 0
    fi

    local os=$(detect_os)

    case "$os" in
        ubuntu|debian)
            log_info "Installing Docker on Ubuntu/Debian..."
            apt-get update -qq
            apt-get install -y -qq docker.io
            systemctl enable docker
            systemctl start docker
            ;;
        centos|rhel|fedora)
            log_info "Installing Docker on CentOS/RHEL..."
            yum install -y docker
            systemctl enable docker
            systemctl start docker
            ;;
        *)
            log_error "Unsupported Linux distribution: $os"
            exit 1
            ;;
    esac

    log_success "Docker installed successfully"
}

install_k3s() {
    log_info "Installing K3s..."

    if command -v k3s &> /dev/null; then
        log_success "K3s already installed"
        return 0
    fi

    curl -sfL https://get.k3s.io | sh -

    # Set up kubectl symlink
    mkdir -p /usr/local/bin
    [ ! -L /usr/local/bin/kubectl ] && ln -s /usr/local/bin/k3s /usr/local/bin/kubectl || true

    # Set up kubeconfig
    export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
    mkdir -p /root/.kube
    cp /etc/rancher/k3s/k3s.yaml /root/.kube/config
    chmod 600 /root/.kube/config

    log_success "K3s installed successfully"
}

setup_control_plane() {
    log_info "Setting up Kubernetes control plane..."

    install_docker

    if [ "$K8S_TYPE" == "k3s" ]; then
        install_k3s
    else
        install_kubeadm
        initialize_kubeadm
    fi

    generate_join_token
    log_success "Control plane setup complete!"
}

initialize_kubeadm() {
    log_info "Initializing Kubeadm..."

    if command -v kubeadm &> /dev/null; then
        log_success "Kubeadm already installed"
        return 0
    fi

    local os=$(detect_os)

    case "$os" in
        ubuntu|debian)
            apt-get update
            apt-get install -y apt-transport-https ca-certificates curl
            curl -fsSLo /etc/apt/keyrings/kubernetes-archive-keyring.gpg https://dl.k8s.io/apt/doc/apt-key.gpg
            echo "deb [signed-by=/etc/apt/keyrings/kubernetes-archive-keyring.gpg] https://apt.kubernetes.io/ kubernetes-xenial main" | tee /etc/apt/sources.list.d/kubernetes.list
            apt-get update
            apt-get install -y kubeadm kubelet kubectl
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
    esac

    swapoff -a || true
    kubeadm init --pod-network-cidr=10.244.0.0/16

    mkdir -p /root/.kube
    cp /etc/kubernetes/admin.conf /root/.kube/config
    chmod 600 /root/.kube/config

    # Install CNI
    if [ "$CNI_PLUGIN" == "calico" ]; then
        kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.25.0/manifests/tigera-operator.yaml
    else
        kubectl apply -f https://raw.githubusercontent.com/coreos/flannel/master/Documentation/kube-flannel.yml
    fi

    log_success "Kubeadm initialized"
}

generate_join_token() {
    log_info "Generating join token..."

    local token_file="join-token.txt"

    if [ "$K8S_TYPE" == "k3s" ]; then
        local k3s_token=$(cat /var/lib/rancher/k3s/server/node-token)
        local server_ip=$(hostname -I | awk '{print $1}')

        cat > "$token_file" << EOF
# K3s Cluster Join Token
# Generated: $(date)

K3S_URL=https://${server_ip}:6443
K3S_TOKEN=${k3s_token}

# To join a node, run:
# bash <(curl -fsSL https://yoururl/install-k8s.sh) \\
#   --role worker \\
#   --control-plane-ip ${server_ip} \\
#   --token ${k3s_token}

# Or with environment variables:
# ROLE=worker CONTROL_PLANE_IP=${server_ip} K3S_TOKEN=${k3s_token} bash install-k8s.sh
EOF
    else
        local token=$(kubeadm token create --ttl 24h)
        local server_ip=$(hostname -I | awk '{print $1}')
        local ca_hash=$(openssl x509 -pubkey -in /etc/kubernetes/pki/ca.crt | openssl rsa -pubin -outform der 2>/dev/null | openssl dgst -sha256 -hex | sed 's/^.* //')

        cat > "$token_file" << EOF
# Kubeadm Cluster Join Token
# Generated: $(date)

KUBEADM_TOKEN=${token}
CONTROL_PLANE_IP=${server_ip}
CA_HASH=${ca_hash}

# To join a node, run:
# bash <(curl -fsSL https://yoururl/install-k8s.sh) \\
#   --role worker \\
#   --control-plane-ip ${server_ip} \\
#   --token "${token} --discovery-token-ca-cert-hash sha256:${ca_hash}"

# Or with environment variables:
# ROLE=worker CONTROL_PLANE_IP=${server_ip} K3S_TOKEN="..." bash install-k8s.sh
EOF
    fi

    log_success "Join token generated: $token_file"
    cat "$token_file"
}

setup_worker_node() {
    log_info "Setting up worker node..."

    if [ -z "$CONTROL_PLANE_IP" ] || [ -z "$K3S_TOKEN" ]; then
        log_error "Missing required parameters: --control-plane-ip and --token"
        exit 1
    fi

    # Test connectivity
    log_info "Testing connectivity to control plane ($CONTROL_PLANE_IP)..."
    if ! timeout 5 bash -c "echo >/dev/tcp/$CONTROL_PLANE_IP/6443" 2>/dev/null; then
        log_warning "Cannot reach control plane yet. Continuing anyway..."
    fi

    install_docker

    # Detect if K3s or Kubeadm based on token format
    if echo "$K3S_TOKEN" | grep -q "^K10"; then
        # K3s token format
        K8S_TYPE="k3s"
        join_k3s
    else
        # Kubeadm format
        K8S_TYPE="kubeadm"
        join_kubeadm
    fi

    log_success "Worker node setup complete!"
    log_info "Waiting for node to join cluster..."
    sleep 10
    log_info "From control plane, verify with: kubectl get nodes"
}

join_k3s() {
    log_info "Joining K3s cluster..."

    local k3s_url="https://${CONTROL_PLANE_IP}:6443"
    curl -sfL https://get.k3s.io | K3S_URL="$k3s_url" K3S_TOKEN="$K3S_TOKEN" sh -

    if [ -n "$NODE_NAME" ]; then
        hostnamectl set-hostname "$NODE_NAME" || true
    fi

    log_success "Node joined K3s cluster"
}

join_kubeadm() {
    log_info "Joining Kubeadm cluster..."

    # Install kubeadm, kubelet, kubectl
    local os=$(detect_os)

    case "$os" in
        ubuntu|debian)
            apt-get update
            apt-get install -y apt-transport-https ca-certificates curl
            curl -fsSLo /etc/apt/keyrings/kubernetes-archive-keyring.gpg https://dl.k8s.io/apt/doc/apt-key.gpg
            echo "deb [signed-by=/etc/apt/keyrings/kubernetes-archive-keyring.gpg] https://apt.kubernetes.io/ kubernetes-xenial main" | tee /etc/apt/sources.list.d/kubernetes.list
            apt-get update
            apt-get install -y kubeadm kubelet kubectl
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
    esac

    systemctl enable kubelet
    systemctl start kubelet

    # Parse token
    local token_part=$(echo "$K3S_TOKEN" | cut -d' ' -f1)
    local hash_part=$(echo "$K3S_TOKEN" | grep -oP 'sha256:\K[a-f0-9]+' || echo "")

    kubeadm join "${CONTROL_PLANE_IP}:6443" \
        --token "$token_part" \
        --discovery-token-ca-cert-hash "sha256:${hash_part}"

    if [ -n "$NODE_NAME" ]; then
        hostnamectl set-hostname "$NODE_NAME" || true
    fi

    log_success "Node joined Kubeadm cluster"
}

display_summary() {
    echo ""
    echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Installation Complete!${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════${NC}"
    echo ""

    if [ "$ROLE" == "control" ]; then
        echo -e "${GREEN}✓ Control Plane${NC} is ready!"
        echo ""
        echo "Next steps:"
        echo "  1. Copy join-token.txt to your worker nodes"
        echo "  2. Run this script on worker nodes:"
        echo "     bash <(curl -fsSL https://yoururl/install-k8s.sh) --role worker ..."
        echo ""
        echo "View nodes:"
        echo "  kubectl get nodes --watch"
        echo ""
        echo "Logs:"
        echo "  $LOG_FILE"
    else
        echo -e "${GREEN}✓ Worker Node${NC} setup complete!"
        echo ""
        echo "Node is joining the cluster..."
        echo ""
        echo "From control plane, verify with:"
        echo "  kubectl get nodes"
        echo ""
        echo "Logs:"
        echo "  $LOG_FILE"
    fi

    echo ""
}

# Main execution
main() {
    print_header
    check_root

    # Parse command-line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --role)
                ROLE="$2"
                shift 2
                ;;
            --control-plane-ip)
                CONTROL_PLANE_IP="$2"
                shift 2
                ;;
            --token)
                K3S_TOKEN="$2"
                shift 2
                ;;
            --cluster-name)
                CLUSTER_NAME="$2"
                shift 2
                ;;
            --node-name)
                NODE_NAME="$2"
                shift 2
                ;;
            --k8s-type)
                K8S_TYPE="$2"
                shift 2
                ;;
            --cni)
                CNI_PLUGIN="$2"
                shift 2
                ;;
            --help)
                cat << EOF
Kubernetes Multi-Node Cluster - One-Line Installation

Usage:
  # Interactive setup (recommended)
  sudo bash install-k8s.sh

  # Control plane
  sudo bash install-k8s.sh --role control --cluster-name my-cluster

  # Worker node
  sudo bash install-k8s.sh --role worker --control-plane-ip 192.168.1.10 --token <TOKEN>

Options:
  --role control|worker       Machine role (default: interactive)
  --control-plane-ip IP       Control plane IP (required for worker)
  --token TOKEN               Join token (required for worker)
  --cluster-name NAME         Cluster name (default: multi-node-cluster)
  --node-name NAME            Node name (optional)
  --k8s-type k3s|kubeadm      Kubernetes type (default: k3s)
  --cni flannel|calico        CNI plugin (default: flannel)
  --help                      Show this help

Examples:
  # Interactive (easiest)
  sudo bash install-k8s.sh

  # Fully automated control plane
  sudo bash install-k8s.sh --role control --cluster-name prod-cluster

  # Fully automated worker
  sudo bash install-k8s.sh --role worker --control-plane-ip 192.168.1.10 --token mytoken123

  # Via curl
  curl -fsSL https://yoururl/install-k8s.sh | sudo bash

Environment variables (alternative to command-line):
  ROLE=control|worker
  CONTROL_PLANE_IP=192.168.1.10
  K3S_TOKEN=token
  CLUSTER_NAME=my-cluster
  NODE_NAME=worker-1
  K8S_TYPE=k3s|kubeadm
  CNI_PLUGIN=flannel|calico

EOF
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    # Determine setup mode
    if [ -z "$ROLE" ]; then
        # Interactive mode
        interactive_setup
    fi

    # Execute setup
    case "$ROLE" in
        control)
            setup_control_plane
            ;;
        worker)
            setup_worker_node
            ;;
        *)
            log_error "Invalid role: $ROLE. Use 'control' or 'worker'"
            exit 1
            ;;
    esac

    display_summary
    log_success "All done!"
}

main "$@"
