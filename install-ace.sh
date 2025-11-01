#!/bin/bash
# ACE Framework Installer
# Universal installer that works for any project (Python, TypeScript, etc.)

set -e

TARGET_DIR="${1:-.}"
ACE_SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Installing ACE Framework in $TARGET_DIR"
echo ""

cd "$TARGET_DIR"

# Step 1: Create ace-framework directory structure
echo "📁 Creating ace-framework structure..."
mkdir -p ace-framework/{agents,mcp,scripts,logs,dist}

# Step 2: Copy core files
echo "📦 Copying ACE framework files..."
cp "$ACE_SOURCE_DIR/agents/Generator.ts" ace-framework/agents/
cp "$ACE_SOURCE_DIR/agents/Reflector.ts" ace-framework/agents/
cp "$ACE_SOURCE_DIR/agents/Curator.ts" ace-framework/agents/
cp "$ACE_SOURCE_DIR/mcp/types.ts" ace-framework/mcp/
cp "$ACE_SOURCE_DIR/mcp/beads-client.ts" ace-framework/mcp/
cp "$ACE_SOURCE_DIR/scripts/ace-learn-cycle.ts" ace-framework/scripts/

# Step 3: Create log files
echo "📝 Creating log files..."
touch ace-framework/logs/{execution_traces,insights,amp_notifications}.jsonl

# Step 4: Detect project root and update paths
PROJECT_ROOT="$(pwd)"
echo "🔧 Configuring paths for: $PROJECT_ROOT"

# Update paths in all files
sed -i.bak "s|/Users/sjarmak/ACE_Beads_Amp|$PROJECT_ROOT|g" ace-framework/agents/*.ts
sed -i.bak "s|/Users/sjarmak/ACE_Beads_Amp|$PROJECT_ROOT|g" ace-framework/mcp/*.ts
sed -i.bak "s|/Users/sjarmak/ACE_Beads_Amp|$PROJECT_ROOT|g" ace-framework/scripts/*.ts

# Update AGENTS.md path references
sed -i.bak "s|knowledge/AGENT.md|AGENTS.md|g" ace-framework/agents/*.ts
sed -i.bak "s|knowledge/AGENT.md|AGENTS.md|g" ace-framework/scripts/*.ts

# Update log paths to ace-framework/logs
sed -i.bak "s|logs/|ace-framework/logs/|g" ace-framework/agents/*.ts
sed -i.bak "s|logs/|ace-framework/logs/|g" ace-framework/scripts/*.ts

# Update beads-client cwd
sed -i.bak "s|cwd: '/Users/[^']*'|cwd: '$PROJECT_ROOT/ace-framework'|g" ace-framework/mcp/beads-client.ts

# Clean up backup files
rm -f ace-framework/**/*.bak

# Step 5: Create package.json and tsconfig.json
echo "⚙️  Creating configuration files..."
cat > ace-framework/package.json << EOF
{
  "name": "ace-framework",
  "version": "1.0.0",
  "description": "ACE learning framework",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "ace-learn": "tsx scripts/ace-learn-cycle.ts"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0",
    "tsx": "^4.7.0"
  }
}
EOF

cat > ace-framework/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "moduleResolution": "node"
  },
  "include": ["agents/**/*", "mcp/**/*", "scripts/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

# Step 6: Create or update AGENTS.md
if [ ! -f "AGENTS.md" ]; then
  echo "📄 Creating AGENTS.md..."
  cat > AGENTS.md << 'EOF'
# Project Guide

## Build Commands
```bash
# Add your build/test commands here
```

## Learned Patterns (ACE-managed)
<!-- This section is managed by the ACE Curator -->
<!-- Format: [Bullet #ID, helpful:N, harmful:M] Pattern description -->

### Build & Test Patterns
<!-- Curator adds build/test insights here -->

### Python Patterns
<!-- Curator adds Python-specific insights here -->

### TypeScript Patterns
<!-- Curator adds TypeScript-specific insights here -->

### Dependency Patterns
<!-- Curator adds dependency insights here -->

### Architecture Patterns
<!-- Curator adds high-level design insights here -->
EOF
else
  echo "✓ AGENTS.md already exists, skipping"
fi

# Step 7: Initialize Beads if not already done
if [ ! -d ".beads" ]; then
  if command -v bd &> /dev/null; then
    echo "🔵 Initializing Beads..."
    bd init
  else
    echo "⚠️  Beads (bd) not found - skipping initialization"
    echo "   Install from: https://github.com/steveyegge/beads"
  fi
else
  echo "✓ Beads already initialized"
fi

# Step 8: Install dependencies
echo "📥 Installing dependencies..."
cd ace-framework
npm install --silent

# Step 9: Build
echo "🔨 Building TypeScript..."
npm run build --silent

cd "$PROJECT_ROOT"

echo ""
echo "✅ ACE Framework installed successfully!"
echo ""
echo "📊 Structure:"
echo "  ace-framework/"
echo "    ├── agents/          (Generator, Reflector, Curator)"
echo "    ├── mcp/             (BeadsClient, types)"
echo "    ├── scripts/         (ace-learn-cycle.ts)"
echo "    ├── logs/            (execution traces, insights)"
echo "    └── dist/            (compiled JS)"
echo ""
echo "🚀 Quick start:"
echo "  1. Work on your project with Amp"
echo "  2. When done: cd ace-framework && npm run ace-learn"
echo "  3. Check AGENTS.md for new patterns"
echo ""
echo "📖 For automatic triggering when closing tasks, use BeadsClient in your code"
echo ""
