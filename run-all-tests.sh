#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR" && pwd)"
cd "$PROJECT_ROOT"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo -e "\n${YELLOW}🧹 Cleaning up...${NC}"
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

check_port() {
  local port=$1
  if command -v nc >/dev/null 2>&1; then
    nc -z localhost "$port" 2>/dev/null
  elif command -v lsof >/dev/null 2>&1; then
    lsof -i ":$port" >/dev/null 2>&1
  else
    return 1
  fi
}

wait_for_service() {
  local port=$1
  local service_name=$2
  local max_attempts=${3:-60}
  local attempt=0
  
  echo -e "${YELLOW}⏳ Waiting for $service_name on port $port...${NC}"
  
  while [ $attempt -lt $max_attempts ]; do
    if check_port "$port"; then
      echo -e "${GREEN}✅ $service_name is ready${NC}"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done
  
  echo -e "${RED}❌ $service_name did not become ready${NC}"
  return 1
}

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

echo -e "${GREEN}🧪 Starting test runner...${NC}\n"

TEST_DB_URL="${TEST_DATABASE_URL:-postgresql://localhost:5432/propintel_test}"
DB_PORT=$(echo "$TEST_DB_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_PORT="${DB_PORT:-5432}"

echo -e "${BLUE}📦 Setting up database...${NC}"

IS_LOCAL_DB=false
if [[ "${DATABASE_URL:-}" == *"localhost"* ]] || [[ "${DATABASE_URL:-}" == *"127.0.0.1"* ]]; then
  IS_LOCAL_DB=true
fi

if ! check_port "$DB_PORT"; then
  if [ "$IS_LOCAL_DB" = true ] && [ -f start-database.sh ]; then
    echo -e "${YELLOW}   Starting local database...${NC}"
    if bash start-database.sh 2>&1; then
      echo -e "${GREEN}✅ Database started${NC}"
      sleep 3
    else
      echo -e "${YELLOW}⚠️  Could not auto-start database${NC}"
      echo "   Run: ./start-database.sh"
      if [ -z "${CI:-}" ] && [ -z "${GITHUB_ACTIONS:-}" ]; then
        read -p "Continue anyway? [y/N]: " -r
        if ! [[ $REPLY =~ ^[Yy]$ ]]; then
          exit 1
        fi
      else
        echo "   Continuing in CI environment..."
      fi
    fi
  else
    if [ "$IS_LOCAL_DB" = false ]; then
      echo -e "${YELLOW}⚠️  Using remote database. Ensure it's accessible.${NC}"
    else
      echo -e "${YELLOW}⚠️  Database not running on port $DB_PORT${NC}"
      echo "   Run: ./start-database.sh"
      if [ -z "${CI:-}" ] && [ -z "${GITHUB_ACTIONS:-}" ]; then
        read -p "Continue anyway? [y/N]: " -r
        if ! [[ $REPLY =~ ^[Yy]$ ]]; then
          exit 1
        fi
      else
        echo "   Continuing in CI environment..."
      fi
    fi
  fi
else
  echo -e "${GREEN}✅ Database already running${NC}"
fi

if command -v psql >/dev/null 2>&1; then
  for i in {1..10}; do
    if psql "$TEST_DB_URL" -c "SELECT 1" >/dev/null 2>&1; then
      break
    fi
    [ $i -eq 10 ] && echo -e "${YELLOW}⚠️  Database may not be ready${NC}"
    sleep 1
  done
fi

echo -e "${BLUE}🔄 Running migrations...${NC}"
export DATABASE_URL="$TEST_DB_URL"
npm run db:push >/dev/null 2>&1 || echo -e "${YELLOW}⚠️  Migrations may have failed${NC}"

echo ""

echo -e "${BLUE}🚀 Setting up backend...${NC}"

BACKEND_PORT="${BACKEND_PORT:-4000}"

if ! check_port "$BACKEND_PORT"; then
  echo -e "${YELLOW}   Starting backend...${NC}"
  
  if [ -d backend ]; then
    cd backend
    
    if [ ! -d node_modules ]; then
      echo -e "${YELLOW}   Installing dependencies...${NC}"
      npm install
    fi
    
    # Force DATABASE_URL to local test database - update .env file
    TEST_DB="${TEST_DB_URL:-postgresql://postgres:password@localhost:5432/propintel_test}"
    if ! grep -q "^DATABASE_URL=" .env 2>/dev/null; then
      echo "DATABASE_URL=$TEST_DB" >> .env
    else
      # Replace existing DATABASE_URL (macOS compatible)
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=$TEST_DB|" .env
      else
        sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$TEST_DB|" .env
      fi
    fi
    
    # Also export for the process
    export DATABASE_URL="$TEST_DB"
    npm run dev >/tmp/propintel-backend.log 2>&1 &
    BACKEND_PID=$!
    cd ..
    
    if wait_for_service "$BACKEND_PORT" "Backend API" 120; then
      echo -e "${GREEN}✅ Backend started (PID: $BACKEND_PID)${NC}"
    else
      echo -e "${YELLOW}⚠️  Backend may not be ready yet${NC}"
      echo "   Check: /tmp/propintel-backend.log"
      echo "   Tests will continue (some may use mocks)"
    fi
  else
    echo -e "${YELLOW}⚠️  Backend directory not found${NC}"
  fi
else
  echo -e "${GREEN}✅ Backend already running${NC}"
fi

echo ""

FRONTEND_PORT="${FRONTEND_PORT:-3000}"

if [ "${START_FRONTEND:-false}" = "true" ]; then
  echo -e "${BLUE}🎨 Setting up frontend...${NC}"
  
  if ! check_port "$FRONTEND_PORT"; then
    [ ! -d node_modules ] && npm install
    
    npm run dev >/tmp/propintel-frontend.log 2>&1 &
    FRONTEND_PID=$!
    
    if wait_for_service "$FRONTEND_PORT" "Frontend" 60; then
      echo -e "${GREEN}✅ Frontend started (PID: $FRONTEND_PID)${NC}"
    else
      echo -e "${YELLOW}⚠️  Frontend may not have started${NC}"
    fi
  else
    echo -e "${GREEN}✅ Frontend already running${NC}"
  fi
  
  echo ""
fi

echo -e "${GREEN}🧪 Running tests...${NC}\n"

TEST_FAILURES=0

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 Integration tests${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if npm run test:integration; then
  echo -e "${GREEN}✅ Integration tests passed${NC}"
else
  echo -e "${RED}❌ Integration tests failed${NC}"
  TEST_FAILURES=$((TEST_FAILURES + 1))
fi
echo ""

if [ -d backend ] && [ -f backend/package.json ]; then
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}📋 Backend API tests${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  if npm run test:backend; then
    echo -e "${GREEN}✅ Backend API tests passed${NC}"
  else
    echo -e "${RED}❌ Backend API tests failed${NC}"
    TEST_FAILURES=$((TEST_FAILURES + 1))
  fi
  echo ""
  
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}📋 Backend E2E tests${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  if npm run test:backend:e2e; then
    echo -e "${GREEN}✅ Backend E2E tests passed${NC}"
  else
    echo -e "${RED}❌ Backend E2E tests failed${NC}"
    TEST_FAILURES=$((TEST_FAILURES + 1))
  fi
  echo ""
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ $TEST_FAILURES -eq 0 ]; then
  echo -e "${GREEN}🎉 All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ $TEST_FAILURES test suite(s) failed${NC}"
  exit 1
fi
