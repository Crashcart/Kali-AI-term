#!/bin/bash

################################################################################
# Kubernetes Auto-Deploy Load-Balanced Application
#
# Usage:
#   sudo bash deploy-app.sh                    # Interactive
#   sudo bash deploy-app.sh --app nginx --replicas 3 --port 80
#   curl -fsSL url/deploy-app.sh | sudo bash
#
# What it does:
#   - Deploys load-balanced application to your cluster
#   - Auto-distributes across nodes
#   - Auto-heals failures
#   - Provides monitoring and scaling
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
APP_NAME=""
APP_IMAGE=""
REPLICAS=3
PORT=80
NAMESPACE="default"

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
║          Kubernetes Auto-Deploy Load-Balanced Application                 ║
║                                                                            ║
║              Deploy to your multi-node cluster automatically              ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Please install kubectl first"
        exit 1
    fi

    if ! kubectl cluster-info &>/dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi

    log_success "kubectl connected to cluster"
}

interactive_setup() {
    log_info "Starting interactive deployment setup..."
    echo ""

    # App name
    read -p "$(echo -e ${BLUE}Application name${NC}): " -r APP_NAME
    if [ -z "$APP_NAME" ]; then
        log_error "App name required"
        exit 1
    fi

    # App image
    echo -e "${BLUE}Common images:${NC}"
    echo "  - nginx (web server)"
    echo "  - alpine (minimal Linux)"
    echo "  - python:3.9 (Python)"
    echo "  - node:18 (Node.js)"
    echo ""
    read -p "Docker image (e.g., nginx): " -r APP_IMAGE
    if [ -z "$APP_IMAGE" ]; then
        log_error "Image name required"
        exit 1
    fi

    # Port
    read -p "Service port [80]: " -r port_input
    PORT="${port_input:-80}"

    # Replicas
    read -p "Number of replicas [3]: " -r replicas_input
    REPLICAS="${replicas_input:-3}"

    # Namespace
    read -p "Kubernetes namespace [default]: " -r ns_input
    NAMESPACE="${ns_input:-default}"
}

create_deployment_yaml() {
    log_info "Creating deployment manifest..."

    local yaml_file="/tmp/${APP_NAME}-deployment.yaml"

    cat > "$yaml_file" << EOF
---
# Deployment: Auto load-balanced application
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $APP_NAME
  namespace: $NAMESPACE
  labels:
    app: $APP_NAME
spec:
  replicas: $REPLICAS
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: $APP_NAME
  template:
    metadata:
      labels:
        app: $APP_NAME
    spec:
      affinity:
        # Spread pods across different nodes
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - $APP_NAME
              topologyKey: kubernetes.io/hostname
      containers:
      - name: $APP_NAME
        image: $APP_IMAGE:latest
        imagePullPolicy: IfNotPresent
        ports:
        - name: http
          containerPort: $PORT
          protocol: TCP
        # Health checks
        livenessProbe:
          httpGet:
            path: /
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        # Resource requests
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "500m"
            memory: "512Mi"
        # Auto-restart policy
        securityContext:
          allowPrivilegeEscalation: false
      restartPolicy: Always
      terminationGracePeriodSeconds: 30

---
# Service: Load balancer for the deployment
apiVersion: v1
kind: Service
metadata:
  name: $APP_NAME-service
  namespace: $NAMESPACE
  labels:
    app: $APP_NAME
spec:
  type: LoadBalancer
  selector:
    app: $APP_NAME
  ports:
  - name: http
    protocol: TCP
    port: $PORT
    targetPort: http
  sessionAffinity: None

---
# HorizontalPodAutoscaler: Auto-scale based on CPU
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: $APP_NAME-autoscaler
  namespace: $NAMESPACE
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: $APP_NAME
  minReplicas: $REPLICAS
  maxReplicas: $((REPLICAS * 3))
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
EOF

    log_success "Deployment manifest created: $yaml_file"
    echo "$yaml_file"
}

deploy_application() {
    log_info "Deploying application to Kubernetes cluster..."

    local yaml_file=$(create_deployment_yaml)

    # Create namespace if doesn't exist
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f - 2>/dev/null || true

    # Apply deployment
    if kubectl apply -f "$yaml_file"; then
        log_success "Application deployed successfully"
    else
        log_error "Failed to deploy application"
        exit 1
    fi
}

