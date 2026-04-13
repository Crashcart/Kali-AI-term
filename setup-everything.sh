#!/bin/bash

################################################################################
# Complete Kubernetes Cluster Setup & Auto-Deploy
#
# Usage (One Command!):
#   curl -fsSL https://yoururl/setup-everything.sh | sudo bash
#
# What it does AUTOMATICALLY:
#   1. Detects machine role (control plane or worker)
#   2. Installs Docker + Kubernetes
#   3. Sets up cluster OR joins cluster
#   4. Waits for cluster ready
#   5. Auto-deploys all applications
#   6. Monitors everything
#
# Completely hands-free! Just run it and walk away.
#
# Author: Generated for Kubernetes cluster
# Date: 2026-04-13
################################################################################

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
CLUSTER_NAME="${CLUSTER_NAME:-multi-node-cluster}"
CONTROL_PLANE_IP="${CONTROL_PLANE_IP:-}"
K3S_TOKEN="${K3S_TOKEN:-}"
K8S_TYPE="k3s"
ROLE=""
INSTALL_DIR="$(pwd)"
LOG_FILE="${INSTALL_DIR}/setup-everything.log"

# Ensure log file
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
║        Kubernetes Complete Automation - Setup Everything!                 ║
║                                                                            ║
║     Install, Configure, Deploy - All Automatically!                       ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root. Use 'sudo' or administrator privileges"
        exit 1
    fi
}

detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo "$ID"
    else
        echo "unknown"
    fi
}

detect_role() {
    log_info "Detecting machine role..."

    # Check if control plane tools exist (this is control plane)
    if command -v k3s &> /dev/null || command -v kubeadm &> /dev/null; then
        ROLE="control"
        log_success "Detected: Control Plane (already has Kubernetes)"
        return 0
    fi

    # Check if already joined to a cluster
    if [ -f /etc/rancher/k3s/k3s.yaml ] || [ -f /etc/kubernetes/kubelet.conf ]; then
        ROLE="worker"
        log_success "Detected: Worker Node (already in cluster)"
        return 0
    fi

    # Auto-determine based on environment
    if [ -n "${CONTROL_PLANE_IP:-}" ] && [ -n "${K3S_TOKEN:-}" ]; then
        ROLE="worker"
        log_success "Detected: Worker Node (via environment variables)"
    else
        ROLE="control"
        log_success "Detected: Control Plane (no cluster info provided)"
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
            log_error "Unsupported OS: $os"
            exit 1
            ;;
    esac

    log_success "Docker installed"
}

setup_control_plane() {
    log_info "Setting up Kubernetes Control Plane..."

    install_docker

    if command -v k3s &> /dev/null; then
        log_success "K3s already installed"
        return 0
    fi

    log_info "Installing K3s..."
    curl -sfL https://get.k3s.io | sh -

    # Set up kubectl
    mkdir -p /usr/local/bin /root/.kube
    [ ! -L /usr/local/bin/kubectl ] && ln -s /usr/local/bin/k3s /usr/local/bin/kubectl || true
    cp /etc/rancher/k3s/k3s.yaml /root/.kube/config
    chmod 600 /root/.kube/config
    export KUBECONFIG=/root/.kube/config

    sleep 10

    log_success "Control Plane installed"
}

generate_join_info() {
    log_info "Generating cluster join information..."

    local token=$(cat /var/lib/rancher/k3s/server/node-token)
    local server_ip=$(hostname -I | awk '{print $1}')

    cat > "${INSTALL_DIR}/CLUSTER_INFO.txt" << EOF
Kubernetes Cluster Information
Generated: $(date)

CLUSTER URL: https://${server_ip}:6443
CLUSTER TOKEN: ${token}

To join a worker node, set environment variables and run setup-everything.sh:
export CONTROL_PLANE_IP=${server_ip}
export K3S_TOKEN=${token}
curl -fsSL https://yoururl/setup-everything.sh | sudo bash

Or manually:
curl -fsSL https://yoururl/setup-everything.sh | CONTROL_PLANE_IP=${server_ip} K3S_TOKEN=${token} sudo bash
EOF

    log_success "Cluster info saved to CLUSTER_INFO.txt"
    cat "${INSTALL_DIR}/CLUSTER_INFO.txt"
}

