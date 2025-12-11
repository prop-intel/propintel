#!/usr/bin/env bash
set -e

# Test runner script that sets up and runs all tests
# This script:
# 1. Checks/starts the test database
# 2. Runs database migrations if needed
# 3. Optionally starts backend API (or uses mocks)
# 4. Runs all tests
# 5. Cleans up if needed

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🧪 Starting test runner...${NC}"

# Check if .env exists
if [ ! -f .env ]; then
  echo -e "${YELLOW}⚠️  .env file not found. Tests may fail without proper configuration.${NC}"
fi

# Load environment variables
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Test database configuration
TEST_DB_URL="${TEST_DATABASE_URL:-postgresql://localhost:5432/propintel_test}"
TEST_DB_PORT="${TEST_DB_PORT:-5432}"
TEST_DB_NAME="propintel_test"

# Function to check if port is in use
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

# Function to wait for database to be ready
wait_for_db() {
  local max_attempts=30
  local attempt=0
  
  echo -e "${YELLOW}⏳ Waiting for database to be ready...${NC}"
  
  while [ $attempt -lt $max_attempts ]; do
    if check_port "$TEST_DB_PORT"; then
      # Try to connect
      if psql "$TEST_DB_URL" -c "SELECT 1" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Database is ready${NC}"
        return 0
      fi
    fi
    attempt=$((attempt + 1))
    sleep 1
  done
  
  echo -e "${RED}❌ Database did not become ready in time${NC}"
  return 1
}

# Check if database is running
if ! check_port "$TEST_DB_PORT"; then
  echo -e "${YELLOW}📦 Database not running. Attempting to start...${NC}"
  
  # Try to use start-database.sh if it exists
  if [ -f start-database.sh ]; then
    # Modify DATABASE_URL temporarily for test database
    export DATABASE_URL="$TEST_DB_URL"
    if bash start-database.sh 2>/dev/null; then
      echo -e "${GREEN}✅ Database started${NC}"
    else
      echo -e "${YELLOW}⚠️  Could not auto-start database. Please start it manually:${NC}"
      echo -e "   ./start-database.sh"
      echo -e "   Or ensure PostgreSQL is running on port $TEST_DB_PORT"
      read -p "Continue anyway? [y/N]: " -r
      if ! [[ $REPLY =~ ^[Yy]$ ]]; then
        exit 1
      fi
    fi
  else
    echo -e "${YELLOW}⚠️  start-database.sh not found. Please ensure database is running.${NC}"
    read -p "Continue anyway? [y/N]: " -r
    if ! [[ $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
fi

# Wait for database
wait_for_db || {
  echo -e "${RED}❌ Database is not accessible${NC}"
  exit 1
}

# Run database migrations for test database
echo -e "${GREEN}🔄 Running database migrations...${NC}"
export DATABASE_URL="$TEST_DB_URL"
npm run db:push >/dev/null 2>&1 || {
  echo -e "${YELLOW}⚠️  Database migrations may have failed, but continuing...${NC}"
}

# Check if backend API should be started
USE_REAL_BACKEND="${USE_REAL_BACKEND:-false}"
BACKEND_PORT="${BACKEND_PORT:-4000}"

if [ "$USE_REAL_BACKEND" = "true" ]; then
  if ! check_port "$BACKEND_PORT"; then
    echo -e "${YELLOW}🚀 Starting backend API server...${NC}"
    cd backend
    npm run dev >/tmp/propintel-backend.log 2>&1 &
    BACKEND_PID=$!
    cd ..
    
    # Wait for backend to start
    echo -e "${YELLOW}⏳ Waiting for backend API to start...${NC}"
    sleep 5
    
    if check_port "$BACKEND_PORT"; then
      echo -e "${GREEN}✅ Backend API started (PID: $BACKEND_PID)${NC}"
      trap "kill $BACKEND_PID 2>/dev/null || true" EXIT
    else
      echo -e "${YELLOW}⚠️  Backend API may not have started. Check /tmp/propintel-backend.log${NC}"
    fi
  else
    echo -e "${GREEN}✅ Backend API already running on port $BACKEND_PORT${NC}"
  fi
else
  echo -e "${GREEN}ℹ️  Using mocked backend API (MSW)${NC}"
fi

# Run tests
echo -e "${GREEN}🧪 Running all tests...${NC}"
echo ""

if npm run test:integration; then
  echo ""
  echo -e "${GREEN}✅ Integration tests passed!${NC}"
  
  # Optionally run backend tests
  if [ "$USE_REAL_BACKEND" = "true" ]; then
    echo ""
    echo -e "${GREEN}🧪 Running backend tests...${NC}"
    npm run test:backend || {
      echo -e "${YELLOW}⚠️  Some backend tests failed${NC}"
    }
  fi
  
  echo ""
  echo -e "${GREEN}🎉 All tests completed!${NC}"
  exit 0
else
  echo ""
  echo -e "${RED}❌ Tests failed${NC}"
  exit 1
fi
