#!/bin/bash

################################################################################
# Kubernetes Node Health Monitor
#
# Purpose: Continuously monitor cluster node health
# Detects node failures, logs events, generates status reports
#
# Usage: ./node-health-monitor.sh [OPTIONS]
#   --interval SECONDS      Check interval (default: 30)
#   --log-dir DIR          Output directory for logs (default: ./logs)
#   --kubeconfig PATH      Path to kubeconfig (default: ~/.kube/config)
#   --daemon               Run as background daemon
#   --help                 Show this help message
#
# Features:
#   - Monitors node status (Ready/NotReady)
#   - Detects kubelet failures
#   - Logs all events with timestamps
#   - Generates JSON status reports
#   - Auto-cordons failed nodes (optional)
#   - Generates human-readable status summaries
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
NC='\033[0m'

# Configuration
MONITOR_INTERVAL=30
LOG_DIR="./logs"
KUBECONFIG="${KUBECONFIG:${HOME}/.kube/config}"
RUN_AS_DAEMON=false
STATUS_REPORT="${LOG_DIR}/node-status-latest.json"
EVENT_LOG="${LOG_DIR}/cluster-events.log"
HEALTH_SUMMARY="${LOG_DIR}/health-summary.txt"

# State tracking
declare -A LAST_NODE_STATUS
declare -A LAST_KUBELET_STATUS

# Functions
log_info() {
    local msg="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${BLUE}[$timestamp INFO]${NC} $msg"
    echo "[$timestamp INFO] $msg" >> "$EVENT_LOG"
}

log_success() {
    local msg="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${GREEN}[$timestamp SUCCESS]${NC} $msg"
    echo "[$timestamp SUCCESS] $msg" >> "$EVENT_LOG"
}

log_warning() {
    local msg="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${YELLOW}[$timestamp WARNING]${NC} $msg"
    echo "[$timestamp WARNING] $msg" >> "$EVENT_LOG"
}

log_error() {
    local msg="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${RED}[$timestamp ERROR]${NC} $msg" >&2
    echo "[$timestamp ERROR] $msg" >> "$EVENT_LOG"
}

show_help() {
    grep "^#" "$0" | grep "^#" | sed 's/#\s*//' | head -30
}

initialize() {
    log_info "Initializing Kubernetes Node Health Monitor"

    # Check kubeconfig
    if [ ! -f "$KUBECONFIG" ]; then
        log_error "Kubeconfig not found: $KUBECONFIG"
        exit 1
    fi

    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl command not found"
        exit 1
    fi

    # Create log directory
    mkdir -p "$LOG_DIR"

    # Test cluster connectivity
    if kubectl cluster-info &>/dev/null; then
        log_success "Connected to Kubernetes cluster"
    else
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi

    # Initialize state tracking
    load_node_states
}

