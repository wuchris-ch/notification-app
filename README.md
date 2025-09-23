# Family Reminders

A family reminder scheduler with ntfy alerts and a beautiful shadcn UI.

## Quick Start

### Development Mode (Hot Reloading)
```bash
./dev.sh
```
- ✅ Instant UI changes without rebuilding
- ✅ Hot reloading enabled
- ✅ Perfect for UI development

### Production Mode
```bash
./prod.sh
```
- ✅ Optimized build
- ✅ Production-ready deployment

### Stop All Services
```bash
./stop.sh
```

## Access
- **Web Interface**: http://192.168.1.185:8080
- **Development**: Use `./dev.sh` for fast UI iteration
- **Production**: Use `./prod.sh` for final testing/deployment

## Development Workflow

1. Start development: `./dev.sh`
2. Make UI changes in `web/` directory
3. Changes appear instantly in browser
4. No need to rebuild containers!

## Project Structure
```
├── web/                 # Next.js frontend
├── api/                 # FastAPI backend
├── docker-compose.yml   # Production config
├── docker-compose.dev.yml # Development config
├── dev.sh              # Start development
├── prod.sh             # Start production
└── stop.sh             # Stop all services
```

## Features
- 🏠 Beautiful shadcn UI components
- ⚡ Hot reloading for fast development
- 🔔 ntfy notification integration
- 🐳 Docker containerized
- 📱 Responsive design