#!/bin/bash
set -e

SETUP_TOKEN="$1"
API_URL="${2:-http://localhost:5000}"

echo "===================================================="
echo "   PULSEOPS TELEMETRY AGENT - INSTALLER"
echo "===================================================="

if [ -z "$SETUP_TOKEN" ]; then
  echo "[-] Error: Setup token is required."
  exit 1
fi

HOSTNAME=$(hostname)
IP_ADDR=$(hostname -I | awk '{print $1}')
echo "--> Gathering host metadata... [$HOSTNAME / $IP_ADDR]"

# Register Agent
RESPONSE=$(curl -sSL -X POST "$API_URL/api/register" \
  -H "Content-Type: application/json" \
  -d "{\"setupToken\": \"$SETUP_TOKEN\", \"hostname\": \"$HOSTNAME\", \"ipAddress\": \"$IP_ADDR\"}")

echo "--> Server response: $RESPONSE"

AGENT_ID=$(echo "$RESPONSE" | grep -o '"agentId":"[^"]*' | cut -d'"' -f4)
AGENT_TOKEN=$(echo "$RESPONSE" | grep -o '"agentToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$AGENT_ID" ] || [ -z "$AGENT_TOKEN" ]; then
  echo "[-] Registration failed. Please check token or backend logs."
  exit 1
fi

echo "[+] Registered successfully! Node: $AGENT_ID"

sudo mkdir -p /opt/pulseops
sudo curl -sSL "$API_URL/collector.sh" -o /opt/pulseops/collector.sh
sudo chmod +x /opt/pulseops/collector.sh

# Write environment configuration
cat <<EOF | sudo tee /opt/pulseops/agent.env > /dev/null
AGENT_ID=$AGENT_ID
AGENT_TOKEN=$AGENT_TOKEN
API_URL=$API_URL
EOF

# Setup systemd service
cat <<EOF | sudo tee /etc/systemd/system/pulseops-agent.service > /dev/null
[Unit]
Description=PulseOps Telemetry Agent
After=network.target

[Service]
Type=simple
EnvironmentFile=/opt/pulseops/agent.env
ExecStart=/opt/pulseops/collector.sh
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Start service
sudo systemctl daemon-reload
sudo systemctl enable --now pulseops-agent.service

echo "[✓] PulseOps agent daemon installed and running."
