#!/bin/bash

echo "🚀 Starting Family Reminders in DEVELOPMENT mode..."
echo "   - Hot reloading enabled"
echo "   - Volume mounting for instant UI changes"
echo "   - Access at: http://192.168.1.185:8080"
echo ""

# Stop any existing containers first
docker-compose down

# Start in development mode
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

echo ""
echo "✅ Development environment started!"
echo "   Make UI changes and they'll appear instantly!"
echo ""
echo "Commands:"
echo "  Stop:        ./stop.sh"
echo "  Full reset:  ./reset.sh"
echo "  Restart dev: ./dev.sh"