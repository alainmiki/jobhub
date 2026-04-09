# JobHub Deployment Guide

This guide describes recommended deployment paths for JobHub, including Docker and production server setup.

## 1. Docker Deployment

### Prerequisites
- Docker
- Docker Compose
- `.env` configured with production values

### Start the stack
```bash
docker compose up -d
```

### Verify
- Application: http://localhost:3000
- MongoDB: mongodb://localhost:27017/jobhub

### Stop the stack
```bash
docker compose down
```

### Notes
- The Docker Compose stack uses the root project directory mounted into the container.
- `mongo_data` is persisted in a named Docker volume.
- Use `app` service logs for troubleshooting:
```bash
docker compose logs -f app
```

## 2. Production Deployment

### Build the application
```bash
npm install
npm run build
```

### Environment
Set the following variables for production:
```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://mongo:27017/jobhub
SESSION_SECRET=your-production-session-secret
BETTER_AUTH_SECRET=your-better-auth-secret
BETTER_AUTH_URL=https://your-domain.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=JobHub <noreply@your-domain.com>
```

### Running
```bash
npm start
```

### Process Management
Use a process manager such as PM2:
```bash
npm install -g pm2
pm2 start npm --name jobhub -- start
pm2 save
```

## 3. Reverse Proxy and SSL

### Nginx Example
```nginx
server {
  listen 80;
  server_name your-domain.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

### SSL
- Use Let's Encrypt for free certificates
- Renew certificates automatically with Certbot

## 4. Environment and Monitoring

### Environment
- Ensure `SESSION_SECRET` is strong and unique
- Set `NODE_ENV=production`
- Use secure, private SMTP credentials

### Monitoring
- Configure log rotation for app logs
- Use a monitoring tool such as Grafana, Prometheus, or a hosted service
- Monitor MongoDB and application uptime

## 5. Backup

### MongoDB Backup
```bash
mongodump --uri="${MONGODB_URI}" --out=/path/to/backup"
```

### Restore
```bash
mongorestore --uri="${MONGODB_URI}" /path/to/backup"
```
