#!/bin/bash
# Disease.Zone Countdown Deployment Script
# Deploys countdown landing page to OCI server

set -e

# Configuration
SERVER="129.153.158.177"
USER="opc"
REMOTE_PATH="/srv/disease-zone"
CADDY_CONFIG="/etc/caddy/Caddyfile"
LOCAL_COUNTDOWN="../countdown"
LOCAL_CADDYFILE="./Caddyfile.disease-zone"

echo "=========================================="
echo "  Disease.Zone Countdown Deployment"
echo "=========================================="
echo ""

# Check if we can connect
echo "[1/5] Testing SSH connection..."
ssh -o ConnectTimeout=5 ${USER}@${SERVER} "echo 'Connected successfully'" || {
    echo "ERROR: Cannot connect to ${SERVER}"
    exit 1
}

# Create remote directory
echo "[2/5] Creating remote directories..."
ssh ${USER}@${SERVER} "sudo mkdir -p ${REMOTE_PATH}/countdown && sudo mkdir -p /var/log/caddy"

# Copy countdown files
echo "[3/5] Copying countdown files..."
scp -r ${LOCAL_COUNTDOWN}/* ${USER}@${SERVER}:/tmp/disease-zone-countdown/
ssh ${USER}@${SERVER} "sudo cp -r /tmp/disease-zone-countdown/* ${REMOTE_PATH}/countdown/ && rm -rf /tmp/disease-zone-countdown"

# Set permissions
echo "[4/5] Setting permissions..."
ssh ${USER}@${SERVER} "sudo chown -R caddy:caddy ${REMOTE_PATH} && sudo chmod -R 755 ${REMOTE_PATH}"

# Update Caddy config
echo "[5/5] Updating Caddy configuration..."
echo ""
echo "IMPORTANT: You need to manually add the Caddyfile entries."
echo ""
echo "Run these commands on the server:"
echo "  1. SSH to server: ssh ${USER}@${SERVER}"
echo "  2. Edit Caddyfile: sudo nano ${CADDY_CONFIG}"
echo "  3. Add contents from: Caddyfile.disease-zone"
echo "  4. Reload Caddy: sudo systemctl reload caddy"
echo ""
echo "Or copy the Caddyfile and merge manually:"
scp ${LOCAL_CADDYFILE} ${USER}@${SERVER}:/tmp/

echo ""
echo "=========================================="
echo "  Countdown files deployed!"
echo "=========================================="
echo ""
echo "Files location: ${REMOTE_PATH}/countdown/"
echo ""
echo "Next steps:"
echo "  1. SSH to ${SERVER}"
echo "  2. Add Caddyfile entries from /tmp/Caddyfile.disease-zone"
echo "  3. Reload Caddy: sudo systemctl reload caddy"
echo "  4. Test: curl https://disease.zone"
echo ""
