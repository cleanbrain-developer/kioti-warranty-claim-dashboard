#!/bin/bash
# ============================================================
# Kioti Warranty Claim Dashboard — Update & Redeploy
# Run after pushing new code to GitHub
# Usage: bash /opt/kioti-warranty-claim-dashboard/scripts/deploy.sh
# ============================================================
set -e

DEPLOY_DIR="/opt/kioti-warranty-claim-dashboard"
BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo -e "${BLUE}[deploy] Pulling latest code...${NC}"
git -C "$DEPLOY_DIR" pull origin main

echo -e "${BLUE}[deploy] Rebuilding and restarting containers...${NC}"
cd "$DEPLOY_DIR"
docker compose up --build -d

echo -e "${BLUE}[deploy] Waiting for containers to be healthy...${NC}"
sleep 5
docker compose ps

echo -e "${GREEN}[deploy] Done. Service running on port 3001.${NC}"
