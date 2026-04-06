## Laravel + MySQL Backend Setup

This project backend runs on Laravel with MySQL in Docker.

### Start services

From `backend/`:

```bash
docker compose up -d
```

### Run migrations

```bash
docker compose exec laravel.test php artisan migrate
```

### Run tests

```bash
docker compose exec laravel.test php artisan test
```

### Stop services

```bash
docker compose down
```