load_node_states() {
    log_info "Loading initial node states..."

    local nodes=$(kubectl get nodes --no-headers 2>/dev/null | awk '{print $1}')
    for node in $nodes; do
        local status=$(kubectl get node "$node" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
        LAST_NODE_STATUS["$node"]="$status"
    done
}

check_node_status() {
    log_info "Checking node status..."

    local nodes=$(kubectl get nodes --no-headers 2>/dev/null | awk '{print $1}')
    local status_json="["
    local first=true

    for node in $nodes; do
        # Get node details
        local node_status=$(kubectl get node "$node" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
        local node_ready=$(kubectl get node "$node" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
        local kubelet_status=$(kubectl get node "$node" -o jsonpath='{.status.conditions[?(@.type=="NotReady")].reason}' 2>/dev/null || echo "Ready")
        local pod_count=$(kubectl get pods --all-namespaces --field-selector spec.nodeName="$node" 2>/dev/null | grep -c "$node" || echo "0")

        # Get node info
        local os_image=$(kubectl get node "$node" -o jsonpath='{.status.nodeInfo.osImage}' 2>/dev/null || echo "Unknown")
        local kube_version=$(kubectl get node "$node" -o jsonpath='{.status.nodeInfo.kubeletVersion}' 2>/dev/null || echo "Unknown")
        local cpu=$(kubectl get node "$node" -o jsonpath='{.status.allocatable.cpu}' 2>/dev/null || echo "Unknown")
        local memory=$(kubectl get node "$node" -o jsonpath='{.status.allocatable.memory}' 2>/dev/null || echo "Unknown")

        # Check for status changes
        if [ "${LAST_NODE_STATUS[$node]:-}" != "$node_status" ]; then
            if [ "$node_status" == "True" ]; then
                log_success "Node $node is now READY"
            else
                log_error "Node $node is now NOT READY (Reason: $kubelet_status)"
                cordon_node "$node"
            fi
            LAST_NODE_STATUS["$node"]="$node_status"
        fi

        # Build JSON entry
        if [ "$first" = true ]; then
            first=false
        else
            status_json="$status_json,"
        fi

        status_json="$status_json{
    \"name\": \"$node\",
    \"status\": \"$node_status\",
    \"ready\": \"$node_ready\",
    \"kubelet_status\": \"$kubelet_status\",
    \"pod_count\": $pod_count,
    \"os_image\": \"$os_image\",
    \"kubelet_version\": \"$kube_version\",
    \"cpu_allocatable\": \"$cpu\",
    \"memory_allocatable\": \"$memory\",
    \"last_check\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
}"
    done

    status_json="$status_json]"

    # Write status report
    echo "$status_json" | jq . > "$STATUS_REPORT" 2>/dev/null || echo "$status_json" > "$STATUS_REPORT"

    log_success "Node status check completed"
}

cordon_node() {
    local node="$1"
    log_warning "Cordoning node $node to prevent new pod scheduling..."

    kubectl cordon "$node" 2>/dev/null || log_error "Failed to cordon node $node"
}

check_pod_status() {
    log_info "Checking pod status across cluster..."

    local failing_pods=$(kubectl get pods --all-namespaces --field-selector=status.phase!=Running,status.phase!=Succeeded 2>/dev/null | tail -n +2 | wc -l)

    if [ "$failing_pods" -gt 0 ]; then
        log_warning "$failing_pods pods are not in Running/Succeeded state"
        kubectl get pods --all-namespaces --field-selector=status.phase!=Running,status.phase!=Succeeded 2>/dev/null | tail -n +2 | while read line; do
            log_warning "  Problem Pod: $line"
        done
    else
        log_success "All pods in desired state"
    fi
}

generate_health_summary() {
    log_info "Generating health summary..."

    local total_nodes=$(kubectl get nodes --no-headers 2>/dev/null | wc -l)
    local ready_nodes=$(kubectl get nodes --no-headers 2>/dev/null | grep -c " Ready" || echo "0")
    local not_ready_nodes=$((total_nodes - ready_nodes))

    local total_pods=$(kubectl get pods --all-namespaces --no-headers 2>/dev/null | wc -l)
    local running_pods=$(kubectl get pods --all-namespaces --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
    local failed_pods=$(kubectl get pods --all-namespaces --field-selector=status.phase=Failed --no-headers 2>/dev/null | wc -l)

    cat > "$HEALTH_SUMMARY" << EOF
Kubernetes Cluster Health Summary
Generated: $(date)
================================

NODE STATUS
-----------
Total Nodes: $total_nodes
Ready Nodes: $ready_nodes
NotReady Nodes: $not_ready_nodes

POD STATUS
----------
Total Pods: $total_pods
Running Pods: $running_pods
Failed Pods: $failed_pods

DETAILED NODE STATUS
--------------------
EOF

    kubectl get nodes -o wide >> "$HEALTH_SUMMARY" 2>/dev/null || echo "Could not retrieve node details" >> "$HEALTH_SUMMARY"

    echo "" >> "$HEALTH_SUMMARY"
    echo "DETAILED POD STATUS" >> "$HEALTH_SUMMARY"
    echo "-------------------" >> "$HEALTH_SUMMARY"
    kubectl get pods --all-namespaces -o wide >> "$HEALTH_SUMMARY" 2>/dev/null || echo "Could not retrieve pod details" >> "$HEALTH_SUMMARY"

    log_success "Health summary generated: $HEALTH_SUMMARY"
}

display_status() {
    clear
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   Kubernetes Cluster Health Monitor                        ║${NC}"
    echo -e "${BLUE}║   Update: $(date '+%Y-%m-%d %H:%M:%S')                                 ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    echo -e "${YELLOW}NODE STATUS:${NC}"
    kubectl get nodes -o wide 2>/dev/null || echo "Could not retrieve node status"

    echo ""
    echo -e "${YELLOW}POD SUMMARY:${NC}"
    local total_pods=$(kubectl get pods --all-namespaces --no-headers 2>/dev/null | wc -l)
    local running_pods=$(kubectl get pods --all-namespaces --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
    local failed_pods=$(kubectl get pods --all-namespaces --field-selector=status.phase=Failed --no-headers 2>/dev/null | wc -l)

    echo "  Total Pods: $total_pods"
    echo "  Running: $running_pods"
    echo "  Failed: $failed_pods"

    echo ""
    echo -e "${YELLOW}RECENT EVENTS (last 10):${NC}"
    tail -10 "$EVENT_LOG" 2>/dev/null || echo "No events recorded yet"

    echo ""
    echo -e "${BLUE}Monitoring interval: ${MONITOR_INTERVAL}s | Log dir: $LOG_DIR${NC}"
    echo -e "${BLUE}Press Ctrl+C to stop${NC}"
}

run_monitor_loop() {
    initialize

    log_info "Starting health monitoring (interval: ${MONITOR_INTERVAL}s)"

    while true; do
        if [ "$RUN_AS_DAEMON" = true ]; then
            # Quiet mode for daemon
            check_node_status >/dev/null 2>&1
            check_pod_status >/dev/null 2>&1
            generate_health_summary >/dev/null 2>&1
        else
            # Display mode for interactive
            display_status
            check_node_status
            check_pod_status
            generate_health_summary
        fi

        sleep "$MONITOR_INTERVAL"
    done
}

# Main execution
main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --interval)
                MONITOR_INTERVAL="$2"
                shift 2
                ;;
            --log-dir)
                LOG_DIR="$2"
                shift 2
                ;;
            --kubeconfig)
                KUBECONFIG="$2"
                shift 2
                ;;
            --daemon)
                RUN_AS_DAEMON=true
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

    export KUBECONFIG

    run_monitor_loop
}

main "$@"
