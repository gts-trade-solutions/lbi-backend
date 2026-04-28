# Tracker Next.js Backend (MySQL)

This backend replaces Supabase services with Next.js App Router APIs backed by MySQL.

## Environment

Create `.env.local` in `backend-next/`:

```
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=tracker
AUTH_JWT_SECRET=replace_with_long_secret
AUTH_JWT_EXPIRES_SEC=604800
BACKEND_PUBLIC_BASE_URL=http://192.168.1.7:3000
AWS_REGION=ap-south-1
AWS_S3_BUCKET=your-bucket
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret
# optional
AWS_SESSION_TOKEN=
AWS_S3_ENDPOINT=
AWS_S3_FORCE_PATH_STYLE=false
AWS_S3_PUBLIC_BASE_URL=
STORAGE_BUCKETS=reports,templates
```

## Setup (Schema First, Then Data Conversion)

1. Install dependencies: `npm install`
2. Create schema first: run `npm run db:init`
3. Then run conversion/import script from Supabase dump: `npm run import:backup -- ../../backup.sql`
4. Verify imported row counts: `npm run verify:counts -- ../../backup.sql`
5. Start: `npm run dev`

Only existing app tables are created/imported:

- `app_auth_users`
- `app_users`
- `profiles`
- `projects`
- `routes`
- `route_points`
- `reports`
- `report_photos`
- `report_path_points`

## API Endpoints

- `POST /api/auth/login`
- `GET /api/auth/session`
- `POST /api/auth/logout`
- `POST /api/db/query`
- `POST /api/storage/upload`
- `GET /api/storage/buckets`
- `GET /api/storage/signed`
- `GET /api/storage/public/[bucket]/[...path]`
- `POST /api/functions/report-docx`
