#!/bin/bash

################################################################################
# Quick Deploy Interactive Setup Wizard
#
# Purpose: Interactive menu-driven deployment wizard for Kubernetes cluster
# Guides users through cluster setup step-by-step
#
# Usage: ./quick-deploy.sh
#
# This script provides:
#   - Interactive menu system
#   - Step-by-step guidance
#   - Input validation
#   - Automatic script execution
#   - Troubleshooting assistance
#
# Author: Generated for multi-node Kubernetes setup
# Date: 2026-04-13
################################################################################

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${CURRENT_DIR}/logs"
CONFIG_DIR="${CURRENT_DIR}/config"
CLUSTER_CONFIG="${CONFIG_DIR}/cluster-config.env"

# Functions
clear_screen() {
    clear
}

print_header() {
    echo -e "${CYAN}"
    cat << "EOF"
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║           Kubernetes Multi-Node Cluster - Quick Deploy Wizard                ║
║                                                                              ║
║              Setting up Docker + Kubernetes across your network             ║
║                      with automatic node management                         ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

print_section() {
    echo -e "${MAGENTA}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "$1"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

prompt_yes_no() {
    local question="$1"
    local response

    while true; do
        read -p "$(echo -e ${CYAN}$question${NC}) (yes/no): " -r response
        case "$response" in
            yes|y|YES|Y)
                return 0
                ;;
            no|n|NO|N)
                return 1
                ;;
            *)
                print_error "Please answer yes or no"
                ;;
        esac
    done
}

prompt_input() {
    local prompt="$1"
    local default="${2:-}"
    local response

    if [ -n "$default" ]; then
        read -p "$(echo -e ${CYAN}$prompt${NC} [${YELLOW}$default${CYAN}]: ${NC})" -r response
        response="${response:-$default}"
    else
        read -p "$(echo -e ${CYAN}$prompt${NC}: ${NC})" -r response
        while [ -z "$response" ]; do
            print_error "This field is required"
            read -p "$(echo -e ${CYAN}$prompt${NC}: ${NC})" -r response
        done
    fi

    echo "$response"
}

prompt_select() {
    local prompt="$1"
    shift
    local -a options=("$@")
    local selected=0

    while true; do
        clear_screen
        print_header
        print_section "$prompt"

        for i in "${!options[@]}"; do
            if [ $i -eq $selected ]; then
                echo -e "${GREEN}➤ $(($i + 1)). ${options[$i]}${NC}"
            else
                echo -e "  $(($i + 1)). ${options[$i]}"
            fi
        done

        echo ""
        read -p "$(echo -e ${CYAN}Select (use numbers, or q to cancel)${NC}: )" -r choice

        case "$choice" in
            q|Q)
                return 1
                ;;
            [0-9]*)
                if [ "$choice" -ge 1 ] && [ "$choice" -le "${#options[@]}" ]; then
                    selected=$((choice - 1))
                    echo "${options[$selected]}"
                    return 0
                fi
                ;;
        esac
    done
}

check_prerequisites() {
    clear_screen
    print_header
    print_section "Step 1: Checking Prerequisites"

    local missing_tools=()

    # Check for required tools
    for tool in docker kubectl curl; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
            print_error "$tool is not installed"
        else
            local version=$($tool --version 2>/dev/null | head -n 1 || echo "unknown version")
            print_success "$tool is installed ($version)"
        fi
    done

    # Check Docker daemon
    if command -v docker &> /dev/null; then
        if docker ps &>/dev/null; then
            print_success "Docker daemon is running"
        else
            print_error "Docker daemon is not running"
            missing_tools+=("docker-daemon")
        fi
    fi

    echo ""

    if [ ${#missing_tools[@]} -gt 0 ]; then
        print_warning "Some prerequisites are missing: ${missing_tools[*]}"
        if ! prompt_yes_no "Continue anyway?"; then
            return 1
        fi
    else
        print_success "All prerequisites are met"
    fi

    echo ""
    pause_screen
    return 0
}

pause_screen() {
    read -p "$(echo -e ${YELLOW}Press Enter to continue...${NC})" -r
}

menu_control_plane_setup() {
    clear_screen
    print_header
    print_section "Step 2: Control Plane Setup"

    echo -e "${BLUE}Options:${NC}"
    echo "1. Set up as Control Plane (K8s master)"
    echo "2. Skip (I'll set up manually)"
    echo "3. Go back to main menu"
    echo ""

    read -p "$(echo -e ${CYAN}Select option${NC}: )" -r choice

    case "$choice" in
        1)
            setup_control_plane_interactive
            ;;
        2)
            print_info "Skipping control plane setup"
            ;;
        3)
            return 1
            ;;
        *)
            print_error "Invalid option"
            ;;
    esac

    return 0
}

