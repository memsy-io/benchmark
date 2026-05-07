#!/bin/bash

# =============================================================================
# MemoryBench Runner Script for Memsy
#
# Usage: ./benchmark/run.sh [LIMIT] [WAIT_FOR_SEARCH] [SHOW_PASSED]
#   LIMIT: Number of questions to run (default: 5)
#   WAIT_FOR_SEARCH: Seconds to wait for search index (default: 10)
#   SHOW_PASSED: Show passed scenarios (true/false, default: false)
#
# This script:
# 1. Validates prerequisites (OPENAI_API_KEY, memorybench setup)
# 2. Runs the MemoryBench benchmark
# 3. Extracts metrics from output
# 4. Logs results to BENCHMARK_HISTORY.md
# =============================================================================

# Configuration
LOG_FILE="BENCHMARK_HISTORY.md"
TARGET_DIR="memorybench"
LOGS_DIR="benchmark_logs"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Detect script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to project root
cd "$PROJECT_ROOT"

# =============================================================================
# Load Environment
# =============================================================================

if [ -f .env ]; then
    echo -e "${BLUE}📂 Loading .env file...${NC}"
    set -a
    source .env
    set +a
fi

# =============================================================================
# Validate Prerequisites
# =============================================================================

echo -e "${BLUE}📋 Checking prerequisites...${NC}"

# Check OPENAI_API_KEY
if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${RED}❌ Error: OPENAI_API_KEY is not set.${NC}"
    echo "   Please set it in your .env file or export it in your shell."
    exit 1
fi
echo -e "   ✅ OPENAI_API_KEY is set"

# Check MEMSY_API_KEY
if [ -z "$MEMSY_API_KEY" ]; then
    echo -e "${RED}❌ Error: MEMSY_API_KEY is not set.${NC}"
    echo "   Get your API key from https://app.memsy.io and set it in your .env file."
    exit 1
fi
echo -e "   ✅ MEMSY_API_KEY is set"

# Check bun
if ! command -v bun &> /dev/null; then
    if [ -f "$HOME/.bun/bin/bun" ]; then
        export PATH="$HOME/.bun/bin:$PATH"
    else
        echo -e "${RED}❌ Error: bun is not installed.${NC}"
        exit 1
    fi
fi
echo -e "   ✅ bun available"

# Check MemoryBench setup
if [ ! -d "$TARGET_DIR" ]; then
    echo -e "${YELLOW}⚠️  MemoryBench not found. Running setup...${NC}"
    "$SCRIPT_DIR/setup.sh"
fi
echo -e "   ✅ MemoryBench directory exists"

# Check Memsy API is reachable
MEMSY_URL="${MEMSY_API_URL:-https://api.memsy.io/v1}"
if ! curl -s --connect-timeout 5 -H "Authorization: Bearer $MEMSY_API_KEY" "$MEMSY_URL/health" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Warning: Memsy API not responding at $MEMSY_URL${NC}"
    echo -e "   Check that MEMSY_API_URL is correct and MEMSY_API_KEY is valid."
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "   ✅ Memsy API responding at $MEMSY_URL"
fi

# =============================================================================
# Gather Metadata
# =============================================================================

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
SAFE_TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
USER=$(whoami)

echo ""
echo -e "${BLUE}ℹ️  Benchmark Run Info${NC}"
echo -e "   Branch: $BRANCH"
echo -e "   Commit: $COMMIT"
echo -e "   User:   $USER"

# =============================================================================
# Initialize History File
# =============================================================================

if [ ! -f "$LOG_FILE" ]; then
    echo "# Benchmark History" > "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    echo "| Date | User | Branch | Commit | Limit | Acc | Hit@10 | Prec | Rec | F1 | MRR | NDCG | Latency | Log |" >> "$LOG_FILE"
    echo "| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |" >> "$LOG_FILE"
fi

# =============================================================================
# Run Benchmark
# =============================================================================

LIMIT=${1:-5}
WAIT_FOR_SEARCH=${2:-10}
SHOW_PASSED=${3:-false}

# Round-robin: exactly LIMIT questions, rotating across categories (e.g. 7 = 1 each + 2 from first two).
echo ""
echo -e "${BLUE}🚀 Running MemoryBench (Limit: $LIMIT questions, round-robin, Wait: ${WAIT_FOR_SEARCH}s, Show Passed: ${SHOW_PASSED})...${NC}"
echo ""

