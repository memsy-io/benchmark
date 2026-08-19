#!/bin/bash
set -e

# =============================================================================
# MemoryBench Setup Script for Memsy
# 
# This script:
# 1. Clones the MemoryBench repository
# 2. Injects the Memsy provider adapter
# 3. Patches MemoryBench to register Memsy as a provider
# 4. Installs dependencies
# =============================================================================

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/supermemoryai/memorybench"
TARGET_DIR="memorybench"

# Pinned upstream base commit. The patches below are generated against exactly
# this tree, so cloning the moving `main` branch instead would drift: once
# upstream lands changes that overlap our hunks, a fresh clone stops matching
# the checkout our results were produced on — silently changing scores.
# Bump this deliberately, then regenerate the patches against the new base.
MEMORYBENCH_COMMIT="${MEMORYBENCH_COMMIT:-ed33ee6fb1f2d4da3bb4ab6a076e3c77fb198102}"

# Detect script location to find adapter source
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADAPTER_SRC="$SCRIPT_DIR/adapter"
PROVIDER_DEST="$TARGET_DIR/src/providers/memsy"

echo -e "${BLUE}🚀 Setting up MemoryBench for Memsy...${NC}"

# =============================================================================
# Prerequisites Check
# =============================================================================

echo -e "${BLUE}📋 Checking prerequisites...${NC}"

# Check for bun
if ! command -v bun &> /dev/null; then
    # Try common install locations
    if [ -f "$HOME/.bun/bin/bun" ]; then
        export PATH="$HOME/.bun/bin:$PATH"
    else
        echo -e "${RED}❌ Error: bun is not installed.${NC}"
        echo "   Install with: curl -fsSL https://bun.sh/install | bash"
        exit 1
    fi
fi
echo -e "   ✅ bun $(bun --version)"

# Check for git
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Error: git is not installed.${NC}"
    exit 1
fi
echo -e "   ✅ git available"

# Check adapter source exists
if [ ! -d "$ADAPTER_SRC" ]; then
    echo -e "${RED}❌ Error: Adapter source not found at $ADAPTER_SRC${NC}"
    echo "   Expected files: $ADAPTER_SRC/index.ts and $ADAPTER_SRC/prompts.ts"
    exit 1
fi
echo -e "   ✅ Adapter source found"

# =============================================================================
# Clone MemoryBench
# =============================================================================

if [ -d "$TARGET_DIR" ]; then
    echo -e "${YELLOW}⚠️  MemoryBench directory exists. Updating adapter files only...${NC}"
    CURRENT_BASE="$(git -C "$TARGET_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"
    if [ "$CURRENT_BASE" != "$MEMORYBENCH_COMMIT" ]; then
        echo -e "${YELLOW}   ⚠️  Existing checkout is at ${CURRENT_BASE:0:7}, not the pinned ${MEMORYBENCH_COMMIT:0:7}.${NC}"
        echo -e "${YELLOW}      Patches may not match. Remove $TARGET_DIR and re-run for a clean pinned setup.${NC}"
    fi
else
    echo -e "${BLUE}📦 Cloning MemoryBench at pinned commit ${MEMORYBENCH_COMMIT:0:7}...${NC}"
    # Fetch just the pinned commit where the server allows it (GitHub does),
    # falling back to a full clone on servers that refuse fetch-by-SHA.
    git init -q "$TARGET_DIR"
    git -C "$TARGET_DIR" remote add origin "$REPO_URL"
    if git -C "$TARGET_DIR" fetch -q --depth 1 origin "$MEMORYBENCH_COMMIT" 2>/dev/null; then
        git -C "$TARGET_DIR" checkout -q FETCH_HEAD
    else
        echo -e "${YELLOW}   ⚠️  Shallow fetch by SHA unavailable, falling back to a full clone...${NC}"
        if ! git -C "$TARGET_DIR" fetch -q origin; then
            echo -e "${RED}❌ Failed to fetch $REPO_URL${NC}"
            exit 1
        fi
        if ! git -C "$TARGET_DIR" checkout -q "$MEMORYBENCH_COMMIT"; then
            echo -e "${RED}❌ Pinned commit $MEMORYBENCH_COMMIT not found in $REPO_URL${NC}"
            exit 1
        fi
    fi
    # Land on a real branch so `git apply` and later `git diff` behave predictably.
    git -C "$TARGET_DIR" checkout -q -B memsy-base
    echo -e "   ✅ Checked out ${MEMORYBENCH_COMMIT:0:7}"