setup_control_plane_interactive() {
    clear_screen
    print_header
    print_section "Control Plane Configuration"

    print_info "This machine will be set up as the Kubernetes control plane"
    echo ""

    # Get configuration options
    local k8s_type=$(prompt_select "Select Kubernetes type" "k3s (lightweight)" "kubeadm (standard)")
    local cni_plugin=$(prompt_select "Select CNI plugin" "flannel" "calico")
    local cluster_name=$(prompt_input "Cluster name" "multi-node-cluster")

    clear_screen
    print_header
    print_section "Setting up Control Plane"

    print_info "Configuration:"
    print_info "  K8s Type: $k8s_type"
    print_info "  CNI Plugin: $cni_plugin"
    print_info "  Cluster Name: $cluster_name"
    echo ""

    # Check if script is executable
    if [ ! -x "${CURRENT_DIR}/setup-control-plane.sh" ]; then
        print_warning "Making script executable..."
        chmod +x "${CURRENT_DIR}/setup-control-plane.sh"
    fi

    print_info "Running setup-control-plane.sh..."
    echo ""

    # Build command
    local cmd="sudo ${CURRENT_DIR}/setup-control-plane.sh"
    [ "$k8s_type" = "kubeadm" ] && cmd="$cmd --kubeadm"
    [ "$k8s_type" = "k3s" ] && cmd="$cmd --k3s"
    [ "$cni_plugin" = "calico" ] && cmd="$cmd --cni calico"
    [ -n "$cluster_name" ] && cmd="$cmd --cluster-name '$cluster_name'"

    if eval "$cmd"; then
        print_success "Control plane setup completed!"
        echo ""
        print_info "Next steps:"
        print_info "  1. Review the join token in: ${LOG_DIR}/join-token.txt"
        print_info "  2. Run setup-node.sh on each worker node"
        print_info "  3. Use quick-deploy.sh on nodes to automate the process"
    else
        print_error "Control plane setup failed!"
        print_info "Check logs for more details"
    fi

    echo ""
    pause_screen
}

menu_worker_node_setup() {
    clear_screen
    print_header
    print_section "Step 3: Worker Node Setup"

    echo -e "${BLUE}Options:${NC}"
    echo "1. Set up as Worker Node (joins existing cluster)"
    echo "2. Skip (I'll set up manually)"
    echo "3. Go back to main menu"
    echo ""

    read -p "$(echo -e ${CYAN}Select option${NC}: )" -r choice

    case "$choice" in
        1)
            setup_worker_node_interactive
            ;;
        2)
            print_info "Skipping worker node setup"
            ;;
        3)
            return 1
            ;;
        *)
            print_error "Invalid option"
            ;;
    esac

    return 0
}

setup_worker_node_interactive() {
    clear_screen
    print_header
    print_section "Worker Node Configuration"

    print_warning "This machine will be set up as a Kubernetes worker node"
    echo ""

    # Get control plane IP
    local control_plane_ip=$(prompt_input "Control Plane IP address" "192.168.1.10")

    # Get join token
    print_info "You need the join token from your control plane"
    print_info "Location: ${LOG_DIR}/join-token.txt"
    echo ""
    local join_token=$(prompt_input "Paste the join token (from join-token.txt)")

    # Optional: get node name
    local node_name=$(prompt_input "Node name (optional)" "$(hostname)")

    clear_screen
    print_header
    print_section "Setting up Worker Node"

    print_info "Configuration:"
    print_info "  Control Plane: $control_plane_ip"
    print_info "  Node Name: $node_name"
    echo ""

    # Check if script is executable
    if [ ! -x "${CURRENT_DIR}/setup-node.sh" ]; then
        print_warning "Making script executable..."
        chmod +x "${CURRENT_DIR}/setup-node.sh"
    fi

    print_info "Running setup-node.sh..."
    echo ""

    if sudo "${CURRENT_DIR}/setup-node.sh" \
        --control-plane-ip "$control_plane_ip" \
        --token "$join_token" \
        --node-name "$node_name"; then
        print_success "Worker node setup completed!"
        echo ""
        print_info "This node is now joining the cluster."
        print_info "Check status with: kubectl get nodes"
    else
        print_error "Worker node setup failed!"
        print_info "Check logs for more details"
    fi

    echo ""
    pause_screen
}

menu_monitoring() {
    clear_screen
    print_header
    print_section "Step 4: Cluster Monitoring"

    echo -e "${BLUE}Options:${NC}"
    echo "1. Start cluster health monitor (run on control plane)"
    echo "2. View health summary"
    echo "3. View node status"
    echo "4. Go back to main menu"
    echo ""

    read -p "$(echo -e ${CYAN}Select option${NC}: )" -r choice

    case "$choice" in
        1)
            start_health_monitor
            ;;
        2)
            view_health_summary
            ;;
        3)
            view_node_status
            ;;
        4)
            return 1
            ;;
        *)
            print_error "Invalid option"
            ;;
    esac

    return 0
}