# Unique run ID per run so each run is fresh (new question, full ingest). Override with RUN_ID=... to resume.
RUN_ID="${RUN_ID:-memsy-run-$(date +%s)}"

# Build command with optional --show-passed flag
BUN_CMD="cd $TARGET_DIR && MEMSY_API_URL=\"$MEMSY_URL\" MEMSY_API_KEY=\"$MEMSY_API_KEY\" bun run src/index.ts run \
    --provider memsy \
    --benchmark locomo \
    --judge gpt-4.1-mini \
    --answering-model gpt-4.1-mini \
    --run-id \"$RUN_ID\" \
    --wait-for-search \"$WAIT_FOR_SEARCH\" \
    --limit-round-robin \"$LIMIT\""

# Add --show-passed flag if enabled
if [ "$SHOW_PASSED" = "true" ]; then
    BUN_CMD="$BUN_CMD --show-passed"
fi

# Run and capture output
OUTPUT=$(eval "$BUN_CMD 2>&1")

# =============================================================================
# Extract Metrics
# =============================================================================

# Extract global Accuracy
ACCURACY=$(echo "$OUTPUT" | grep -E "^\s*Accuracy:" | head -1 | awk '{print $2}')

# Extract Latency Mean (Total row)
LATENCY_MEAN=$(echo "$OUTPUT" | awk '/LATENCY \(ms\):/,/RETRIEVAL/' | grep "Total:" | awk '{print $4}')

# Extract Retrieval Quality Metrics
RETRIEVAL_BLOCK=$(echo "$OUTPUT" | awk '/RETRIEVAL QUALITY/,/BY QUESTION TYPE/')
HIT_AT_K=$(echo "$RETRIEVAL_BLOCK" | grep "Hit@K:" | awk '{print $2}')
PRECISION=$(echo "$RETRIEVAL_BLOCK" | grep "Precision:" | awk '{print $2}')
RECALL=$(echo "$RETRIEVAL_BLOCK" | grep "Recall:" | awk '{print $2}')
F1=$(echo "$RETRIEVAL_BLOCK" | grep "F1:" | awk '{print $2}')
MRR=$(echo "$RETRIEVAL_BLOCK" | grep "MRR:" | awk '{print $2}')
NDCG=$(echo "$RETRIEVAL_BLOCK" | grep "NDCG:" | awk '{print $2}')

# Default to "-" if empty
ACCURACY=${ACCURACY:-"-"}
HIT_AT_K=${HIT_AT_K:-"-"}
PRECISION=${PRECISION:-"-"}
RECALL=${RECALL:-"-"}
F1=${F1:-"-"}
MRR=${MRR:-"-"}
NDCG=${NDCG:-"-"}
LATENCY_MEAN=${LATENCY_MEAN:-"-"}

# =============================================================================
# Save Full Log
# =============================================================================

mkdir -p "$LOGS_DIR"
LOG_FILENAME="$LOGS_DIR/benchmark_${SAFE_TIMESTAMP}.txt"
echo "$OUTPUT" > "$LOG_FILENAME"

# =============================================================================
# Log to History File
# =============================================================================

echo "| $TIMESTAMP | $USER | \`$BRANCH\` | \`$COMMIT\` | $LIMIT | $ACCURACY | $HIT_AT_K | $PRECISION | $RECALL | $F1 | $MRR | $NDCG | ${LATENCY_MEAN}ms | [View]($LOG_FILENAME) |" >> "$LOG_FILE"

# =============================================================================
# Print Summary
# =============================================================================

echo ""
echo -e "${GREEN}✅ Benchmark Complete!${NC}"
echo ""
echo -e "Results:"
echo -e "   Accuracy:  $ACCURACY"
echo -e "   Hit@10:    $HIT_AT_K"
echo -e "   Precision: $PRECISION"
echo -e "   Recall:    $RECALL"
echo -e "   F1:        $F1"
echo -e "   MRR:       $MRR"
echo -e "   NDCG:      $NDCG"
echo -e "   Latency:   ${LATENCY_MEAN}ms (mean)"
echo ""
echo -e "Logged to: $LOG_FILE"
echo -e "Full output: $LOG_FILENAME"
