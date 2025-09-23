# Family Reminders

A complete multi-user family reminder system with cron-based scheduling, ntfy push notifications, and a clean web interface. Built with FastAPI (Python), Next.js (TypeScript), PostgreSQL, and Docker Compose.

## Features

- **Multi-user support**: Create family members with individual ntfy topics and timezones
- **Complete CRUD operations**: Create, read, update, and delete users and reminders
- **Flexible scheduling**: Daily, weekdays, weekly, monthly, yearly, or custom cron expressions
- **Timezone-aware**: Each user's reminders are sent in their local timezone
- **Push notifications**: Uses ntfy for reliable cross-platform notifications
- **Delivery logs**: Track when reminders were sent and view delivery status
- **Clean web interface**: Modern, responsive UI built with Next.js and Tailwind CSS
- **Production-ready**: Dockerized with reverse proxy, automatic database migrations

## Architecture

- **proxy**: Caddy reverse proxy (port 80)
  - Routes `/` → Next.js frontend
  - Routes `/api/*` → FastAPI backend
  - Routes `/push/*` → ntfy server
- **web**: Next.js 14 frontend with Tailwind CSS
- **api**: FastAPI backend with SQLAlchemy + PostgreSQL
- **scheduler**: APScheduler service for cron-based reminder delivery
- **db**: PostgreSQL 16 with persistent storage
- **ntfy**: ntfy server for push notifications

## Prerequisites

- Docker and Docker Compose
- At least 2GB RAM and 5GB disk space
- Network access to `192.168.1.185` (or your chosen domain/IP)

## Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd ntfy-family

# Copy and customize environment variables
cp .env.example .env
nano .env  # Edit DOMAIN, passwords, etc.
```

### 2. Build and Start

```bash
# Build and start all services
docker compose up -d

# Check that all services are running
docker compose ps
```

Expected output:
```
NAME                          COMMAND                  SERVICE      STATUS
ntfy-family-api-1            "uvicorn app.main:ap…"   api          running
ntfy-family-db-1             "docker-entrypoint.s…"   db           running
ntfy-family-ntfy-1           "ntfy serve --listen…"   ntfy         running
ntfy-family-proxy-1          "caddy run --config …"   proxy        running
ntfy-family-scheduler-1      "python scheduler_ma…"   scheduler    running
ntfy-family-web-1            "docker-entrypoint.s…"   web          running
```

### 3. Access the Application

- **Web Interface**: http://192.168.1.185/
- **API Documentation**: http://192.168.1.185/docs
- **Health Check**: http://192.168.1.185/api/health

## Smoke Test

Follow these steps to verify everything works:

### 1. Create a User

1. Visit http://192.168.1.185/users
2. Add a new family member:
   - Name: `Alex`
   - Topic: `family-alex`
   - Timezone: `America/Vancouver`

### 2. Subscribe to Notifications

Choose one option:

**Option A - Browser (recommended for testing)**:
1. Open http://192.168.1.185/push/family-alex
2. Click "Subscribe" and allow notifications in your browser

**Option B - Mobile App**:
1. Install ntfy app on your phone
2. Add subscription: `http://192.168.1.185/push/family-alex`

### 3. Create a Test Reminder

1. Visit http://192.168.1.185/new
2. Create a reminder:
   - User: `Alex`
   - Title: `Test Reminder`
   - Body: `This is a test notification`
   - Schedule: `Custom` with cron `*/2 * * * *` (every 2 minutes)
3. Click "Save reminder"

### 4. Verify Delivery

- Within 2-3 minutes, you should receive a notification
- Check scheduler logs: `docker compose logs scheduler`
- View delivery logs in the web interface at http://192.168.1.185/reminders

### 5. Test Daily Reminder

Create a daily reminder at 6:00 PM:
- Cron: `0 18 * * *`
- The scheduler will show next run time in logs

## Configuration

### Environment Variables

Key variables in `.env`:

```bash
# Change to your server's IP or domain
DOMAIN=192.168.1.185
PUBLIC_BASE_URL=http://192.168.1.185

# Database credentials (use strong passwords in production)
POSTGRES_PASSWORD=your_secure_password
DATABASE_URL=postgresql+psycopg://reminders:your_secure_password@db:5432/reminders

# Timezone (affects default user timezone)
TZ=America/Vancouver
```

### Timezone Support

- Each user can have their own timezone (IANA timezone names)
- Reminders are sent at the correct local time accounting for DST
- Default timezone is `America/Vancouver`
- Examples: `Europe/London`, `Asia/Tokyo`, `Australia/Sydney`

### Cron Expressions

Format: `minute hour day month day-of-week`

Examples:
- `0 9 * * *` - Daily at 9:00 AM
- `30 7 * * 1-5` - Weekdays at 7:30 AM
- `0 18 * * 0` - Sundays at 6:00 PM
- `0 10 1 * *` - First day of each month at 10:00 AM
- `0 12 25 12 *` - Christmas Day at noon

