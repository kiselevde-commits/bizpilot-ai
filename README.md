# BizPilot AI

Демонстрационная SaaS-платформа управления заявками (Leads), контактами (Contacts), задачами (Tasks) и бизнес-процессами с использованием реального LLM и n8n.

## Главный сценарий

1. Пользователь создаёт заявку.
2. AI анализирует текст заявки (категория, намерение, приоритет, `lead_score`).
3. AI извлекает контактные данные только при их наличии в исходном тексте.
4. AI формирует резюме, недостающую информацию, рекомендуемое действие и черновик ответа.
5. Пользователь проверяет и подтверждает применение результата.
6. В CRM создаётся или связывается контакт, при необходимости создаётся задача.
7. Через n8n отправляется уведомление в Telegram.
8. Повторные вызовы не создают дублей.

Это рабочий продукт, а не кликабельный макет. Запрещены фиктивные кнопки, статические AI-ответы в рабочем режиме и имитация интеграций.

## Стек

| Компонент               | Версия                          |
| ----------------------- | ------------------------------- |
| Node.js                 | 24.20.0 LTS                     |
| pnpm                    | 9.15.9 (через Corepack)         |
| Next.js                 | 15.5.29 (App Router)            |
| React / React DOM       | 19.1.10                         |
| TypeScript              | 5.9.3 (strict)                  |
| Prisma / @prisma/client | 6.19.3                          |
| PostgreSQL              | 16.16 (`postgres:16.16-alpine`) |
| Auth.js (next-auth)     | 5.0.0-beta.32                   |
| Zod                     | 3.25.76                         |
| Tailwind CSS            | 3.4.19                          |
| bcryptjs                | 3.0.3                           |
| ESLint                  | 9.39.5                          |
| Vitest                  | 5.1.1                           |
| Playwright              | 1.65.1                          |

Полный перечень версий — в `docs/ARCHITECTURE.md`.

## Структура

```
app/               # Next.js App Router, Route Handlers, layout
components/        # UI-компоненты (ui/, layout/, dashboard/, leads/, contacts/, tasks/, ai/, auth/)
lib/               # ai, auth, database, integrations, security, utils, validation
services/          # бизнес-сценарии (Lead, Contact, Task, Dashboard, Activity, AI, Automation)
prisma/            # schema.prisma, миграции, seed
tests/             # unit, integration, e2e
docker/            # Dockerfile, WSL2 hints
docs/              # ARCHITECTURE, IMPLEMENTATION_PLAN, API, SECURITY, DEPLOYMENT, N8N
scripts/           # test-ai (ручной smoke с реальным provider)
```

## Локальный запуск (без Docker)

Требуется PostgreSQL 16.16 и Node.js 24.20.0.

```bash
# 1. Установите зависимости (используйте Corepack, глобальный pnpm не запускай)
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install --frozen-lockfile

# 2. Настройте окружение
cp .env.example .env
# Укажите DATABASE_URL и SHADOW_DATABASE_URL (отдельная пустая база bizpilot_shadow)
# Укажите SEED_ADMIN_PASSWORD (обязательно, без значения по умолчанию)
# Укажите AUTH_SECRET

# 3. Сгенерируйте Prisma Client
pnpm prisma:generate

# 4. Примените миграции
pnpm prisma:migrate

# 5. Заполните демо-данными
pnpm prisma:seed

# 6. Запустите приложение
pnpm dev
# http://localhost:3000
```

## Запуск через Docker Compose

Docker Desktop + WSL2 (рекомендуется на Windows). Лимиты: WSL2 memory=4GB, processors=2, swap=2GB; Compose postgres 512 MB, app 1 GB, n8n 512 MB.

```bash
docker compose up -d --build
# app: http://localhost:3000
# postgres: 127.0.0.1:5432
```

Compose читает `AUTH_SECRET`, `SEED_ADMIN_PASSWORD`, `AI_*` и строки подключения из env-файла. Для Docker используйте `.env.docker.example` → `.env.docker` и запускайте `docker compose --env-file .env.docker up -d --build`. Сервис `migrate` применяет миграции и выполняет idempotent seed до старта `app`; healthcheck использует `node -e fetch(...)`, потому что `wget` в slim-образе отсутствует.

