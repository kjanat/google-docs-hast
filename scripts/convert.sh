#!/bin/bash

# Google Docs HAST Converter
# Usage: ./scripts/convert.sh <format> <input_file> <output_file>
# Format: html or md
# Example: ./scripts/convert.sh html input.json output.html

set -e

# Check arguments
if [ $# -ne 3 ]; then
    echo "Usage: $0 <format> <input_file> <output_file>"
    echo "Format: html or md"
    echo "Example: $0 html input.json output.html"
    exit 1
fi

FORMAT="$1"
INPUT_FILE="$2"
OUTPUT_FILE="$3"

# Validate format
if [[ "$FORMAT" != "html" && "$FORMAT" != "md" ]]; then
    echo "Error: Format must be 'html' or 'md'"
    exit 1
fi

# Check if input file exists
if [ ! -f "$INPUT_FILE" ]; then
    echo "Error: Input file '$INPUT_FILE' not found"
    exit 1
fi

# Create output directory if it doesn't exist
OUTPUT_DIR=$(dirname "$OUTPUT_FILE")
mkdir -p "$OUTPUT_DIR"

# Check if dist exists, build if not
if [ ! -f "dist/index.js" ]; then
    echo "Building project..."
    npm run build
fi

# Run the conversion
echo "Converting $INPUT_FILE to $FORMAT format..."
node scripts/convert-improved.js "$FORMAT" "$INPUT_FILE" "$OUTPUT_FILE"

echo "Conversion complete: $OUTPUT_FILE"