fi

# =============================================================================
# Install Memsy Provider
# =============================================================================

echo -e "${BLUE}📂 Installing Memsy Provider...${NC}"
mkdir -p "$PROVIDER_DEST"
cp "$ADAPTER_SRC/index.ts" "$PROVIDER_DEST/index.ts"
cp "$ADAPTER_SRC/prompts.ts" "$PROVIDER_DEST/prompts.ts"
echo -e "   ✅ Copied adapter files to $PROVIDER_DEST"

# =============================================================================
# Patch MemoryBench to Register Memsy Provider
# =============================================================================

PROVIDERS_INDEX="$TARGET_DIR/src/providers/index.ts"
PROVIDER_TYPES="$TARGET_DIR/src/types/provider.ts"

# Patch providers/index.ts
if ! grep -q "MemsyProvider" "$PROVIDERS_INDEX" 2>/dev/null; then
    echo -e "${BLUE}🔧 Patching providers/index.ts...${NC}"
    
    # Add import statement after existing imports
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS sed
        sed -i '' '/import .* from "\.\/zep"/a\
import { MemsyProvider } from "./memsy"' "$PROVIDERS_INDEX"
        
        # Add to providers object
        sed -i '' '/zep: ZepProvider,/a\
  memsy: MemsyProvider,' "$PROVIDERS_INDEX"
        
        # Add to export
        sed -i '' 's/export { SupermemoryProvider, Mem0Provider, ZepProvider }/export { SupermemoryProvider, Mem0Provider, ZepProvider, MemsyProvider }/' "$PROVIDERS_INDEX"
    else
        # Linux sed
        sed -i '/import .* from "\.\/zep"/a import { MemsyProvider } from "./memsy"' "$PROVIDERS_INDEX"
        sed -i '/zep: ZepProvider,/a\  memsy: MemsyProvider,' "$PROVIDERS_INDEX"
        sed -i 's/export { SupermemoryProvider, Mem0Provider, ZepProvider }/export { SupermemoryProvider, Mem0Provider, ZepProvider, MemsyProvider }/' "$PROVIDERS_INDEX"
    fi
    echo -e "   ✅ Patched providers/index.ts"
else
    echo -e "   ✅ providers/index.ts already patched"
fi

# Patch types/provider.ts
if ! grep -q '"memsy"' "$PROVIDER_TYPES" 2>/dev/null; then
    echo -e "${BLUE}🔧 Patching types/provider.ts...${NC}"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' 's/export type ProviderName = "supermemory" | "mem0" | "zep"/export type ProviderName = "supermemory" | "mem0" | "zep" | "memsy"/' "$PROVIDER_TYPES"
    else
        sed -i 's/export type ProviderName = "supermemory" | "mem0" | "zep"/export type ProviderName = "supermemory" | "mem0" | "zep" | "memsy"/' "$PROVIDER_TYPES"
    fi
    echo -e "   ✅ Patched types/provider.ts"
else
    echo -e "   ✅ types/provider.ts already patched"
fi

