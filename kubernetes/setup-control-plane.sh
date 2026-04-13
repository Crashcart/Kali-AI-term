#!/bin/bash

################################################################################
# Kubernetes Control Plane Setup Script
#
# Purpose: Initialize a Kubernetes control plane on a Linux machine
# Sets up Docker + K3s + CNI plugin + cluster token generation
#
# Usage: sudo ./setup-control-plane.sh [OPTIONS]
#   --k3s              Use k3s (default, lightweight)
#   --kubeadm          Use kubeadm (standard K8s)
#   --cni flannel      CNI plugin: flannel (default) or calico
#   --cluster-name     Name for cluster (default: multi-node-cluster)
#   --help             Show this help message
#
# Requirements:
#   - Linux machine (Ubuntu 20.04+, CentOS 8+)
#   - Root/sudo access
#   - ZeroTier One network access (optional, for remote nodes)
#
# Author: Generated for multi-node Kubernetes setup
# Date: 2026-04-13
################################################################################

set -euo pipefail

# Color output for readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration variables
K8S_TYPE="k3s"           # k3s or kubeadm
CNI_PLUGIN="flannel"     # flannel or calico
CLUSTER_NAME="multi-node-cluster"
KUBE_VERSION="latest"
LOG_DIR="./logs"
CONFIG_DIR="./config"
CLUSTER_CONFIG="${CONFIG_DIR}/cluster-config.env"
KUBEADM_CONFIG="${CONFIG_DIR}/kubeadm-config.yaml"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

show_help() {
    grep "^#" "$0" | grep "^#" | sed 's/#\s*//' | head -20
}

check_requirements() {
    log_info "Checking system requirements..."

    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        exit 1
    fi

    # Detect OS
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
    else
        log_error "Cannot detect Linux distribution"
        exit 1
    fi

    if [[ "$OS" != "ubuntu" && "$OS" != "centos" && "$OS" != "debian" ]]; then
        log_warning "This script is optimized for Ubuntu/CentOS/Debian. Your OS: $OS"
    fi

    # Check for required commands
    for cmd in curl wget systemctl; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "Required command not found: $cmd"
            exit 1
        fi
    done

    log_success "System requirements check passed"
}

install_docker() {
    log_info "Setting up Docker..."

    if command -v docker &> /dev/null; then
        local docker_version=$(docker --version | awk '{print $3}' | sed 's/,//')
        log_success "Docker already installed: $docker_version"
        return 0
    fi

    case "$OS" in
        ubuntu|debian)
            log_info "Installing Docker on Ubuntu/Debian..."
            apt-get update -qq
            apt-get install -y -qq docker.io docker-compose
            systemctl enable docker
            systemctl start docker
            ;;
        centos)
            log_info "Installing Docker on CentOS..."
            yum install -y docker
            systemctl enable docker
            systemctl start docker
            ;;
        *)
            log_error "Unsupported OS for Docker installation: $OS"
            exit 1
            ;;
    esac

    log_success "Docker installed successfully"
}

install_k3s() {
    log_info "Installing K3s (Kubernetes lightweight)..."

    if command -v k3s &> /dev/null; then
        local k3s_version=$(k3s --version)
        log_success "K3s already installed: $k3s_version"
        return 0
    fi

    # Download and install K3s
    curl -sfL https://get.k3s.io | sh -

    # Wait for K3s to be ready
    log_info "Waiting for K3s to be ready (this may take 1-2 minutes)..."
    sleep 5

    # Set up kubectl symlink for easier access
    mkdir -p /usr/local/bin
    if [ ! -L /usr/local/bin/kubectl ]; then
        ln -s /usr/local/bin/k3s /usr/local/bin/kubectl || true
    fi

    # Set up kubeconfig
    export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
    mkdir -p /root/.kube
    cp /etc/rancher/k3s/k3s.yaml /root/.kube/config
    chmod 600 /root/.kube/config

    log_success "K3s installed successfully"
}

