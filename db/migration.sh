#!/bin/bash

apt-get update && apt-get install -y \
    postgresql-client \
    jq &&
    apt-get clean &&
    rm -rf /var/lib/apt/lists/*

CONFIG_FILE="${1:-./config.json}"

echo -e "\n📄 Using config file: $CONFIG_FILE"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Config file not found"
    exit 1
fi

# Validate and parse JSON using jq
if ! jq empty "$CONFIG_FILE" >/dev/null 2>&1; then
    echo "❌ Invalid JSON file"
    exit 1
fi

# Extract database connection details
DB_HOST=$(jq -r '.db_host // "localhost"' "$CONFIG_FILE")
DB_NAME=$(jq -r '.db_name' "$CONFIG_FILE")
DB_PORT=$(jq -r '.db_port // "5432"' "$CONFIG_FILE")
DB_USER=$(jq -r '.db_user' "$CONFIG_FILE")
DB_PASSWORD=$(jq -r '.db_password // ""' "$CONFIG_FILE")

# Construct DATABASE_URL
export DATABASE_URL="postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=disable"

# Check if Diesel CLI is installed
if ! command -v diesel &>/dev/null; then
    echo "🔧 Diesel CLI not found. Installing..."
    cargo install diesel_cli --no-default-features --features postgres
fi

# Check if .env file exists, create if not
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    echo "DATABASE_URL=${DATABASE_URL}" >.env
fi

# # Perform Diesel migrations
# echo "🔄 Running Diesel migrations..."
# diesel migration run --migration-dir ./migrations

# Add debug output for connection details
echo -e "\n📊 Database Connection Details:"
echo "  🏠 Host: $DB_HOST"
echo "  🔌 Port: $DB_PORT"
echo "  💾 Database: $DB_NAME"
echo "  👤 User: $DB_USER"

validate_input() {
    local chain_id="$1"
    local block_number="$2"
    local block_hash="$3"
    # Basic validation
    if [[ ! "$chain_id" =~ ^[0-9]+$ ]]; then
        echo "❌ Invalid chain ID: $chain_id"
        return 1
    fi
    if [[ ! "$block_number" =~ ^[0-9]+$ ]]; then
        echo "❌ Invalid block number: $block_number"
        return 1
    fi
    if [[ -z "$block_hash" ]]; then
        echo "❌ Block hash cannot be empty"
        return 1
    fi
    return 0
}

# Prepare psql connection command with additional parameters
PSQL_CMD="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"

echo "PSQL_CMD: $PSQL_CMD"
# Add password if provided
if [[ -n "$DB_PASSWORD" ]]; then
    export PGPASSWORD="$DB_PASSWORD"
fi

# Test database connection
if ! $PSQL_CMD -c "SELECT 1" >/dev/null 2>&1; then
    echo -e "\n❌ Failed to connect to the database."
    echo "Please check:"
    echo "1. 🟢 PostgreSQL is running"
    echo "2. 🔑 Connection details are correct"
    echo "3. 🔒 User has proper permissions"
    exit 1
fi

echo -e "\n🔄 Processing block entries..."

# Process block entries
jq -c '.block_entries[] | select(.chain_id and .block_number and .block_hash)' "$CONFIG_FILE" | while read -r entry; do
    chain_id=$(echo "$entry" | jq -r '.chain_id')
    block_number=$(echo "$entry" | jq -r '.block_number')
    block_hash=$(echo "$entry" | jq -r '.block_hash')

    # Validate inputs
    if validate_input "$chain_id" "$block_number" "$block_hash"; then
        # Insert into database with error handling
        if ! $PSQL_CMD -c \
            "INSERT INTO indexer_block_numbers (chain_id, block_number, block_hash) 
             VALUES ($chain_id, $block_number, '$block_hash');" 2>&1; then
            echo "❌ Failed to insert entry: $entry"
        else
            echo "✅ Successfully inserted block entry for chain $chain_id"
        fi
    else
        echo "⚠️  Skipping invalid entry: $entry"
    fi
done

echo "✅ Block entries processing completed"

unset PGPASSWORD
echo -e "\n🎉 Script completed successfully!"