start_health_monitor() {
    clear_screen
    print_header
    print_section "Starting Health Monitor"

    print_info "The health monitor will continuously check cluster status"
    echo ""

    if [ ! -x "${CURRENT_DIR}/node-health-monitor.sh" ]; then
        print_warning "Making script executable..."
        chmod +x "${CURRENT_DIR}/node-health-monitor.sh"
    fi

    print_info "Starting monitor (press Ctrl+C to stop)..."
    echo ""

    if "${CURRENT_DIR}/node-health-monitor.sh" --interval 30 --log-dir "$LOG_DIR"; then
        print_success "Monitor completed"
    else
        print_error "Monitor exited with an error"
    fi

    pause_screen
}

view_health_summary() {
    clear_screen
    print_header
    print_section "Cluster Health Summary"

    local summary_file="${LOG_DIR}/health-summary.txt"

    if [ -f "$summary_file" ]; then
        cat "$summary_file"
    else
        print_warning "Health summary not available yet"
        print_info "Run the health monitor first to generate a summary"
    fi

    echo ""
    pause_screen
}

view_node_status() {
    clear_screen
    print_header
    print_section "Node Status"

    if command -v kubectl &>/dev/null; then
        kubectl get nodes -o wide || print_error "Could not retrieve node status"
    else
        print_error "kubectl is not available"
    fi

    echo ""
    pause_screen
}

menu_troubleshooting() {
    clear_screen
    print_header
    print_section "Troubleshooting"

    echo -e "${BLUE}Common Issues:${NC}"
    echo ""
    echo "1. Node not joining cluster"
    echo "   - Check control plane IP is correct"
    echo "   - Verify network connectivity: ping <control-plane-ip>"
    echo "   - Check join token is valid"
    echo "   - Review logs: cat ${LOG_DIR}/cluster-events.log"
    echo ""
    echo "2. Pods not scheduling"
    echo "   - Check node status: kubectl get nodes"
    echo "   - Check node resources: kubectl top nodes"
    echo "   - Review pod events: kubectl describe pod <pod-name>"
    echo ""
    echo "3. Docker not working"
    echo "   - Check docker is running: systemctl status docker"
    echo "   - Check socket permissions: ls -la /var/run/docker.sock"
    echo ""
    echo "4. Kubernetes services failing"
    echo "   - Check kubelet status: systemctl status kubelet"
    echo "   - Review kubelet logs: journalctl -u kubelet -f"
    echo ""

    print_info "For more help, consult:"
    echo "  - README.md for comprehensive setup guide"
    echo "  - QUICKSTART.md for quick reference"
    echo "  - ${LOG_DIR}/cluster-events.log for detailed logs"
    echo ""

    pause_screen
}

main_menu() {
    while true; do
        clear_screen
        print_header

        echo -e "${BLUE}Main Menu${NC}"
        echo "1. ✓ Check Prerequisites"
        echo "2. ⚙ Setup Control Plane"
        echo "3. ⚙ Setup Worker Node"
        echo "4. 📊 Monitoring"
        echo "5. ❓ Troubleshooting"
        echo "6. 📋 View Configuration"
        echo "7. 🚪 Exit"
        echo ""

        read -p "$(echo -e ${CYAN}Select option${NC}: )" -r choice

        case "$choice" in
            1)
                check_prerequisites || true
                ;;
            2)
                menu_control_plane_setup || true
                ;;
            3)
                menu_worker_node_setup || true
                ;;
            4)
                menu_monitoring || true
                ;;
            5)
                menu_troubleshooting
                ;;
            6)
                clear_screen
                print_header
                print_section "Configuration"
                if [ -f "$CLUSTER_CONFIG" ]; then
                    cat "$CLUSTER_CONFIG"
                else
                    print_warning "Configuration file not found: $CLUSTER_CONFIG"
                fi
                echo ""
                pause_screen
                ;;
            7)
                clear_screen
                print_success "Exiting Quick Deploy Wizard"
                exit 0
                ;;
            *)
                print_error "Invalid option"
                sleep 1
                ;;
        esac
    done
}

# Main execution
print_header
print_section "Welcome to Kubernetes Quick Deploy"

print_info "This wizard will guide you through setting up a multi-node Kubernetes cluster"
print_info "with Docker and automatic node management via ZeroTier One"
echo ""
print_info "Requirements:"
echo "  - Linux control plane machine"
echo "  - Docker installed"
echo "  - Network connectivity to all nodes"
echo ""

main_menu
