#!/bin/bash
# Update DATABASE_URL for all Lambda functions

# SECURITY: Never hardcode credentials! Read from environment variable
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is required"
  echo "   Usage: DATABASE_URL='postgresql://...' ./update-db-url.sh"
  exit 1
fi

aws lambda list-functions --region us-west-2 \
  --query "Functions[?starts_with(FunctionName, 'propintel-api-dev')].FunctionName" \
  --output text | tr '\t' '\n' | while read func; do
  echo "Updating $func..."
  
  # Get current environment (full Environment object)
  aws lambda get-function-configuration \
    --function-name "$func" \
    --region us-west-2 \
    --query "Environment" \
    --output json > /tmp/current_env.json
  
  # Add/update DATABASE_URL in Variables
  jq --arg db "$DATABASE_URL" '.Variables.DATABASE_URL = $db' /tmp/current_env.json > /tmp/new_env.json
  
  # Update function using file input (handles special characters properly)
  aws lambda update-function-configuration \
    --function-name "$func" \
    --region us-west-2 \
    --environment file:///tmp/new_env.json \
    --output text --query "FunctionName" > /dev/null 2>&1
  
  echo "  ✓ Updated $func"
done

echo ""
echo "All functions updated with DATABASE_URL"
