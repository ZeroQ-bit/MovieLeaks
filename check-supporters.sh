#!/bin/bash
# Quick script to view all supporter codes

echo "📋 All Active Supporter Codes:"
echo "================================"
cat supporters.json | jq -r '.codes[] | select(.status == "active") | 
  "\(.email)\n  Code: \(.code)\n  Expires: \(.expires_at)\n  Created: \(.created_at)\n"'

echo ""
echo "📊 Summary:"
echo "Total active codes: $(cat supporters.json | jq '.codes | map(select(.status == "active")) | length')"