install_kubeadm() {
    log_info "Installing Kubernetes with kubeadm..."

    if command -v kubeadm &> /dev/null; then
        local kubeadm_version=$(kubeadm version --output short)
        log_success "Kubeadm already installed: $kubeadm_version"
        return 0
    fi

    # Install kubeadm, kubelet, kubectl
    case "$OS" in
        ubuntu|debian)
            apt-get update
            apt-get install -y apt-transport-https ca-certificates curl
            curl -fsSLo /etc/apt/keyrings/kubernetes-archive-keyring.gpg https://dl.k8s.io/apt/doc/apt-key.gpg
            echo "deb [signed-by=/etc/apt/keyrings/kubernetes-archive-keyring.gpg] https://apt.kubernetes.io/ kubernetes-xenial main" | tee /etc/apt/sources.list.d/kubernetes.list
            apt-get update
            apt-get install -y kubeadm kubelet kubectl
            apt-mark hold kubeadm kubelet kubectl
            ;;
        centos)
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
            systemctl enable kubelet
            ;;
        *)
            log_error "Unsupported OS: $OS"
            exit 1
            ;;
    esac

    systemctl enable kubelet
    systemctl start kubelet

    log_success "Kubeadm, kubelet, kubectl installed successfully"
}

initialize_kubernetes() {
    log_info "Initializing Kubernetes control plane..."

    # Check if already initialized
    if kubectl cluster-info &> /dev/null; then
        log_success "Kubernetes cluster already initialized"
        return 0
    fi

    if [ "$K8S_TYPE" == "kubeadm" ]; then
        # Disable swap (required for kubeadm)
        swapoff -a || true

        # Generate kubeadm config if doesn't exist
        if [ ! -f "$KUBEADM_CONFIG" ]; then
            mkdir -p "$CONFIG_DIR"
            cat > "$KUBEADM_CONFIG" << 'KUBEADM_EOF'
apiVersion: kubeadm.k8s.io/v1beta3
kind: InitConfiguration
nodeRegistration:
  criSocket: unix:///var/run/containerd/containerd.sock
  taints: []
---
apiVersion: kubeadm.k8s.io/v1beta3
kind: ClusterConfiguration
kubernetesVersion: stable
controlPlaneEndpoint: "0.0.0.0:6443"
networking:
  podSubnet: "10.244.0.0/16"
  serviceSubnet: "10.96.0.0/12"
  dnsDomain: "cluster.local"
---
apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration
serverTLSBootstrap: true
KUBEADM_EOF
        fi

        log_info "Running kubeadm init (this may take several minutes)..."
        kubeadm init --config "$KUBEADM_CONFIG" || log_error "Kubeadm init failed"

        # Set up kubeconfig
        mkdir -p /root/.kube
        cp /etc/kubernetes/admin.conf /root/.kube/config
        chmod 600 /root/.kube/config
    fi

    log_success "Kubernetes control plane initialized"
}

install_cni_plugin() {
    log_info "Installing CNI plugin: $CNI_PLUGIN..."

    case "$CNI_PLUGIN" in
        flannel)
            kubectl apply -f https://raw.githubusercontent.com/coreos/flannel/master/Documentation/kube-flannel.yml
            log_success "Flannel CNI installed"
            ;;
        calico)
            kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.25.0/manifests/tigera-operator.yaml
            sleep 10
            kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.25.0/manifests/custom-resources.yaml
            log_success "Calico CNI installed"
            ;;
        *)
            log_error "Unknown CNI plugin: $CNI_PLUGIN"
            exit 1
            ;;
    esac

    log_info "Waiting for CNI to be ready..."
    sleep 10
}