n8n запускается отдельно: `docker compose --profile automation up -d` (этап 4; не установлен в Stage 1).

## Демо-учётные записи

Все три пользователя используют один пароль из `SEED_ADMIN_PASSWORD`:

| Email               | Роль     |
| ------------------- | -------- |
| admin@demo.local    | ADMIN    |
| manager@demo.local  | MANAGER  |
| operator@demo.local | OPERATOR |

Пароль не хранится в репозитории и не имеет значения по умолчанию. Он берётся из переменной `SEED_ADMIN_PASSWORD` в вашем `.env` (при Docker — в env-файле, переданном Compose). Если значение неизвестно, задайте новое в `.env` и выполните `pnpm prisma:seed`: seed обновляет пароль демо-пользователей при повторном запуске.

Демо-данные: 1 Workspace, 10 контактов, 20 заявок (`[DEMO]`), 15 задач, 2 интеграции (NOT_CONFIGURED). Повторный seed не создаёт дублей.

## AI-провайдер

Поддерживается любой OpenAI-compatible endpoint. Пример для Yandex AI Studio:

```env
AI_PROVIDER=openai-compatible
ALLOW_MOCK_AI=false
AI_BASE_URL=https://ai.api.cloud.yandex.net/v1
AI_MODEL=gpt://<folder-id>/aliceai-llm-flash/latest
AI_API_KEY=<ваш API-ключ>
AI_TIMEOUT_MS=60000
```

Список доступных моделей: `GET ${AI_BASE_URL}/models` с заголовком `Authorization: Bearer <ключ>`. Модель указывается полным URI `gpt://<folder-id>/<model>/latest`.

Проверка реального провайдера:

```bash
pnpm test:ai
```

Скрипт отказывается работать при `AI_PROVIDER=mock` или `ALLOW_MOCK_AI=true`, проверяет реальный HTTP-запрос, JSON, Zod-валидацию, category/intent/priority/leadScore, summary, draft_reply, timeout и ошибку провайдера. Ключи не выводятся.

## Тесты

```bash
pnpm test:unit      # Vitest unit-тесты
pnpm test:integration
pnpm test:e2e       # Playwright
pnpm test:ai        # ручной smoke с реальным provider (скрипт scripts/test-ai.ts)
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
```

`pnpm build` собирает обычный production bundle. Standalone-сборка для Docker включается переменной `NEXT_OUTPUT_STANDALONE=true` (задана в `docker/Dockerfile`), чтобы локальная сборка на Windows не падала на symlink-операциях.

## Ограничения MVP

- Фактически single-tenant (одна Workspace в семени).
- Rate limiting — in-memory Map (сброс при рестарте).
- JWT без отзыва сессий.
- n8n — необязательная интеграция; CRM работает при выключенном n8n.
- `AI_PROVIDER=mock` допустим только в разработке/тестах (`ALLOW_MOCK_AI=true`); в production запрещён.
- Auth.js v5 только в точной beta-версии `5.0.0-beta.32`.
- POST `/api/webhooks/lead-created` отсутствует; только `POST /api/webhooks/n8n`.

## Документация

- `docs/ARCHITECTURE.md` — архитектура, версии, риски.
- `docs/IMPLEMENTATION_PLAN.md` — план этапов и статус проверок.
- `docs/API.md` — все endpoints, query-параметры, ошибы, примеры.
- `docs/SECURITY.md` — модель угроз, проверки, результаты.
- `docs/DEPLOYMENT.md` — развёртывание, ENV, миграции, seed.
- `docs/N8N.md` — n8n workflow, HMAC, дедупликация, Telegram.
- `AGENTS.md` — правила для AI-агентов и разработчиков.

## Примечание об Auth.js v5

Используется beta-версия `5.0.0-beta.32` (стабильная v5 не существует). Beta-риск зафиксирован в документации.
