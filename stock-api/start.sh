#!/bin/sh
# Start the Node.js API server in the background
node src/server.js &
NODE_PID=$!

# Wait for the server to be ready
echo -e "\n\033[1;34m[Docker] Starting API server and waiting 3 seconds before testing...\033[0m"
sleep 3

# Run the test suite with the internal container URL
echo -e "\033[1;33m[Docker] Running API Test Suite...\033[0m"
export BASE_URL="http://localhost:3000/api"
bash test.sh

echo -e "\n\033[1;32m[Docker] Tests completed. Logs from API server will follow below:\033[0m\n"

# Bring the node process back to the foreground so the container stays alive and responds to signals
wait $NODE_PID
