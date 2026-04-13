#!/bin/bash

################################################################################
# Kubernetes Auto-Deploy All Applications
#
# Usage:
#   sudo bash auto-deploy.sh                   # Deploy from config file
#   sudo bash auto-deploy.sh --config myfile.txt
#   curl -fsSL url/auto-deploy.sh | sudo bash
#
# What it does:
#   - Reads auto-deploy-config.txt
#   - Deploys each app automatically
#   - Sets up load balancing
#   - Auto-scales and heals
#
# Configuration file format (auto-deploy-config.txt):
#   APP_NAME|IMAGE|REPLICAS|PORT
#   web-server|nginx|3|80
#   api|python:3.9|2|5000
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
CONFIG_FILE="${1:-auto-deploy-config.txt}"
DEPLOYED_COUNT=0
FAILED_COUNT=0

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_header() {
    echo -e "${MAGENTA}"
    cat << "EOF"
╔════════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║              Kubernetes Auto-Deploy All Applications                      ║
║                                                                            ║
║              Deploy everything automatically from config file             ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Please install kubectl first"
        exit 1
    fi

    if ! kubectl cluster-info &>/dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi

    # If config file doesn't exist, download it from git
    if [ ! -f "$CONFIG_FILE" ]; then
        log_info "Config file not found, downloading from git..."

        local config_url="https://raw.githubusercontent.com/Crashcart/Kali-AI-term/claude/docker-kubernetes-node-script-5YFM4/auto-deploy-config.txt"

        if curl -fsSL "$config_url" -o "$CONFIG_FILE" 2>/dev/null; then
            log_success "Config file downloaded: $CONFIG_FILE"
        else
            log_error "Could not download config file from: $config_url"
            log_error "Please create auto-deploy-config.txt manually"
            exit 1
        fi
    fi

    log_success "Prerequisites check passed"
}

