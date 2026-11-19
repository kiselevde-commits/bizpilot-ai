# Развёртывание BizPilot AI

## Обзор

Развёртывание через Docker Compose (PostgreSQL + приложение). n8n запускается отдельно под профилем `automation` (этап 4). CRM работает без n8n.

## Требования

- Docker Desktop + WSL2 (Windows) или Docker Engine (Linux).
- Node.js 24.20.0 + pnpm 9.15.9 (для локальной разработки без Docker).
- 8 ГБ RAM минимум (рекомендуется 16 ГБ при одновременном запуске n8n).

## Ресурсы (WSL2, 8 ГБ хост)

Создайте `%USERPROFILE%\.wslconfig` (см. `docker/wsl2.conf`) и выполните `wsl --shutdown`:

```
[wsl2]
memory=4GB
processors=2
swap=2GB
localhostForwarding=true
```

Compose-лимиты: postgres 512 MB, app 1 GB, n8n 512 MB.

## Переменные окружения

Создайте `.env` по шаблону `.env.example`. Секреты не коммитить.

Обязательные:
- `DATABASE_URL` — строка подключения PostgreSQL.
- `SHADOW_DATABASE_URL` — отдельная пустая база для Prisma shadow database (`prisma migrate dev`). В Docker она создаётся скриптом `docker/postgres/init/01-create-shadow.sql` при первой инициализации тома; для локального PostgreSQL создайте `bizpilot_shadow` вручную.
- `AUTH_SECRET` — секрет Auth.js (минимум 32 символа).
- `SEED_ADMIN_PASSWORD` — пароль для всех трёх демо-пользователей (обязателен, без значения по умолчанию).

AI (по умолчанию mock; только для разработки/тестов):
- `AI_PROVIDER=mock` / `ALLOW_MOCK_AI=true`
- `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_TIMEOUT_MS=60000`

n8n / Telegram (этап 4; пустые до настройки):
- `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`, `N8N_CALLBACK_SECRET`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

## Запуск

```bash
# Сборка и запуск
docker compose up -d --build

# Проверка здоровья
# app: http://localhost:3000/api/ai/health
# postgres: 127.0.0.1:5432

# Остановка
docker compose down
```

Миграции применяются сервисом `migrate` (`prisma migrate deploy`) перед запуском `app`.

## Миграции и seed

```bash
# Локально (без Docker)
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed   # требует SEED_ADMIN_PASSWORD
```

Seed создаёт: 1 Workspace, 3 пользователя (ADMIN/MANAGER/OPERATOR), 10 контактов, 20 заявок `[DEMO]`, 15 задач, 2 интеграции (NOT_CONFIGURED). Идемпотентен (upsert).

## Демо-учётные записи

| Email | Роль | Пароль |
|---|---|---|
| admin@demo.local | ADMIN | `SEED_ADMIN_PASSWORD` |
| manager@demo.local | MANAGER | `SEED_ADMIN_PASSWORD` |
| operator@demo.local | OPERATOR | `SEED_ADMIN_PASSWORD` |

## Healthcheck

- `GET /api/ai/health` — публичный, возвращает `{ status: "ok" }`; используется Docker healthcheck.
- Postgres: `pg_isready -U bizpilot -d bizpilot`.

## Ограничения

- n8n 1.x EOL 2026-12-31; проверьте совместимость 2.x/3.x перед этапом 4.
- Auth.js v5 только beta `5.0.0-beta.32`.
- `AI_PROVIDER=mock` запрещён в production без `ALLOW_MOCK_AI=true`.
- Rate limiting in-memory (не синхронизируется между инстансами).
- JWT без отзыва сессий.
- POST `/api/webhooks/lead-created` отсутствует.
