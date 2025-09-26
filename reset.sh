#!/bin/bash

echo "🔄 Full Reset - Family Reminders..."
echo "   - Stopping all containers"
echo "   - Rebuilding all images"
echo "   - Starting fresh in production mode"
echo "   - Access at: http://192.168.1.185:8080"
echo ""

# Stop everything
echo "Stopping containers..."
docker-compose down

# Rebuild all services
echo "Rebuilding all images..."
docker-compose build

# Start fresh
echo "Starting fresh containers..."
docker-compose up -d

echo ""
echo "✅ Full reset complete!"
echo "   All containers rebuilt and started fresh"
echo ""
echo "Commands:"
echo "  Stop:        ./stop.sh"
echo "  Development: ./dev.sh"
echo "  Full reset:  ./reset.sh"