monitor_rollout() {
    log_info "Waiting for pods to start (this may take a minute)..."
    echo ""

    kubectl rollout status deployment/"$APP_NAME" -n "$NAMESPACE" --timeout=300s

    log_success "All pods are running!"
}

display_status() {
    echo ""
    echo -e "${MAGENTA}════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✓ Application Deployed Successfully!${NC}"
    echo -e "${MAGENTA}════════════════════════════════════════════════════════════════════════════${NC}"
    echo ""

    echo -e "${BLUE}Application Info:${NC}"
    echo "  Name: $APP_NAME"
    echo "  Image: $APP_IMAGE"
    echo "  Replicas: $REPLICAS"
    echo "  Port: $PORT"
    echo "  Namespace: $NAMESPACE"
    echo ""

    echo -e "${BLUE}Pods (auto-distributed across your nodes):${NC}"
    kubectl get pods -n "$NAMESPACE" -l "app=$APP_NAME" -o wide
    echo ""

    echo -e "${BLUE}Service (load balancer):${NC}"
    kubectl get service "$APP_NAME-service" -n "$NAMESPACE"
    echo ""

    echo -e "${BLUE}Useful Commands:${NC}"
    echo "  View pods:              kubectl get pods -n $NAMESPACE -l app=$APP_NAME"
    echo "  View logs:              kubectl logs -n $NAMESPACE -l app=$APP_NAME"
    echo "  Scale up:               kubectl scale deployment $APP_NAME -n $NAMESPACE --replicas=5"
    echo "  Watch status:           kubectl get pods -n $NAMESPACE -l app=$APP_NAME --watch"
    echo "  Delete app:             kubectl delete deployment $APP_NAME -n $NAMESPACE"
    echo ""

    echo -e "${YELLOW}Load Balancing:${NC}"
    echo "  - Pods automatically distributed across moose + boris nodes"
    echo "  - Service load balances traffic across all pods"
    echo "  - If a pod fails, Kubernetes automatically restarts it"
    echo "  - HPA auto-scales based on CPU usage (70% threshold)"
    echo ""
}

show_help() {
    cat << "EOF"
Kubernetes Auto-Deploy Load-Balanced Application

Usage:
  sudo bash deploy-app.sh                    # Interactive setup
  sudo bash deploy-app.sh --app nginx --replicas 3 --port 80
  curl -fsSL url/deploy-app.sh | sudo bash

Options:
  --app NAME              Application name (e.g., web-app)
  --image IMAGE           Docker image (e.g., nginx:latest)
  --replicas COUNT        Number of replicas (default: 3)
  --port PORT             Service port (default: 80)
  --namespace NS          Kubernetes namespace (default: default)
  --help                  Show this help message

Examples:
  # Interactive (easiest)
  sudo bash deploy-app.sh

  # Deploy nginx with 3 replicas
  sudo bash deploy-app.sh --app web-nginx --image nginx --replicas 3 --port 80

  # Deploy Python app with 5 replicas
  sudo bash deploy-app.sh --app my-api --image python:3.9 --replicas 5 --port 5000

  # Via curl
  curl -fsSL https://yoururl/deploy-app.sh | sudo bash

What this does:
  ✓ Creates Deployment with specified replicas
  ✓ Creates LoadBalancer Service (auto load balancing)
  ✓ Auto-distributes pods across cluster nodes
  ✓ Auto-heals failures (restarts failed pods)
  ✓ Auto-scales based on CPU usage (HPA)
  ✓ Health checks and monitoring
  ✓ Graceful rolling updates

EOF
}

# Main execution
main() {
    print_header
    check_kubectl

    # Parse command-line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --app)
                APP_NAME="$2"
                shift 2
                ;;
            --image)
                APP_IMAGE="$2"
                shift 2
                ;;
            --replicas)
                REPLICAS="$2"
                shift 2
                ;;
            --port)
                PORT="$2"
                shift 2
                ;;
            --namespace)
                NAMESPACE="$2"
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

    # Interactive if no app specified
    if [ -z "$APP_NAME" ]; then
        interactive_setup
    fi

    # Set image to app name if not specified
    if [ -z "$APP_IMAGE" ]; then
        APP_IMAGE="$APP_NAME"
    fi

    deploy_application
    monitor_rollout
    display_status

    log_success "All done! Your load-balanced application is running!"
}

main "$@"
