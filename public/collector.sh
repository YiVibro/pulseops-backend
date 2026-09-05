#!/bin/sh

# Load environment variables if available
if [ -f /etc/pulseops-agent/agent.env ]; then
  . /etc/pulseops-agent/agent.env
fi

BACKEND_URL=${BACKEND_URL:-"http://localhost:5000/api/metrics"}
AGENT_TOKEN=${AGENT_TOKEN:-""}
SERVER_ID=${SERVER_ID:-"unknown-server"}
POLL_INTERVAL=${POLL_INTERVAL_MS:-2000}

SLEEP_SEC=$((POLL_INTERVAL / 1000))
[ "$SLEEP_SEC" -le 0 ] && SLEEP_SEC=2

echo "[PULSEOPS AGENT] Native Shell Daemon started for Node: ${SERVER_ID}"

while true; do
  # 1. CPU Usage Calculation via /proc/stat delta
  STAT1=$(head -n 1 /proc/stat)
  sleep 0.2
  STAT2=$(head -n 1 /proc/stat)

  IDLE1=$(echo "$STAT1" | awk '{print $5+$6}')
  TOTAL1=$(echo "$STAT1" | awk '{print $2+$3+$4+$5+$6+$7+$8}')

  IDLE2=$(echo "$STAT2" | awk '{print $5+$6}')
  TOTAL2=$(echo "$STAT2" | awk '{print $2+$3+$4+$5+$6+$7+$8}')

  TOTAL_DIFF=$((TOTAL2 - TOTAL1))
  IDLE_DIFF=$((IDLE2 - IDLE1))

  if [ "$TOTAL_DIFF" -gt 0 ]; then
    CPU_USAGE=$((100 * (TOTAL_DIFF - IDLE_DIFF) / TOTAL_DIFF))
  else
    CPU_USAGE=0
  fi

  # 2. Memory Usage Calculation via /proc/meminfo
  MEM_TOTAL=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
  MEM_AVAIL=$(awk '/MemAvailable/ {print $2}' /proc/meminfo)
  MEM_USED=$((MEM_TOTAL - MEM_AVAIL))
  
  if [ "$MEM_TOTAL" -gt 0 ]; then
    MEM_USAGE=$((100 * MEM_USED / MEM_TOTAL))
  else
    MEM_USAGE=0
  fi

  # 3. Disk Usage Calculation via df
  DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
  [ -z "$DISK_USAGE" ] && DISK_USAGE=0

  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  PAYLOAD="{\"serverId\":\"${SERVER_ID}\",\"agentToken\":\"${AGENT_TOKEN}\",\"metrics\":[{\"serverId\":\"${SERVER_ID}\",\"timestamp\":\"${TIMESTAMP}\",\"cpu\":${CPU_USAGE},\"memory\":${MEM_USAGE},\"disk\":${DISK_USAGE}}]}"

  # Post telemetry payload to Express backend
  curl -s -X POST "${BACKEND_URL}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${AGENT_TOKEN}" \
    -d "${PAYLOAD}" >/dev/null 2>&1 || true

  sleep "$SLEEP_SEC"
done
