#!/bin/bash
set -e

curl -fsSL https://claude.ai/install.sh | bash
export PATH="$HOME/.local/bin:$PATH"
claude plugin marketplace add JuliusBrussee/caveman
claude plugin install caveman@caveman