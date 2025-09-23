#!/bin/bash

echo "🛑 Stopping Family Reminders..."
echo ""

docker-compose down

echo ""
echo "✅ All containers stopped!"
echo ""
echo "To restart:"
echo "  Development: ./dev.sh"
echo "  Production:  ./prod.sh"