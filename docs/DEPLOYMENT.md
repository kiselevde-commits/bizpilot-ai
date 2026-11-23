# Развёртывание BizPilot AI

## Обзор

Развёртывание через Docker Compose (PostgreSQL + приложение). n8n запускается отдельно под профилем `automation` (этап 4). CRM работает без n8n.

**Текущий статус:** конфигурация Compose, Dockerfile и healthchecks проверены
статически; локальный runtime **BLOCKED** — Docker в текущем окружении не
установлен. Сборка и запуск app + PostgreSQL проверяются в CI job `docker`
(`.github/workflows/ci.yml`); сам workflow на момент этапа 5 ещё не запускался.

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

AI (реальный провайдер по умолчанию; mock — только при явном разрешении):

- `AI_PROVIDER=openai-compatible`; `ALLOW_MOCK_AI=false`
- `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_TIMEOUT_MS=60000`
- `AI_PROVIDER=mock` допускается только вместе с `ALLOW_MOCK_AI=true` для разработки/тестов.

n8n / Telegram (этап 4; обязательны только для профиля `automation`):

- `N8N_WEBHOOK_URL` — адрес webhook n8n из контейнера app: `http://n8n:5678/webhook/lead-created`.
- `N8N_WEBHOOK_SECRET`, `N8N_CALLBACK_SECRET` — разные значения, ≥32 байта.
- `N8N_TIMEOUT_MS=10000`.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — для n8n credential/уведомлений.
- `N8N_PUBLIC_URL`, `N8N_HOST`, `N8N_TIMEZONE` — публичный URL/хост n8n.
- `BIZPILOT_BASE_URL` — адрес app из контейнера n8n (`http://app:3000`).
- `N8N_ENCRYPTION_KEY`, `N8N_BASIC_AUTH_USER`, `N8N_BASIC_AUTH_PASSWORD`.
- `N8N_DB_NAME`, `N8N_DB_USER`, `N8N_DB_PASSWORD`.
- `N8N_DEDUPE_DB_USER`, `N8N_DEDUPE_DB_PASSWORD`.
- `NODE_FUNCTION_ALLOW_BUILTIN=crypto` — для Code node HMAC.

## Запуск

```bash
# Сборка и запуск
docker compose up -d --build

# n8n (profile automation): n8n-db-init -> n8n
docker compose --env-file .env.docker --profile automation up -d

# Проверка здоровья
# app: http://localhost:3000/api/ai/health
# n8n: http://localhost:5678/healthz
# postgres: 127.0.0.1:5432

# Остановка
docker compose down
```

Миграции и seed выполняются сервисом `migrate` (`prisma migrate deploy` + `prisma db seed`) перед запуском `app`; повторный seed не создаёт дублей.

`n8n-db-init` под профилем `automation` идемпотентно создаёт роли `n8n_app`/`n8n_dedupe`, отдельную БД `n8n` и минимальные права на `n8n_processed`. Базовый `docker compose up` не требует n8n-секретов.

## Миграции и seed

```bash
# Локально (без Docker)
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed   # требует SEED_ADMIN_PASSWORD
```

Seed создаёт: 1 Workspace, 3 пользователя (ADMIN/MANAGER/OPERATOR), 10 контактов, 20 заявок `[DEMO]`, 15 задач, 2 интеграции (NOT_CONFIGURED). Идемпотентен (upsert).

## Демо-учётные записи

| Email               | Роль     | Пароль                |
| ------------------- | -------- | --------------------- |
| admin@demo.local    | ADMIN    | `SEED_ADMIN_PASSWORD` |
| manager@demo.local  | MANAGER  | `SEED_ADMIN_PASSWORD` |
| operator@demo.local | OPERATOR | `SEED_ADMIN_PASSWORD` |

## Healthcheck

- `GET /api/ai/health` — публичный, возвращает `{ status: "ok", configured }`; используется Docker healthcheck.
- n8n — `GET /healthz` на `127.0.0.1:5678`.
- Postgres: `pg_isready -U bizpilot -d bizpilot`.

## CI и Docker

- `.github/workflows/ci.yml` — push/PR: `lint`, `typecheck`, `unit`,
  `integration` (PostgreSQL service + `migrate deploy`), `build`, `docker`.
- `.github/workflows/e2e.yml` — `workflow_dispatch`: PostgreSQL
  `bizpilot_e2e_test`, migrations, seed, Playwright Chromium, artifacts; AI
  принудительно mock, `TEST_DATABASE_URL` совпадает с `DATABASE_URL`.
- Job `docker` создаёт временный `.env.docker` с тестовыми значениями,
  выполняет `docker compose config`, `build`, `up -d`, ждёт
  `http://localhost:3000/api/ai/health`, затем `down -v`. Секреты в workflow
  не используются; n8n-профиль в этом job не запускается.

Локальная проверка (когда Docker доступен):

```bash
cp .env.docker.example .env.docker
# заполните CHANGE_ME; для локальной проверки без реального AI:
# AI_PROVIDER=mock, ALLOW_MOCK_AI=true
docker compose --env-file .env.docker config
docker compose --env-file .env.docker up -d --build
curl -fsS http://localhost:3000/api/ai/health
docker compose --env-file .env.docker logs app
docker compose --env-file .env.docker down
```

Не используйте `down -v`, если хотите сохранить локальные данные.

## Ограничения

- Реальный n8n + Telegram runtime BLOCKED: нет credentials/Docker; workflow — draft.
- n8n 1.x EOL 2026-12-31; проверьте совместимость 2.x/3.x.
- Auth.js v5 только beta `5.0.0-beta.32`.
- `AI_PROVIDER=mock` запрещён в production без `ALLOW_MOCK_AI=true`.
- Rate limiting in-memory (не синхронизируется между инстансами).
- JWT без отзыва сессий.
- Outbox eventual; `SENT` без callback требует ручной сверки.
- POST `/api/webhooks/lead-created` отсутствует.
