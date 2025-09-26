#!/bin/bash

echo "🛑 Stopping Family Reminders..."
echo ""

docker-compose down

echo ""
echo "✅ All containers stopped!"
echo ""
echo "Commands:"
echo "  Development: ./dev.sh"
echo "  Full reset:  ./reset.sh"
echo "  Stop:        ./stop.sh"