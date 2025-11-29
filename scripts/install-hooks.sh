#!/bin/bash
# Install git hooks for the maritime reservation project
# Run this script once: ./scripts/install-hooks.sh

HOOKS_DIR=".git/hooks"
PROJECT_ROOT="$(git rev-parse --show-toplevel)"

echo "Installing git hooks..."

# Create pre-push hook
cat > "$PROJECT_ROOT/$HOOKS_DIR/pre-push" << 'EOF'
#!/bin/bash
# Pre-push hook: Run tests before pushing

echo "Running pre-push checks..."

# Get project root
PROJECT_ROOT="$(git rev-parse --show-toplevel)"

# Run backend unit tests
echo "Running backend unit tests..."
cd "$PROJECT_ROOT/backend"

if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Run quick unit tests (skip slow integration tests)
pytest tests/unit/ -x -q --tb=line

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Unit tests failed! Push aborted."
    echo "Fix the failing tests before pushing."
    exit 1
fi

# Run frontend tests
echo "Running frontend tests..."
cd "$PROJECT_ROOT/frontend"

npm test -- --watchAll=false --passWithNoTests 2>/dev/null

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Frontend tests failed! Push aborted."
    echo "Fix the failing tests before pushing."
    exit 1
fi

echo ""
echo "✅ All tests passed! Pushing..."
exit 0
EOF

chmod +x "$PROJECT_ROOT/$HOOKS_DIR/pre-push"

echo "✅ Git hooks installed successfully!"
echo ""
echo "The pre-push hook will now run tests before each push."
echo "To skip (not recommended): git push --no-verify"
