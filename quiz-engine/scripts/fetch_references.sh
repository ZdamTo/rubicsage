#!/bin/bash
# Download CKE 2025 reference PDFs for rubric alignment
# Usage: bash scripts/fetch_references.sh

set -e
DIR="references/cke_2025"
mkdir -p "$DIR"

BASE="https://cke.gov.pl/images/_EGZAMIN_MATURALNY_OD_2023/Arkusze_egzaminacyjne/2025"

echo "=== Downloading Polish (Basic) ==="
curl -L -o "$DIR/polish_basic_p1_arkusz.pdf" \
  "$BASE/Jezyk_polski/poziom_podstawowy/MPOP-P1-100-A-2505-arkusz.pdf" 2>/dev/null || echo "WARN: Failed to download P1 arkusz"
curl -L -o "$DIR/polish_basic_p1_zasady.pdf" \
  "$BASE/zasady_oceniania/MPOP-P1-100-2505-zasady.pdf" 2>/dev/null || echo "WARN: Failed to download P1 zasady"
curl -L -o "$DIR/polish_basic_p2_arkusz.pdf" \
  "$BASE/Jezyk_polski/poziom_podstawowy/MPOP-P2-100-A-2505-arkusz.pdf" 2>/dev/null || echo "WARN: Failed to download P2 arkusz"
curl -L -o "$DIR/polish_basic_p2_zasady.pdf" \
  "$BASE/zasady_oceniania/MPOP-P2-200-700-2505-zasady.pdf" 2>/dev/null || echo "WARN: Failed to download P2 zasady"

echo "=== Downloading Mathematics (Basic) ==="
curl -L -o "$DIR/math_basic_arkusz.pdf" \
  "$BASE/Matematyka/poziom_podstawowy/MMAP-P0-100-A-2505-arkusz.pdf" 2>/dev/null || echo "WARN: Failed to download math arkusz"
curl -L -o "$DIR/math_basic_zasady.pdf" \
  "$BASE/zasady_oceniania/MMAP-P0-100-2505-zasady.pdf" 2>/dev/null || echo "WARN: Failed to download math zasady"

echo "=== Downloading Informatics (Advanced) ==="
curl -L -o "$DIR/informatics_advanced_arkusz.pdf" \
  "$BASE/Informatyka/MINP-R0-100-A-2505-arkusz.pdf" 2>/dev/null || echo "WARN: Failed to download info arkusz"
curl -L -o "$DIR/informatics_advanced_zasady.pdf" \
  "$BASE/zasady_oceniania/MINP-R0-100-2505-zasady.pdf" 2>/dev/null || echo "WARN: Failed to download info zasady"
curl -L -o "$DIR/informatics_data.zip" \
  "$BASE/Informatyka/Dane-NF-2505.zip" 2>/dev/null || echo "WARN: Failed to download data zip"

echo "=== Done ==="
ls -la "$DIR"