generate_join_token() {
    log_info "Generating cluster join token for worker nodes..."

    local token_output="${LOG_DIR}/join-token.txt"
    mkdir -p "$LOG_DIR"

    if [ "$K8S_TYPE" == "k3s" ]; then
        # K3s uses a simpler token system
        local k3s_token=$(cat /var/lib/rancher/k3s/server/node-token)
        local server_ip=$(hostname -I | awk '{print $1}')

        cat > "$token_output" << EOF
# K3s Cluster Join Token
# Generated: $(date)
# For K3s: https://rancher.com/docs/k3s/latest/en/cluster-access/

K3S_URL=https://${server_ip}:6443
K3S_TOKEN=${k3s_token}

# To join a node, run:
# curl -sfL https://get.k3s.io | K3S_URL=https://${server_ip}:6443 K3S_TOKEN=${k3s_token} sh -
EOF
    else
        # Kubeadm uses kubeadm token command
        local token=$(kubeadm token create --ttl 24h)
        local server_ip=$(kubectl get node -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
        local ca_hash=$(openssl x509 -pubkey -in /etc/kubernetes/pki/ca.crt | openssl rsa -pubin -outform der 2>/dev/null | openssl dgst -sha256 -hex | sed 's/^.* //')

        cat > "$token_output" << EOF
# Kubeadm Cluster Join Token
# Generated: $(date)
# Token expires in 24 hours

KUBEADM_TOKEN=${token}
CONTROL_PLANE_IP=${server_ip}
CA_HASH=${ca_hash}

# To join a node, run:
# kubeadm join ${server_ip}:6443 --token ${token} --discovery-token-ca-cert-hash sha256:${ca_hash}
EOF
    fi

    log_success "Join token generated: $token_output"
    cat "$token_output"
}

save_cluster_config() {
    log_info "Saving cluster configuration..."

    mkdir -p "$CONFIG_DIR"

    local control_plane_ip=$(hostname -I | awk '{print $1}')

    cat > "$CLUSTER_CONFIG" << EOF
# Kubernetes Cluster Configuration
# Generated: $(date)
# Edit this file to customize your cluster setup

# Cluster info
CLUSTER_NAME="$CLUSTER_NAME"
K8S_TYPE="$K8S_TYPE"
CNI_PLUGIN="$CNI_PLUGIN"
CONTROL_PLANE_IP="${control_plane_ip}"
KUBE_VERSION="$KUBE_VERSION"

# Network configuration
POD_SUBNET="10.244.0.0/16"
SERVICE_SUBNET="10.96.0.0/12"
DNS_DOMAIN="cluster.local"

# ZeroTier configuration (if applicable)
ZEROTIER_NETWORK_ID=""  # Add your ZeroTier network ID here
ZEROTIER_MEMBER_ID=""   # Control plane node's ZeroTier ID

# Node capacity expectations
EXPECTED_LINUX_NODES=3
EXPECTED_WINDOWS_NODES=2

# Docker configuration
DOCKER_REGISTRY=""      # Private registry URL (optional)
INSECURE_REGISTRY=false # Allow insecure registry (not recommended for production)
EOF

    log_success "Cluster configuration saved to: $CLUSTER_CONFIG"
}

display_status() {
    log_info "Waiting for cluster to be fully ready..."
    sleep 10

    echo ""
    echo -e "${BLUE}========== CLUSTER STATUS ==========${NC}"

    kubectl get nodes -o wide || true

    echo ""
    echo -e "${BLUE}========== NEXT STEPS ==========${NC}"
    echo "1. Review the join token in: ${LOG_DIR}/join-token.txt"
    echo "2. On each worker node, run the provided join command"
    echo "3. Monitor node joining with: kubectl get nodes --watch"
    echo "4. Check pod deployment with: kubectl get pods --all-namespaces"
    echo ""
    echo -e "${GREEN}Control plane is ready for worker nodes!${NC}"
}

# Main execution
main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --k3s)
                K8S_TYPE="k3s"
                shift
                ;;
            --kubeadm)
                K8S_TYPE="kubeadm"
                shift
                ;;
            --cni)
                CNI_PLUGIN="$2"
                shift 2
                ;;
            --cluster-name)
                CLUSTER_NAME="$2"
                shift 2
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

    log_info "Starting Kubernetes control plane setup"
    log_info "Configuration: K8S_TYPE=$K8S_TYPE, CNI=$CNI_PLUGIN, CLUSTER=$CLUSTER_NAME"

    check_requirements
    install_docker

    if [ "$K8S_TYPE" == "k3s" ]; then
        install_k3s
    else
        install_kubeadm
        initialize_kubernetes
        install_cni_plugin
    fi

    generate_join_token
    save_cluster_config
    display_status

    log_success "Control plane setup complete!"
}

main "$@"