parse_config() {
    log_info "Reading configuration from: $CONFIG_FILE"

    local line_count=0
    local comment_count=0

    while IFS= read -r line; do
        # Skip empty lines and comments
        [[ -z "$line" ]] && continue
        [[ "$line" =~ ^# ]] && { ((comment_count++)); continue; }

        ((line_count++))
    done < "$CONFIG_FILE"

    log_success "Configuration loaded ($line_count apps, $comment_count comments)"
}

deploy_app() {
    local app_name="$1"
    local image="$2"
    local replicas="$3"
    local port="$4"

    log_info "Deploying: $app_name (image: $image, replicas: $replicas, port: $port)"

    local yaml_file="/tmp/${app_name}-auto-deploy.yaml"

    # Create deployment YAML
    cat > "$yaml_file" << EOF
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $app_name
  labels:
    app: $app_name
    managed-by: auto-deploy
spec:
  replicas: $replicas
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: $app_name
  template:
    metadata:
      labels:
        app: $app_name
    spec:
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - $app_name
              topologyKey: kubernetes.io/hostname
      containers:
      - name: $app_name
        image: $image:latest
        imagePullPolicy: IfNotPresent
        ports:
        - name: http
          containerPort: $port
          protocol: TCP
        livenessProbe:
          httpGet:
            path: /
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
          failureThreshold: 3
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "500m"
            memory: "512Mi"
      restartPolicy: Always
      terminationGracePeriodSeconds: 30

---
apiVersion: v1
kind: Service
metadata:
  name: $app_name-service
  labels:
    app: $app_name
    managed-by: auto-deploy
spec:
  type: LoadBalancer
  selector:
    app: $app_name
  ports:
  - name: http
    protocol: TCP
    port: $port
    targetPort: http

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: $app_name-autoscaler
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: $app_name
  minReplicas: $replicas
  maxReplicas: $((replicas * 3))
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
EOF

    # Apply deployment
    if kubectl apply -f "$yaml_file" &>/dev/null; then
        log_success "Deployed: $app_name"
        ((DEPLOYED_COUNT++))
        return 0
    else
        log_error "Failed to deploy: $app_name"
        ((FAILED_COUNT++))
        return 1
    fi
}

deploy_all() {
    log_info "Starting auto-deployment of all applications..."
    echo ""

    while IFS='|' read -r app_name image replicas port; do
        # Skip empty lines and comments
        [[ -z "$app_name" ]] && continue
        [[ "$app_name" =~ ^# ]] && continue

        # Trim whitespace
        app_name=$(echo "$app_name" | xargs)
        image=$(echo "$image" | xargs)
        replicas=$(echo "$replicas" | xargs)
        port=$(echo "$port" | xargs)

        deploy_app "$app_name" "$image" "$replicas" "$port" || true

    done < "$CONFIG_FILE"

    echo ""
}

wait_for_deployment() {
    log_info "Waiting for deployments to be ready..."
    echo ""

    while IFS='|' read -r app_name image replicas port; do
        [[ -z "$app_name" ]] && continue
        [[ "$app_name" =~ ^# ]] && continue

        app_name=$(echo "$app_name" | xargs)

        log_info "Waiting for $app_name..."
        if kubectl rollout status deployment/"$app_name" --timeout=300s 2>/dev/null; then
            log_success "$app_name is ready!"
        else
            log_warning "$app_name deployment still rolling out or not ready yet"
        fi

    done < "$CONFIG_FILE"

    echo ""
}

display_summary() {
    echo -e "${MAGENTA}════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Auto-Deployment Complete!${NC}"
    echo -e "${MAGENTA}════════════════════════════════════════════════════════════════════════════${NC}"
    echo ""

    echo -e "${BLUE}Deployment Summary:${NC}"
    echo "  Successfully deployed: $DEPLOYED_COUNT"
    echo "  Failed: $FAILED_COUNT"
    echo ""

    echo -e "${BLUE}All Running Pods:${NC}"
    kubectl get pods -l managed-by=auto-deploy -o wide
    echo ""

    echo -e "${BLUE}All Services:${NC}"
    kubectl get services -l managed-by=auto-deploy
    echo ""

    echo -e "${BLUE}Useful Commands:${NC}"
    echo "  View all pods:           kubectl get pods -l managed-by=auto-deploy"
    echo "  View specific app:       kubectl get pods -l app=APP_NAME"
    echo "  View logs:               kubectl logs -l app=APP_NAME"
    echo "  Scale app:               kubectl scale deployment APP_NAME --replicas=5"
    echo "  Delete app:              kubectl delete deployment APP_NAME"
    echo "  Watch deployments:       kubectl get deployments -l managed-by=auto-deploy --watch"
    echo ""
}

show_help() {
    cat << "EOF"
Kubernetes Auto-Deploy All Applications

Usage:
  sudo bash auto-deploy.sh                    # Deploy from auto-deploy-config.txt
  sudo bash auto-deploy.sh --config myfile.txt
  curl -fsSL url/auto-deploy.sh | sudo bash

Configuration file format (auto-deploy-config.txt):
  APP_NAME|IMAGE|REPLICAS|PORT

  Example:
    web-server|nginx|3|80
    api-service|python:3.9|2|5000
    database|postgres|1|5432

Options:
  --config FILE           Configuration file (default: auto-deploy-config.txt)
  --help                  Show this help message

Features:
  ✓ Deploy multiple apps from single config file
  ✓ Auto load-balanced across nodes
  ✓ Auto-heals failures
  ✓ Auto-scales based on CPU
  ✓ Health checks included
  ✓ Clean management tags

What it deploys for each app:
  1. Deployment with specified replicas
  2. LoadBalancer Service for load balancing
  3. HorizontalPodAutoscaler for auto-scaling
  4. All tagged with managed-by=auto-deploy

EOF
}

# Main execution
main() {
    print_header

    # Parse arguments
    if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
        show_help
        exit 0
    fi

    if [[ "$1" == "--config" ]]; then
        CONFIG_FILE="$2"
    fi

    check_prerequisites
    parse_config
    deploy_all
    wait_for_deployment
    display_summary

    if [ $FAILED_COUNT -eq 0 ]; then
        log_success "All applications deployed successfully!"
    else
        log_warning "$FAILED_COUNT applications failed to deploy"
    fi
}

main "$@"