## Usage Guide

### Managing Users

- **Create**: Add family members with unique names and ntfy topics
- **Edit**: Update user details, topics, or timezones
- **Delete**: Remove users (also deletes their reminders and logs)

### Managing Reminders

- **Create**: Use the web form or API endpoints
- **View**: See all reminders with filtering by user
- **Edit**: Modify any aspect including schedule and enabled status
- **Enable/Disable**: Toggle reminders without deleting them
- **Delete**: Remove reminders (also deletes delivery logs)

### Viewing Logs

- Access delivery logs through the reminders management page
- Each log shows timestamp, status (sent/error), and details
- Useful for troubleshooting notification delivery

## API Reference

Base URL: `http://192.168.1.185/api`

### Users

- `GET /users` - List all users
- `POST /users` - Create user
- `GET /users/{id}` - Get specific user
- `PUT /users/{id}` - Update user
- `DELETE /users/{id}` - Delete user

### Reminders

- `GET /reminders` - List reminders (optional `?user_id=N`)
- `POST /reminders` - Create reminder
- `GET /reminders/{id}` - Get specific reminder
- `PUT /reminders/{id}` - Update reminder
- `DELETE /reminders/{id}` - Delete reminder

### Logs

- `GET /logs` - List delivery logs (optional `?reminder_id=N&limit=50`)

### Testing

- `POST /notifications/test` - Send test notification

Complete API documentation: http://192.168.1.185/docs

## Troubleshooting

### Services Won't Start

```bash
# Check service status
docker compose ps

# View logs for specific service
docker compose logs api
docker compose logs scheduler
docker compose logs db

# Restart specific service
docker compose restart api
```

### Database Connection Issues

```bash
# Check database logs
docker compose logs db

# Verify database is accessible
docker compose exec db psql -U reminders -d reminders -c "SELECT 1;"

# Reset database (WARNING: deletes all data)
docker compose down -v
docker compose up -d
```

### Notifications Not Working

1. **Check ntfy service**: 
   ```bash
   docker compose logs ntfy
   curl http://192.168.1.185/push/test -d "test message"
   ```

2. **Check scheduler logs**:
   ```bash
   docker compose logs scheduler
   ```

3. **Verify user topic subscription**:
   - Visit `http://192.168.1.185/push/{topic}`
   - Ensure notifications are enabled in browser/app

4. **Test notification manually**:
   - Use "Send test now" button in reminder creation form
   - Check delivery logs in reminders management

### "Fail to fetch" Errors

1. **Check API health**: http://192.168.1.185/api/health
2. **Verify environment variables**:
   ```bash
   grep NEXT_PUBLIC_API_BASE .env
   # Should show: NEXT_PUBLIC_API_BASE=/api
   ```
3. **Restart web service**:
   ```bash
   docker compose restart web
   ```

### Scheduler Not Picking Up Reminders

1. **Check scheduler logs** for registration cycles:
   ```bash
   docker compose logs scheduler | grep -i "register"
   ```

2. **Verify database connectivity**:
   ```bash
   docker compose logs scheduler | grep -i "error"
   ```

3. **Restart scheduler**:
   ```bash
   docker compose restart scheduler
   ```

## Development

### Local Development

```bash
# API development
cd api
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend development
cd web
npm install
npm run dev
```

### Adding Features

- **Authentication**: JWT tokens are supported (set JWT_SECRET)
- **Email notifications**: Extend ntfy.py to support email gateways
- **Mobile app**: Use the API endpoints to build native apps
- **Advanced scheduling**: Add support for recurring patterns beyond cron

## Production Deployment

### Security Considerations

1. **Change default passwords** in `.env`
2. **Use HTTPS** with real domain names
3. **Enable authentication** for multi-tenant use
4. **Restrict database access** (remove exposed port 5432)
5. **Regular backups** of PostgreSQL data

### Domain Setup

To use a real domain with HTTPS:

1. **Update `.env`**:
   ```bash
   DOMAIN=yourdomain.com
   PUBLIC_BASE_URL=https://yourdomain.com
   ```

2. **Update Caddyfile**:
   ```
   yourdomain.com {
     # Caddy automatically handles HTTPS
     # ... rest of config stays the same
   }
   ```

### Backup and Restore

```bash
# Backup database
docker compose exec db pg_dump -U reminders reminders > backup.sql

# Restore database
docker compose exec -T db psql -U reminders reminders < backup.sql

# Backup all volumes
docker run --rm -v ntfy-family_db-data:/data -v $(pwd):/backup alpine tar czf /backup/db-backup.tar.gz -C /data .
```

## Support

- Check logs: `docker compose logs [service-name]`
- API documentation: http://192.168.1.185/docs
- Verify health: http://192.168.1.185/api/health

## License

This project is provided as-is for family use. Modify and distribute freely.