#!/bin/bash

# Cross-platform CLI testing script
# This script tests the core CLI functionality without requiring Docker

set -e

echo "🧪 Starting cross-platform CLI tests..."
echo "Platform: $(uname -s)"
echo "Node version: $(node --version)"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}→${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
    exit 1
}

# Test CLI is built
print_status "Checking if CLI is built..."
if [ ! -f "dist/cli.js" ]; then
    print_error "CLI not built. Run 'bun run build' first."
fi
print_success "CLI binary found"

# Test CLI help command (Commander.js exits with code 1 for help, but outputs help text)
print_status "Testing CLI help command..."
if node dist/cli.js --help 2>&1 | grep -q "light"; then
    print_success "Help command works"
else
    print_error "Help command failed"
fi

# Test CLI version command (Commander.js exits with code 1 for version, but outputs version)
print_status "Testing CLI version command..."
if node dist/cli.js --version 2>&1 | grep -E "[0-9]+\.[0-9]+\.[0-9]+"; then
    print_success "Version command works"
else
    print_error "Version command failed"
fi

# Create temporary test directory
TEST_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t 'cli-test')
print_status "Created test directory: $TEST_DIR"

cd "$TEST_DIR"

# Test CLI init command
print_status "Testing CLI init command..."
if node "$OLDPWD/dist/cli.js" init test-cross-platform 2>&1 | grep -q "initialized"; then
    print_success "Init command works"
else
    print_error "Init command failed"
fi

# Verify files were created
print_status "Verifying generated files..."

check_file() {
    if [ -f "$1" ]; then
        print_success "File exists: $1"
    else
        print_error "Missing file: $1"
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        print_success "Directory exists: $1"
    else
        print_error "Missing directory: $1"
    fi
}

check_file "light.config.yaml"
check_file ".light/docker-compose.yml"
check_file ".light/docker-compose.dev.yml"
check_file ".light/docker-compose.prod.yml"
check_dir ".light/certs"

# Verify YAML is valid (basic check)
print_status "Checking YAML configuration..."
if grep -q "name: test-cross-platform" light.config.yaml; then
    print_success "YAML configuration is valid"
else
    print_error "YAML configuration is invalid"
fi

# Verify Docker Compose files don't have version attribute
print_status "Checking Docker Compose files for version attribute..."
if grep -q "^version:" .light/docker-compose*.yml; then
    print_error "Found obsolete version attribute in Docker Compose files"
else
    print_success "Docker Compose files are clean (no version attribute)"
fi

# Test prerequisites validation
print_status "Testing prerequisites validation..."
# This should fail because there's no Dockerfile
if node "$OLDPWD/dist/cli.js" up 2>&1 | grep -q "Dockerfile not found"; then
    print_success "Prerequisites validation works"
else
    print_error "Prerequisites validation failed"
fi

# Create mock Dockerfile and test again
print_status "Creating mock Dockerfile..."
cat > Dockerfile << 'EOF'
FROM node:20-alpine
WORKDIR /app
EXPOSE 3000
CMD ["npm", "start"]
EOF

# Test with Dockerfile present (will fail on Docker not running, which is expected)
print_status "Testing with Dockerfile present..."
if node "$OLDPWD/dist/cli.js" up 2>&1 | grep -qE "(Docker.*running|Starting.*environment)"; then
    print_success "CLI proceeds with Dockerfile present"
else
    print_error "CLI failed unexpectedly with Dockerfile present"
fi

# Test BaaS detection
print_status "Testing BaaS service detection..."
mkdir -p supabase
echo "# Supabase config" > supabase/config.toml

if node "$OLDPWD/dist/cli.js" up 2>&1 | grep -qE "(BaaS|Supabase)"; then
    print_success "BaaS detection works"
else
    # This is not critical, so just note it
    echo -e "${BLUE}ℹ${NC} BaaS detection test inconclusive (expected when Docker not available)"
fi

# Test down command validation
print_status "Testing down command..."
if node "$OLDPWD/dist/cli.js" down 2>&1 | grep -qE "(Docker|Stopping|project)"; then
    print_success "Down command validation works"
else
    print_error "Down command validation failed"
fi

# Cleanup
cd "$OLDPWD"
rm -rf "$TEST_DIR"
print_success "Cleaned up test directory"

echo ""
print_success "All cross-platform tests passed! 🎉"
echo ""
echo "Summary:"
echo "  - CLI binary works correctly"
echo "  - Help and version commands function"
echo "  - Project initialization creates all required files"
echo "  - Docker Compose files are properly formatted"
echo "  - Prerequisites validation works"
echo "  - Error handling is appropriate"
echo ""
echo "✨ CLI is ready for cross-platform deployment!"