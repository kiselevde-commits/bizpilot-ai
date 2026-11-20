# BizPilot AI

Демонстрационная SaaS-платформа управления заявками (Leads), контактами (Contacts), задачами (Tasks) и бизнес-процессами с использованием реального LLM и n8n.

## Главный сценарий

1. Пользователь создаёт заявку.
2. AI анализирует текст заявки (категория, намерение, приоритет, `lead_score`).
3. AI извлекает контактные данные только при их наличии в исходном тексте.
4. AI формирует резюме, недостающую информацию, рекомендуемое действие и черновик ответа.
5. Пользователь проверяет и подтверждает применение результата.
6. Пользователь отдельными действиями связывает контакт и создаёт задачу.
7. При настроенном n8n отправляется уведомление в Telegram; CRM работает и без n8n.
8. Повторные вызовы и callback не создают дублей.

Это рабочий продукт, а не кликабельный макет. Запрещены фиктивные кнопки, статические AI-ответы в рабочем режиме и имитация интеграций.

## Статус этапа 5

- CRM-сценарии, AI-анализ с реальным провайдером, mock-E2E, unit/integration-тесты и production build проверены локально.
- GitHub Actions: `ci.yml` (lint, typecheck, unit, integration, build, Docker Compose smoke) и `e2e.yml` (`workflow_dispatch`, PostgreSQL, seed, Playwright, artifacts, mock AI).
- Реальный n8n + Telegram runtime и локальный Docker Compose остаются **BLOCKED** (нет credentials/Docker в текущем окружении). Docker проверяется в CI job `docker`.
- Демонстрационный сценарий: `docs/DEMO.md`.

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
| Zod                     | 4.6.7                           |
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
n8n/workflows/     # draft lead_created_notification.json для импорта
docker/            # Dockerfile, postgres init, n8n init-db.sql, WSL2 hints
tests/             # unit, integration, e2e
docs/              # ARCHITECTURE, IMPLEMENTATION_PLAN, API, SECURITY, DEPLOYMENT, N8N, DEMO
scripts/           # test-ai, test-webhook
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

**Локальный runtime Docker:** в текущем окружении Docker не установлен, поэтому Compose здесь **не запускался**. Конфигурация и сборка проверяются в CI job `docker` workflow `ci.yml`. Подробно — `docs/DEPLOYMENT.md`.

n8n запускается отдельно под профилем `automation`:

```bash
docker compose --env-file .env.docker --profile automation up -d
```

Профиль запускает `n8n-db-init` (идемпотентные роли `n8n_app`/`n8n_dedupe`),
затем n8n `1.123.98`. Базовый `docker compose up` не требует n8n-секретов.
Подробно — `docs/N8N.md`.

## Демо-учётные записи

Все три пользователя используют один пароль из `SEED_ADMIN_PASSWORD`:

| Email               | Роль     |
| ------------------- | -------- |
| admin@demo.local    | ADMIN    |
| manager@demo.local  | MANAGER  |
| operator@demo.local | OPERATOR |

Пароль не хранится в репозитории и не имеет значения по умолчанию. Он берётся из переменной `SEED_ADMIN_PASSWORD` в вашем `.env` (при Docker — в env-файле, переданном Compose). Если значение неизвестно, задайте новое в `.env` и выполните `pnpm prisma:seed`: seed обновляет пароль демо-пользователей при повторном запуске.

Демо-данные: 1 Workspace, 3 пользователя, 10 контактов, 20 заявок, 15 задач, 2 интеграции (NOT_CONFIGURED). Все заявки и задачи имеют префикс `[DEMO]`, Dashboard показывает баннер `Demo data`. Повторный seed не создаёт дублей и обновляет заголовки старых demo-записей до формата `[DEMO]`. Без `SEED_ADMIN_PASSWORD` seed завершается ошибкой.

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

Скрипт отказывается работать при `AI_PROVIDER=mock` или `ALLOW_MOCK_AI=true`, проверяет реальный HTTP-запрос, JSON, Zod-валидацию, category/intent/priority/leadScore, summary, `extractedContacts` (значения должны присутствовать в исходном тексте), draft_reply, timeout и ошибку провайдера. Ключи не выводятся.

## Автоматизация n8n + Telegram

Создание заявки в одной транзакции создаёт `AutomationEvent(PENDING)`.
Best-effort dispatcher после commit и lazy dispatcher на Dashboard/`/settings`/
automation API отправляют подписанный HMAC-запрос в n8n. n8n проверяет подпись и
timestamp, атомарно захватывает `n8n_processed`, отправляет Telegram и вызывает
`POST /api/webhooks/n8n`; событие становится `DELIVERED` или `FAILED`.

