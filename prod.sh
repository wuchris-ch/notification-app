#!/bin/bash

echo "🏭 Starting Family Reminders in PRODUCTION mode..."
echo "   - Optimized build"
echo "   - No hot reloading"
echo "   - Access at: http://192.168.1.185:8080"
echo ""

docker-compose up --build -d

echo ""
echo "✅ Production environment started!"
echo "   Use this for final testing and deployment"
echo ""
echo "To stop: ./stop.sh"