# Patch utils/config.ts to add memsy provider config
CONFIG_FILE="$TARGET_DIR/src/utils/config.ts"
if ! grep -q 'memsyApiUrl' "$CONFIG_FILE" 2>/dev/null; then
    echo -e "${BLUE}🔧 Patching utils/config.ts...${NC}"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # Add memsyApiUrl and memsyApiKey to Config interface
        sed -i '' '/zepApiKey: string/a\
  memsyApiUrl: string\
  memsyApiKey: string' "$CONFIG_FILE"

        # Add memsyApiUrl and memsyApiKey to config object
        sed -i '' '/zepApiKey: process.env.ZEP_API_KEY/a\
  memsyApiUrl: process.env.MEMSY_API_URL || "https://api.memsy.io/v1",\
  memsyApiKey: process.env.MEMSY_API_KEY || "",' "$CONFIG_FILE"

        # Add memsy case to getProviderConfig (insert after zepApiKey return line)
        sed -i '' '/return { apiKey: config.zepApiKey }/a\
    case "memsy":\
      return { apiKey: config.memsyApiKey, baseUrl: config.memsyApiUrl }' "$CONFIG_FILE"
    else
        # Linux sed
        sed -i '/zepApiKey: string/a\  memsyApiUrl: string\n  memsyApiKey: string' "$CONFIG_FILE"
        sed -i '/zepApiKey: process.env.ZEP_API_KEY/a\  memsyApiUrl: process.env.MEMSY_API_URL || "https://api.memsy.io\/v1",\n  memsyApiKey: process.env.MEMSY_API_KEY || "",' "$CONFIG_FILE"
        sed -i '/return { apiKey: config.zepApiKey }/a\    case "memsy":\n      return { apiKey: config.memsyApiKey, baseUrl: config.memsyApiUrl }' "$CONFIG_FILE"
    fi
    echo -e "   ✅ Patched utils/config.ts"
else
    echo -e "   ✅ utils/config.ts already patched"
fi

# =============================================================================
# Apply Custom Patches
# =============================================================================

# 1. Passed/failed scenarios (--show-passed, judge parsing, report output)
PATCH_DEBUG="$SCRIPT_DIR/patches/debugging_failures.patch"
if [ -f "$PATCH_DEBUG" ]; then
    echo -e "${BLUE}🔧 Applying custom patches...${NC}"
    if ! grep -q "FAILED SCENARIOS" "$TARGET_DIR/src/orchestrator/phases/report.ts" 2>/dev/null; then
        (cd "$TARGET_DIR" && git apply "$PATCH_DEBUG")
        if [ $? -eq 0 ]; then
            echo -e "   ✅ Applied debugging_failures.patch"
        else
            echo -e "${RED}❌ Failed to apply debugging_failures.patch${NC}"
            exit 1
        fi
    else
        echo -e "   ✅ debugging_failures.patch already applied"
    fi
fi

# 2. Random sampling (--limit-round-robin N for exact N questions across categories)
PATCH_SAMPLING="$SCRIPT_DIR/patches/random-sampling.patch"
if [ -f "$PATCH_SAMPLING" ]; then
    if ! grep -q "limitRoundRobin" "$TARGET_DIR/src/types/checkpoint.ts" 2>/dev/null; then
        (cd "$TARGET_DIR" && git apply "$PATCH_SAMPLING")
        if [ $? -eq 0 ]; then
            echo -e "   ✅ Applied random-sampling.patch"
        else
            echo -e "${RED}❌ Failed to apply random-sampling.patch${NC}"
            exit 1
        fi
    else
        echo -e "   ✅ random-sampling.patch already applied"
    fi
fi

# 3. Display retrieved memories in report (FAILED/PASSED scenarios)
PATCH_RETRIEVED="$SCRIPT_DIR/patches/display-retrieved-memories.patch"
if [ -f "$PATCH_RETRIEVED" ]; then
    if ! grep -q "Retrieved Memories" "$TARGET_DIR/src/orchestrator/phases/report.ts" 2>/dev/null; then
        (cd "$TARGET_DIR" && git apply "$PATCH_RETRIEVED")
        if [ $? -eq 0 ]; then
            echo -e "   ✅ Applied display-retrieved-memories.patch"
        else
            echo -e "${RED}❌ Failed to apply display-retrieved-memories.patch${NC}"
            exit 1
        fi
    else
        echo -e "   ✅ display-retrieved-memories.patch already applied"
    fi