```env
N8N_WEBHOOK_URL=http://n8n:5678/webhook/lead-created
N8N_WEBHOOK_SECRET=<32+ bytes>
N8N_CALLBACK_SECRET=<32+ bytes, must differ>
N8N_TIMEOUT_MS=10000
TELEGRAM_BOT_TOKEN=<bot token для n8n credential>
TELEGRAM_CHAT_ID=<chat id>
```

Проверки:

```bash
pnpm test:webhook -- --idempotency-key "lead.created:<leadId>" --status delivered
```

Возможности:

- статусы `PENDING → SENT → DELIVERED`, `RETRYING`, `FAILED`;
- retry 1 + 3 (1/5/30 минут), максимум 24 часа, 4xx terminal, 429 `Retry-After`;
- ручной retry ADMIN/MANAGER только для FAILED, тот же `idempotencyKey`;
- `n8n_processed` с `INSERT ... ON CONFLICT DO NOTHING RETURNING`;
- `CLAIMED` старше 15 минут не переотправляется автоматически и виден в
  `/settings`;
- `/settings` показывает состояние n8n/Telegram, журнал, ошибки и время
  последней попытки.

**Статус runtime:** реальный n8n + Telegram **BLOCKED** — нет credentials и
Docker. Файл `n8n/workflows/lead_created_notification.json` — **draft для
импорта**, не подтверждённый экспорт работающего workflow. Настройка и
диагностика: `docs/N8N.md`.

## Тесты

Фактические результаты на 2026-11-20 (локальный PostgreSQL 16):

| Проверка           | Команда                  | Результат                        |
| ------------------ | ------------------------ | -------------------------------- |
| Typecheck          | `pnpm typecheck`         | PASS, 0 ошибок                   |
| Lint               | `pnpm lint`              | PASS, 0 ошибок (1 warning postcss) |
| Unit               | `pnpm test:unit`         | PASS, 199 тестов / 20 файлов     |
| Integration        | `pnpm test:integration`  | PASS, 24 теста / 4 файла         |
| E2E                | `pnpm test:e2e`          | PASS, 8 сценариев (Chromium)     |
| Production build   | `pnpm build`             | PASS                             |
| Реальный AI smoke  | `pnpm test:ai`           | PASS (Yandex AI Studio)          |

```bash
pnpm test:unit      # Vitest unit-тесты
pnpm test:integration
pnpm test:e2e       # Playwright; по умолчанию принудительно mock AI
pnpm test:ai        # ручной smoke с реальным provider (scripts/test-ai.ts)
pnpm test:webhook   # ручной подписанный callback n8n (scripts/test-webhook.ts)
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check   # repo-wide форматирование (исторически не проходит; не критерий приёмки)
```

`pnpm test:e2e` поднимает dev-сервер и по умолчанию выставляет `AI_PROVIDER=mock` + `ALLOW_MOCK_AI=true`; реальный LLM в E2E не вызывается. Осознанный запуск с реальным провайдером: `E2E_REAL_AI=true pnpm test:e2e`.

`pnpm build` собирает обычный production bundle. Standalone-сборка для Docker включается переменной `NEXT_OUTPUT_STANDALONE=true` (задана в `docker/Dockerfile`), чтобы локальная сборка на Windows не падала на symlink-операциях.

CI: `.github/workflows/ci.yml` (push/PR) и `.github/workflows/e2e.yml` (`workflow_dispatch`). Оба используют PostgreSQL service, `pnpm install --frozen-lockfile`, mock AI и загружают отчёты Playwright.

## Ограничения MVP

- Фактически single-tenant (одна Workspace в семени).
- Rate limiting — in-memory Map (сброс при рестарте).
- JWT без отзыва сессий.
- n8n — необязательная интеграция; CRM работает при выключенном n8n.
- Реальный n8n + Telegram runtime не проверен (нет credentials/Docker); workflow — draft для импорта.
- n8n 1.x EOL 2026-12-31; возможен переход на 2.x/3.x только после согласования.
- Outbox — eventual delivery; `SENT` без callback требует ручной сверки; нет exactly-once для Telegram.
- `pnpm audit --prod`: **0 известных уязвимостей**; `zod@4.6.7`, `deepmerge-ts@8.0.2`, `postcss` и `effect` зафиксированы (см. `docs/SECURITY.md`).
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
- `docs/DEMO.md` — сценарий демонстрации на 3–5 минут.
- `AGENTS.md` — правила для AI-агентов и разработчиков.

## Примечание об Auth.js v5

Используется beta-версия `5.0.0-beta.32` (стабильная v5 не существует). Beta-риск зафиксирован в документации.
