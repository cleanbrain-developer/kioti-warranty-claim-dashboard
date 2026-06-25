#!/bin/bash
# ============================================================
# Kioti Warranty Claim Dashboard — Initial Server Setup
# Run once on a fresh cloud server (Ubuntu 22.04 / 24.04)
# Usage: bash scripts/server-setup.sh
# ============================================================
set -e

DEPLOY_DIR="/opt/kioti-warranty-claim-dashboard"
REPO_URL="https://github.com/cleanbrain-developer/kioti-warranty-claim-dashboard.git"
BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Kioti Warranty Dashboard — Setup${NC}"
echo -e "${BLUE}========================================${NC}"

# ── 1. Docker 설치 ─────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo -e "${YELLOW}[1/5] Installing Docker...${NC}"
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable docker
  systemctl start docker
  echo -e "${GREEN}  Docker installed.${NC}"
else
  echo -e "${GREEN}[1/5] Docker already installed. ✓${NC}"
fi

# ── 2. 프로젝트 클론 ────────────────────────────────────────
echo -e "${YELLOW}[2/5] Cloning repository to ${DEPLOY_DIR}...${NC}"
if [ -d "$DEPLOY_DIR/.git" ]; then
  echo -e "${GREEN}  Repository already cloned. Running git pull...${NC}"
  git -C "$DEPLOY_DIR" pull origin main
else
  git clone "$REPO_URL" "$DEPLOY_DIR"
fi
echo -e "${GREEN}  Repository ready. ✓${NC}"

# ── 3. .env 설정 ────────────────────────────────────────────
echo -e "${YELLOW}[3/5] Setting up .env file...${NC}"
if [ ! -f "$DEPLOY_DIR/.env" ]; then
  cp "$DEPLOY_DIR/.env.example" "$DEPLOY_DIR/.env"
  echo -e "${RED}  ⚠  .env 파일이 생성되었습니다.${NC}"
  echo -e "${RED}  반드시 아래 명령으로 실제 값을 입력하세요:${NC}"
  echo -e "${YELLOW}  nano ${DEPLOY_DIR}/.env${NC}"
  echo ""
  echo -e "${YELLOW}  설정해야 할 필수 항목:${NC}"
  echo "    SF_CLIENT_ID=<Salesforce Connected App Client ID>"
  echo "    SF_CLIENT_SECRET=<Salesforce Connected App Secret>"
  echo "    SF_USERNAME=<Salesforce API User>"
  echo "    SF_PASSWORD=<Salesforce API Password>"
  echo "    DB_PASSWORD=<원하는 DB 비밀번호>"
  echo "    SYNC_PASSWORD=kioti"
  echo "    FRONTEND_PORT=3001"
  echo ""
  read -p "  .env 수정 후 Enter를 눌러 계속하세요..."
else
  echo -e "${GREEN}  .env 파일이 이미 존재합니다. ✓${NC}"
fi

# ── 4. Firewall — 3001 포트 개방 ────────────────────────────
echo -e "${YELLOW}[4/5] Opening port 3001 (ufw)...${NC}"
if command -v ufw &>/dev/null; then
  ufw allow 3001/tcp 2>/dev/null || true
  echo -e "${GREEN}  ufw: port 3001 allowed. ✓${NC}"
else
  echo -e "${YELLOW}  ufw not found. 클라우드 보안그룹에서 3001 포트를 수동으로 개방하세요.${NC}"
fi

# ── 5. Docker Compose 실행 ──────────────────────────────────
echo -e "${YELLOW}[5/5] Starting services with Docker Compose...${NC}"
cd "$DEPLOY_DIR"
docker compose pull 2>/dev/null || true
docker compose up --build -d

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  배포 완료!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "  서비스 URL : ${BLUE}http://$(curl -s ifconfig.me 2>/dev/null || echo 'SERVER_IP'):3001${NC}"
echo -e "  로그 확인  : ${YELLOW}docker compose -f ${DEPLOY_DIR}/docker-compose.yml logs -f${NC}"
echo -e "  상태 확인  : ${YELLOW}docker compose -f ${DEPLOY_DIR}/docker-compose.yml ps${NC}"
echo ""