fi

# 4. BEAM benchmark (beam100k dataset)
PATCH_BEAM="$SCRIPT_DIR/patches/beam-benchmark.patch"
BEAM_TARGET="$TARGET_DIR/src/benchmarks/beam/index.ts"
if [ -f "$PATCH_BEAM" ]; then
    # Gate on a content marker rather than on the file merely existing, so a
    # checkout carrying an older beam/index.ts gets upgraded instead of being
    # reported as "already applied".
    if ! grep -q "MAX_REPEAT_LINE_RUN" "$BEAM_TARGET" 2>/dev/null; then
        # The beam/ sources are pure additions, so recreate them from the patch.
        rm -rf "$TARGET_DIR/src/benchmarks/beam"
        if ! (cd "$TARGET_DIR" && git apply --include='src/benchmarks/beam/*' "$PATCH_BEAM"); then
            echo -e "${RED}❌ Failed to apply beam-benchmark.patch (beam sources)${NC}"
            exit 1
        fi
        # The registry wiring edits existing files, so apply it only when absent —
        # git apply is atomic and would reject the whole patch on a re-run.
        if ! grep -q "beam100k" "$TARGET_DIR/src/types/benchmark.ts" 2>/dev/null; then
            if ! (cd "$TARGET_DIR" && git apply --exclude='src/benchmarks/beam/*' "$PATCH_BEAM"); then
                echo -e "${RED}❌ Failed to apply beam-benchmark.patch (registry wiring)${NC}"
                exit 1
            fi
        fi
        echo -e "   ✅ Applied beam-benchmark.patch"
    else
        echo -e "   ✅ beam-benchmark.patch already applied"
    fi
fi

# 5. Exclude LoCoMo category 5 (adversarial/unanswerable) from the question set
PATCH_LOCOMO="$SCRIPT_DIR/patches/exclude-locomo-adversarial.patch"
if [ -f "$PATCH_LOCOMO" ]; then
    if ! grep -q "EXCLUDED_CATEGORIES" "$TARGET_DIR/src/benchmarks/locomo/index.ts" 2>/dev/null; then
        if ! (cd "$TARGET_DIR" && git apply "$PATCH_LOCOMO"); then
            echo -e "${RED}❌ Failed to apply exclude-locomo-adversarial.patch${NC}"
            exit 1
        fi
        echo -e "   ✅ Applied exclude-locomo-adversarial.patch"
    else
        echo -e "   ✅ exclude-locomo-adversarial.patch already applied"
    fi
fi

# =============================================================================
# Install Dependencies
# =============================================================================

echo -e "${BLUE}📦 Installing dependencies...${NC}"
cd "$TARGET_DIR" && bun install

# =============================================================================
# Done
# =============================================================================

echo ""
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo ""
echo -e "Next steps:"
echo -e "  1. Ensure your .env has:  ${BLUE}MEMSY_API_KEY=<your key>  OPENAI_API_KEY=<your key>${NC}"
echo -e "     (Get your Memsy API key at https://app.memsy.io)"
echo -e "  2. Run benchmark:         ${BLUE}./benchmark/run.sh [LIMIT] [WAIT_SECS] [SHOW_PASSED]${NC}"
echo -e "     Examples:"
echo -e "       ${BLUE}./benchmark/run.sh 5${NC}          # 5 questions (random sampling)"
echo -e "       ${BLUE}./benchmark/run.sh 7 10${NC}       # 7 questions, wait 10s for indexing"
echo -e "       ${BLUE}./benchmark/run.sh 1 2 true${NC}   # 1 question, wait 2s, show passed scenarios"
echo ""