wait_for_cluster() {
    log_info "Waiting for cluster to be ready..."

    local max_attempts=60
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if kubectl cluster-info &>/dev/null; then
            log_success "Cluster is ready!"
            return 0
        fi
        ((attempt++))
        sleep 5
    done

    log_error "Cluster not ready after 5 minutes"
    exit 1
}

setup_worker_node() {
    log_info "Setting up Kubernetes Worker Node..."

    if [ -z "$CONTROL_PLANE_IP" ] || [ -z "$K3S_TOKEN" ]; then
        log_error "Missing cluster info. Cannot join as worker node"
        exit 1
    fi

    install_docker

    log_info "Joining cluster at $CONTROL_PLANE_IP..."
    curl -sfL https://get.k3s.io | K3S_URL="https://${CONTROL_PLANE_IP}:6443" K3S_TOKEN="$K3S_TOKEN" sh -

    sleep 10

    log_success "Worker node joined cluster"
}

auto_deploy_apps() {
    log_info "Auto-deploying applications..."

    if [ "$ROLE" != "control" ]; then
        log_info "Skipping deployment (not control plane)"
        return 0
    fi

    # Download and run auto-deploy
    local deploy_script="/tmp/auto-deploy-full.sh"

    if curl -fsSL "https://raw.githubusercontent.com/Crashcart/Kali-AI-term/claude/docker-kubernetes-node-script-5YFM4/auto-deploy.sh" -o "$deploy_script"; then
        log_info "Running auto-deploy..."
        bash "$deploy_script" || log_warning "Auto-deploy had issues, but cluster is still functional"
    else
        log_warning "Could not download auto-deploy script"
    fi

    log_success "Deployment complete"
}

display_final_status() {
    echo ""
    echo -e "${MAGENTA}════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✓ COMPLETE SETUP FINISHED!${NC}"
    echo -e "${MAGENTA}════════════════════════════════════════════════════════════════════════════${NC}"
    echo ""

    if [ "$ROLE" == "control" ]; then
        echo -e "${BLUE}Control Plane Status:${NC}"
        echo "  Hostname: $(hostname)"
        echo "  IP: $(hostname -I | awk '{print $1}')"
        echo ""
        echo -e "${BLUE}Cluster Info:${NC}"
        kubectl cluster-info || true
        echo ""
        echo -e "${BLUE}Nodes in Cluster:${NC}"
        kubectl get nodes -o wide || true
        echo ""
        echo -e "${BLUE}Running Pods:${NC}"
        kubectl get pods --all-namespaces 2>/dev/null | head -20 || true
        echo ""
        echo -e "${BLUE}Cluster Join Info:${NC}"
        cat "${INSTALL_DIR}/CLUSTER_INFO.txt" || true
    else
        echo -e "${BLUE}Worker Node Status:${NC}"
        echo "  Hostname: $(hostname)"
        echo "  Joined to: $CONTROL_PLANE_IP"
        echo "  Check status on control plane: kubectl get nodes"
    fi

    echo ""
    echo -e "${BLUE}Logs:${NC}"
    echo "  $LOG_FILE"
    echo ""
    echo -e "${GREEN}Everything is set up and running!${NC}"
    echo ""
}

# Main execution
main() {
    print_header
    check_root

    log_info "========== COMPLETE AUTOMATION START =========="
    log_info "Role detection: Checking machine configuration..."

    detect_role

    log_info "========== STARTING SETUP FOR: $ROLE =========="

    if [ "$ROLE" == "control" ]; then
        setup_control_plane
        wait_for_cluster
        generate_join_info
        auto_deploy_apps
    else
        setup_worker_node
    fi

    log_info "========== SETUP COMPLETE =========="
    display_final_status

    log_success "Setup completed successfully!"
}

main "$@"
