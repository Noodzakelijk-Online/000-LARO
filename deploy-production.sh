#!/bin/bash

# Production Deployment Script for Legal AI Reach Out Platform
# This script sets up and deploys the production-ready version of the platform

# Exit on error
set -e

# Configuration
APP_NAME="legal-ai-platform"
APP_DIR="/opt/$APP_NAME"
LOG_DIR="/var/log/$APP_NAME"
NODE_VERSION="16.x"
MONGODB_VERSION="5.0"

# Print header
echo "=========================================="
echo "Legal AI Reach Out Platform - Production Deployment"
echo "=========================================="

# Check if running as root
if [ "$(id -u)" != "0" ]; then
   echo "This script must be run as root" 1>&2
   exit 1
fi

# Create directories
echo "Creating application directories..."
mkdir -p $APP_DIR
mkdir -p $LOG_DIR
mkdir -p $APP_DIR/frontend
mkdir -p $APP_DIR/logs
mkdir -p $APP_DIR/data

# Install dependencies
echo "Installing system dependencies..."
apt-get update
apt-get install -y curl wget gnupg build-essential nginx

# Install Node.js
echo "Installing Node.js $NODE_VERSION..."
curl -fsSL https://deb.nodesource.com/setup_$NODE_VERSION | bash -
apt-get install -y nodejs

# Install MongoDB
echo "Installing MongoDB $MONGODB_VERSION..."
wget -qO - https://www.mongodb.org/static/pgp/server-$MONGODB_VERSION.asc | apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/$MONGODB_VERSION multiverse" | tee /etc/apt/sources.list.d/mongodb-org-$MONGODB_VERSION.list
apt-get update
apt-get install -y mongodb-org

# Start MongoDB
echo "Starting MongoDB service..."
systemctl start mongod
systemctl enable mongod

# Copy application files
echo "Copying application files..."
cp -r . $APP_DIR/

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
cd $APP_DIR
npm install
npm install pm2 -g

# Set up environment variables
echo "Setting up environment variables..."
cat > $APP_DIR/.env << EOF
NODE_ENV=production
PORT=8080
MONGODB_URI=mongodb://localhost:27017/legal_ai_platform
JWT_SECRET=$(openssl rand -hex 32)
EOF

# Set up Nginx
echo "Configuring Nginx..."
cat > /etc/nginx/sites-available/$APP_NAME << EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
    
    # Enable gzip compression
    gzip on;
    gzip_comp_level 5;
    gzip_min_length 256;
    gzip_proxied any;
    gzip_vary on;
    gzip_types
        application/javascript
        application/json
        application/x-javascript
        application/xml
        application/xml+rss
        image/svg+xml
        text/css
        text/javascript
        text/plain
        text/xml;
    
    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg)$ {
        proxy_pass http://localhost:8080;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Restart Nginx
systemctl restart nginx
systemctl enable nginx

# Set up PM2 for process management
echo "Setting up PM2 process manager..."
cd $APP_DIR
pm2 start server-side-rendering.js --name $APP_NAME
pm2 save
pm2 startup

# Set up log rotation
echo "Setting up log rotation..."
cat > /etc/logrotate.d/$APP_NAME << EOF
$LOG_DIR/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 \`cat /var/run/nginx.pid\`
    endscript
}
EOF

# Set proper permissions
echo "Setting proper permissions..."
chown -R www-data:www-data $APP_DIR
chmod -R 755 $APP_DIR

# Run tests
echo "Running tests..."
cd $APP_DIR
NODE_ENV=test npm test

# Final message
echo "=========================================="
echo "Deployment completed successfully!"
echo "The Legal AI Reach Out Platform is now running at:"
echo "http://$(hostname -I | awk '{print $1}')"
echo ""
echo "To monitor the application:"
echo "pm2 status"
echo ""
echo "To view logs:"
echo "pm2 logs $APP_NAME"
echo "=========================================="
