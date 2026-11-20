# Архитектура BizPilot AI

**Версия документа:** 1.2 (этап 5)  
**Дата:** 2026-11-20  
**Статус:** этапы 1–5 реализованы и проверены локально; реальный n8n/Telegram runtime и локальный Docker — BLOCKED (нет credentials/Docker)  
**Источник требований:** `BizPilot_AI_OpenCode_TZ_v1.2.md`, включая раздел 24.

## 1. Назначение и границы MVP

BizPilot AI — single-tenant (фактически) SaaS-приложение для управления заявками, контактами и задачами с реальным AI-анализом и автоматизацией через n8n/Telegram.

В MVP входят:

- авторизация и роли ADMIN / MANAGER / OPERATOR;
- Dashboard на реальных данных PostgreSQL;
- CRUD Leads, Contacts, Tasks с поиском, фильтрами, сортировкой и пагинацией;
- AI-анализ заявки через OpenAI-compatible provider;
- подтверждение и применение результата анализа пользователем;
- история AI-анализов;
- ActivityLog;
- outbox-доставка события `lead.created` в n8n;
- HMAC в обе стороны, идемпотентность через PostgreSQL;
- Telegram-уведомление через n8n;
- Docker Compose для app + PostgreSQL, отдельный profile для n8n;
- unit, integration, E2E-тесты;
- документация и GitHub Actions CI.

В MVP не входят (v1.1+): отдельные страницы Analytics/Integrations, второй workflow, OAuth/magic links, реальная multi-tenancy, bulk actions, CSV, приём сообщений Telegram-ботом, дополнительные интеграции.

## 2. Ключевые архитектурные решения v1.2

1. **Три слоя, без `domain/`:** Presentation → Application/Services → Infrastructure. Бизнес-правила живут в `services/` и чистых модулях `lib/`.
2. **Workspace scope везде:** `workspaceId` берётся из пользователя, загруженного из БД, а не из запроса клиента.
3. **JWT-сессия, но роль/Workspace перечитываются из БД** в каждом сервисном вызове. JWT не является источником истины для прав.
4. **AI не меняет бизнес-данные.** Анализ сохраняется в `AIAnalysis`; применение — отдельная транзакция после подтверждения пользователем.
5. **Outbox + lazy dispatcher.** Lead и `AutomationEvent(PENDING)` создаются одной транзакцией. Dispatcher вызывается после создания, на Dashboard, Settings/Automation и automation API. Надёжность — в PostgreSQL lease, а не в Promise.
6. **n8n dedupe в PostgreSQL** через `n8n_processed` и атомарный `INSERT ... ON CONFLICT DO NOTHING RETURNING`.
7. **Две разные HMAC-схемы:** исходящая (`N8N_WEBHOOK_SECRET`) и callback (`N8N_CALLBACK_SECRET`), обе подписывают `timestamp + "." + rawBody`, окно ±5 минут, constant-time compare.
8. **Точные версии до установки.** Версии зафиксированы в разделе 3; `package.json` без `^`/`~`, lockfile коммитится.
9. **Auth.js v5 остаётся beta.** Официального stable v5 нет; используется `5.0.0-beta.32`, риск зафиксирован.
10. **n8n 1.x — baseline ТЗ, но 1.x EOL 2026-12-31.** Версия `1.123.98` зафиксирована по ТЗ; решение о переходе на 2.x/3.x требует подтверждения пользователя (см. раздел 17).

## 3. Технологический стек и точные версии

Проверка выполнена 2026-11-19 через npm registry (`npm view`), Docker Hub API и официальную документацию Auth.js/n8n. На этапе 0 `pnpm install` не выполнялся.

### 3.1. Runtime и tooling

| Компонент  | Точная версия         | Источник / примечание                                                                                    |
| ---------- | --------------------- | -------------------------------------------------------------------------------------------------------- |
| Node.js    | 24.20.0 LTS «Krypton» | `node --version`; LTS                                                                                    |
| pnpm       | 9.15.9                | baseline `pnpm@9`; глобально установлен 12.16.1, проект фиксирует 9.15.9 через `packageManager`/Corepack |
| TypeScript | 5.9.3                 | последняя 5.x; TS 7.x не входит в baseline и не валидировался с Next 15                                  |
| Git        | 2.56.0.windows.2      | окружение                                                                                                |
| Docker     | не установлен         | блокер этапа 1/5, см. раздел 17                                                                          |
| PostgreSQL | 16.16                 | Docker image `postgres:16.16-alpine`                                                                     |
| n8n        | 1.123.98              | Docker image `n8nio/n8n:1.123.98`; baseline 1.x                                                          |

### 3.2. Основные зависимости

| Пакет                    | Версия        | Назначение                   |
| ------------------------ | ------------- | ---------------------------- |
| next                     | 15.5.29       | App Router, Route Handlers   |
| react                    | 19.1.10       | UI                           |
| react-dom                | 19.1.10       | UI                           |
| next-auth                | 5.0.0-beta.32 | Auth.js v5, Credentials, JWT |
| @prisma/client           | 6.19.3        | ORM                          |
| prisma                   | 6.19.3        | CLI, migrations, seed        |
| zod                      | 3.25.76       | валидация                    |
| bcryptjs                 | 3.0.3         | хеширование паролей          |
| tailwindcss              | 3.4.19        | стили                        |
| tailwindcss-animate      | 1.0.7         | анимации shadcn/ui           |
| class-variance-authority | 0.7.1         | варианты компонентов         |
| clsx                     | 2.1.1         | классы                       |
| tailwind-merge           | 3.7.0         | слияние классов              |
| lucide-react             | 1.75.0        | иконки                       |
| react-hook-form          | 7.92.0        | формы                        |
| @hookform/resolvers      | 7.0.7         | Zod resolver                 |
| recharts                 | 3.11.0        | графики Dashboard            |
| react-is                 | 19.1.10       | peer для Recharts            |
| sonner                   | 2.0.8         | toast-уведомления            |
| date-fns                 | 4.4.0         | форматирование дат           |
| server-only              | 0.0.1         | защита серверных модулей     |

Radix-примитивы shadcn/ui (точные версии):

| Пакет                         | Версия |
| ----------------------------- | ------ |
| @radix-ui/react-slot          | 1.5.0  |
| @radix-ui/react-dialog        | 1.3.1  |
| @radix-ui/react-dropdown-menu | 2.2.1  |
| @radix-ui/react-select        | 2.4.1  |
| @radix-ui/react-label         | 2.1.17 |
| @radix-ui/react-avatar        | 1.3.1  |
| @radix-ui/react-separator     | 1.2.0  |
| @radix-ui/react-tabs          | 1.2.1  |
| @radix-ui/react-tooltip       | 1.4.1  |
| @radix-ui/react-popover       | 1.3.1  |
| @radix-ui/react-checkbox      | 1.4.1  |
| @radix-ui/react-switch        | 1.4.1  |
| @radix-ui/react-scroll-area   | 1.4.0  |

### 3.3. Dev-зависимости

| Пакет                       | Версия  |
| --------------------------- | ------- |
| eslint                      | 9.39.5  |
| eslint-config-next          | 15.5.29 |
| @eslint/eslintrc            | 3.3.7   |
| prettier                    | 3.10.1  |
| prettier-plugin-tailwindcss | 0.8.1   |
| vitest                      | 5.1.1   |
| vite                        | 8.3.8   |
| @playwright/test            | 1.65.1  |
| tsx                         | 4.23.15 |
| @types/node                 | 24.19.2 |
| @types/react                | 19.3.0  |
| @types/react-dom            | 19.3.0  |
| postcss                     | 8.5.33  |
| autoprefixer                | 10.6.2  |

`@types/bcryptjs` не устанавливается: bcryptjs 3.x содержит собственные типы, пакет `@types/bcryptjs` — deprecated stub.

### 3.4. Docker-образы

| Сервис            | Точный tag                   |
| ----------------- | ---------------------------- |
| app build/runtime | `node:24.20.0-bookworm-slim` |
| PostgreSQL        | `postgres:16.16-alpine`      |
| n8n               | `n8nio/n8n:1.123.98`         |

### 3.5. Auth.js: статус stable/beta

- npm dist-tags: `latest = 4.24.15`, `beta = 5.0.0-beta.32`.
- Официальная документация Auth.js для Next.js: `npm install next-auth@beta`.
- Stable-релиза 5.x нет. Используется точная `5.0.0-beta.32` (транзитивно `@auth/core 0.41.3`).
- Риски: beta API может измениться, возможны регрессии, проект Auth.js вошёл в Better Auth. Митигация: изоляция auth-конфигурации, unit/integration-тесты login/role checks, фиксация версии, отсутствие автоматических обновлений. Beta-риск продублирован в README и Known limitations (этап 5).
- Переход на stable v4 запрещён ТЗ; переход на Better Auth — отдельное согласование вне MVP.

### 3.6. Политика версий

- Прямые зависимости — exact versions, без `^`/`~`.
- `pnpm-lock.yaml` коммитится; CI использует `--frozen-lockfile`.
- Обновления — отдельной задачей с проверкой changelog, тестов и security review.
- Docker tags не `latest`.
- Node 24.20.0 фиксируется в `.nvmrc`/`engines` и Docker image.
- pnpm 9.15.9 фиксируется в `packageManager`; Corepack 0.35.0 доступен в окружении.

## 4. Компоненты и границы

```text
┌─────────────────────────────────────────────────────────────┐
│ Presentation (app/, components/)                            │
│  Server Components: страницы, layout, чтение через services  │
│  Client Components: формы, фильтры, dialogs, charts          │
└──────────────────────────────┬──────────────────────────────┘
                               │ server calls / fetch API
┌──────────────────────────────▼──────────────────────────────┐
│ Application / Services (services/, lib/)                    │
│  auth guard, role check, workspace scope, use cases         │
│  lead/contact/task/ai/automation/dashboard services         │
└──────────────────────────────┬──────────────────────────────┘
                               │ adapters
┌──────────────────────────────▼──────────────────────────────┐
│ Infrastructure (lib/database, lib/ai, lib/integrations,     │
│ lib/security)                                               │
│  Prisma, OpenAI-compatible HTTP, n8n HTTP, HMAC, rate limit │
└──────────────────────────────┬──────────────────────────────┘
                               │
                ┌──────────────▼──────────────┐
                │ PostgreSQL 16.16            │
                │ + n8n_processed             │
                └──────────────▲──────────────┘
                               │
                ┌──────────────┴──────────────┐
                │ n8n 1.123.98 (optional)     │
                │  → Telegram Bot API         │
                └─────────────────────────────┘
```

Границы:

- React-компоненты не содержат бизнес-правил и не обращаются к Prisma.
- Route Handlers не содержат бизнес-логики; они вызывают сервисы.
- Сервисы не знают о HTTP-формате UI; возвращают типизированные данные/ошибки.
- AI/Telegram/n8n изолированы адаптерами; замена provider не меняет бизнес-логику.
- Клиентский bundle не содержит Prisma, секретов, prompt и server-only модулей.

## 5. Потоки данных

### 5.1. Login

1. Пользователь отправляет email/password на Auth.js Credentials endpoint.
2. Route wrapper применяет auth rate limit (5/15 мин/IP).
3. `authorize` валидирует Zod, нормализует email, ищет пользователя в PostgreSQL, сравнивает bcrypt hash.
4. Auth.js выпускает JWT в httpOnly cookie; в токен попадают `sub`, `role`, `workspaceId`.
5. Middleware проверяет наличие сессии для страниц/API.
6. Каждый сервис загружает актуального пользователя из БД и использует его роль/Workspace.

### 5.2. CRUD

1. Server Component страницы получает сессию, пользователя из БД, вызывает service для чтения.
2. Клиентская мутация отправляет JSON в Route Handler.
3. Handler: Origin check → rate limit → body limit → Zod → auth/role → service.
4. Service проверяет Workspace scope, выполняет Prisma-операцию и ActivityLog в транзакции.
5. Handler возвращает единый envelope; UI делает `router.refresh()`.

### 5.3. AI-анализ

1. Пользователь нажимает «Анализировать» на заявке.
2. `POST /api/leads/:id/analyze` (или `POST /api/ai/analyze-lead`) проверяет auth/role/workspace, AI rate limit.
3. Service строит prompt и считает `promptHash`; Lead не изменяется.
4. Adapter вызывает OpenAI-compatible endpoint с AbortController (общий бюджет 60 с).
5. Ответ парсится и валидируется Zod; при невалидном JSON — один retry.
6. Каждая попытка пишется в `AIAnalysis` (SUCCESS/FAILED), без raw prompt/response.
7. Бизнес-поля Lead, включая `status`, не меняются; UI показывает локальное состояние загрузки.
8. UI показывает результат и кнопку «Применить результат».

### 5.4. Применение AI-результата

1. Пользователь подтверждает результат.
2. `POST /api/leads/:id/apply-analysis` с `analysisId`.
3. Service проверяет, что анализ принадлежит заявке/Workspace и имеет статус SUCCESS.
4. В одной транзакции обновляются `leadScore`, `scoreBreakdown`, `category`, `intent`, `customerType`, `priority`, `summary` и создаётся ActivityLog.
5. Контакт/задача создаются отдельными явными действиями пользователя через обычные CRUD endpoints (с предзаполненными данными), без автоматического объединения дублей.

### 5.5. Создание заявки и outbox

1. `POST /api/leads` создаёт Lead и `AutomationEvent(PENDING)` в одной Prisma-транзакции.
2. `idempotencyKey = lead.created:<leadId>`; payload содержит title, priority, category, summary, url.
3. После commit — best-effort `dispatchPendingEvents()` (fire-and-forget, только ускоритель).
4. Если n8n недоступен, событие остаётся PENDING в PostgreSQL; CRM продолжает работать.

### 5.6. Lazy dispatcher

1. Вызывается после создания Lead, на Dashboard, Settings/Automation и `GET /api/automation/status|events`.
2. Обрабатывает максимум 10 готовых событий за запрос.
3. Атомарно захватывает события через `lockedAt`/`lockToken` (lease 5 минут) с `FOR UPDATE SKIP LOCKED`.
4. События старше 24 часов переводятся в FAILED без отправки.
5. Отправляет подписанный webhook в n8n; обновляет статус, attempts, nextRetryAt, lastError.
6. `SENT` ждёт callback; `DELIVERED`/`FAILED` — по callback.
7. Ограничение: доставка eventual; без трафика приложения PENDING-события задерживаются. Это документируется в README и `docs/N8N.md`.

### 5.7. n8n → BizPilot callback

1. n8n отправляет `POST /api/webhooks/n8n` с `X-N8N-Signature`, `X-N8N-Timestamp`.
2. BizPilot читает raw body с лимитом 64 KB, проверяет timestamp ±5 минут и HMAC constant-time.
3. Zod валидирует `{ idempotencyKey, status, externalEventId?, error? }`.
4. Событие ищется по `idempotencyKey`; присланный `workspaceId` игнорируется.
5. Допустимые переходы: SENT → DELIVERED, SENT → FAILED. Повторный callback идемпотентен.
6. Обновляется Integration status/lastCheckedAt.

## 6. Схема взаимодействия с PostgreSQL

- Prisma Client — единственный путь доступа к бизнес-таблицам.
- Prisma migrations — единственный способ изменения схемы.
- `n8n_processed` создаётся SQL-миграцией и доступна n8n через отдельную роль.
- Транзакции обязательны для: Lead + AutomationEvent; AI apply + ActivityLog; delete-правил; создания/обновления сущности + ActivityLog.
- Долгие AI-вызовы не выполняются внутри транзакции.
- Все списки используют серверную пагинацию; никаких `findMany()` без limit на бизнес-таблицах.
- Raw SQL допускается только с параметрами (dashboard aggregation, atomic outbox claim, n8n_processed status).

## 7. Модель данных

### 7.1. Enum

| Enum                  | Значения                                                                                |
| --------------------- | --------------------------------------------------------------------------------------- |
| Role                  | `ADMIN`, `MANAGER`, `OPERATOR`                                                          |
| LeadStatus            | `NEW`, `ANALYZING`, `QUALIFIED`, `IN_PROGRESS`, `WAITING`, `CONVERTED`, `REJECTED`      |
| Priority              | `LOW`, `MEDIUM`, `HIGH`, `URGENT`                                                       |
| TaskStatus            | `TODO`, `IN_PROGRESS`, `DONE`, `CANCELLED`                                              |
| LeadCategory          | `business_automation`, `crm_integration`, `ai_bot`, `document_flow`, `web_app`, `other` |
| LeadIntent            | `request`, `question`, `complaint`, `info`, `other`                                     |
| CustomerType          | `b2b`, `b2c`, `b2g`, `unknown`                                                          |
| ContactStatus         | `NEW`, `ACTIVE`, `INACTIVE` (значения не заданы ТЗ; предположение, см. раздел 17)       |
| AIAnalysisStatus      | `SUCCESS`, `FAILED` (значения не заданы ТЗ; предположение)                              |
| IntegrationType       | `n8n`, `telegram`                                                                       |
| IntegrationStatus     | `NOT_CONFIGURED`, `ACTIVE`, `ERROR`                                                     |
| AutomationEventStatus | `PENDING`, `SENT`, `DELIVERED`, `FAILED`, `RETRYING`                                    |

Правило: enum category/intent/customer_type одинаковы в Prisma, Zod и AI response schema. Произвольные строки запрещены.

### 7.2. Workspace

| Поле                  | Тип                         | Примечание   |
| --------------------- | --------------------------- | ------------ |
| id                    | String @id @default(uuid()) |              |
| name                  | String                      |              |
| slug                  | String @unique              | seed: `demo` |
| createdAt / updatedAt | DateTime                    |              |

Связи: users, contacts, leads, tasks, activityLogs, integrations, automationEvents.

### 7.3. User

| Поле                  | Тип                         | Примечание         |
| --------------------- | --------------------------- | ------------------ |
| id                    | String @id @default(uuid()) |                    |
| name                  | String                      |                    |
| email                 | String                      | хранится lowercase |
| passwordHash          | String                      | bcrypt cost 12     |
| role                  | Role                        |                    |
| workspaceId           | String                      | FK Workspace       |
| createdAt / updatedAt | DateTime                    |                    |

Ограничение: `@@unique([workspaceId, email])`. Login в MVP ищет по email в единственном Workspace. Пароль и hash никогда не возвращаются API. Seed создаёт ADMIN/MANAGER/OPERATOR; все три используют `SEED_ADMIN_PASSWORD`; пароль не публикуется в README/Git.

### 7.4. Contact

| Поле                      | Тип                         | Примечание                            |
| ------------------------- | --------------------------- | ------------------------------------- |
| id                        | String @id @default(uuid()) |                                       |
| name                      | String                      |                                       |
| company                   | String?                     |                                       |
| email                     | String?                     | исходное значение                     |
| phone                     | String?                     | исходное значение                     |
| emailNormalized           | String?                     | trim + lowercase; индекс              |
| phoneNormalized           | String?                     | только цифры, нормализация +7; индекс |
| notes                     | String?                     |                                       |
| status                    | ContactStatus               | default NEW                           |
| workspaceId               | String                      | FK Workspace                          |
| createdById / updatedById | String                      | FK User                               |
| createdAt / updatedAt     | DateTime                    |                                       |

Индексы: `(workspaceId, emailNormalized)`, `(workspaceId, phoneNormalized)`, `(workspaceId, createdAt)`.

Дубли: поиск только внутри Workspace по normalized email/phone. Автоматическое объединение запрещено. При совпадении API возвращает 409 `DUPLICATE_CONTACT` с кандидатами; создание возможно только с явным `force=true` после решения пользователя.

### 7.5. Lead

| Поле                      | Тип                         | Примечание                             |
| ------------------------- | --------------------------- | -------------------------------------- |
| id                        | String @id @default(uuid()) |                                        |
| title                     | String                      |                                        |
| message                   | String @db.Text             | max 20 000 символов в Zod              |
| source                    | String?                     | свободный текст; значения ТЗ не заданы |
| status                    | LeadStatus                  | default NEW                            |
| priority                  | Priority                    | default MEDIUM                         |
| category                  | LeadCategory?               | заполняется только apply               |
| intent                    | LeadIntent?                 | заполняется только apply               |
| customerType              | CustomerType?               | заполняется только apply               |
| summary                   | String?                     | max 300                                |
| leadScore                 | Int?                        | 0–100                                  |
| scoreBreakdown            | Json?                       | 5 целых 0–100                          |
| contactId                 | String?                     | FK Contact, onDelete Restrict          |
| assignedToId              | String?                     | FK User, onDelete SetNull              |
| workspaceId               | String                      | FK Workspace                           |
| createdById / updatedById | String                      | FK User, onDelete Restrict             |
| createdAt / updatedAt     | DateTime                    |                                        |

Индексы: `(workspaceId, status, priority, createdAt)`, `(workspaceId, createdAt)`, `(workspaceId, contactId)`, `(workspaceId, assignedToId)`.

`scoreBreakdown` — денормализованная копия для карточки/Dashboard; полный исторический результат остаётся в `AIAnalysis.resultJson`. До подтверждения AI не меняет эти поля.

### 7.6. Task

| Поле                      | Тип                         | Примечание                    |
| ------------------------- | --------------------------- | ----------------------------- |
| id                        | String @id @default(uuid()) |                               |
| title                     | String                      |                               |
| description               | String?                     |                               |
| status                    | TaskStatus                  | default TODO                  |
| priority                  | Priority                    | default MEDIUM                |
| dueDate                   | DateTime?                   |                               |
| assignedToId              | String?                     | FK User, onDelete SetNull     |
| leadId                    | String?                     | FK Lead, onDelete SetNull     |
| contactId                 | String?                     | FK Contact, onDelete Restrict |
| workspaceId               | String                      | FK Workspace                  |
| createdById / updatedById | String                      | FK User, onDelete Restrict    |
| createdAt / updatedAt     | DateTime                    |                               |

Индексы: `(workspaceId, status, dueDate)`, `(workspaceId, assignedToId)`, `(workspaceId, leadId)`, `(workspaceId, contactId)`.

Просроченная задача: `dueDate < now()` и `status in (TODO, IN_PROGRESS)`. `DONE`/`CANCELLED` не считаются просроченными.

### 7.7. AIAnalysis

| Поле                       | Тип                         | Примечание                         |
| -------------------------- | --------------------------- | ---------------------------------- |
| id                         | String @id @default(uuid()) |                                    |
| leadId                     | String                      | FK Lead, onDelete Cascade          |
| provider                   | String                      | hostname provider                  |
| model                      | String                      | AI_MODEL                           |
| status                     | AIAnalysisStatus            | SUCCESS / FAILED                   |
| resultJson                 | Json?                       | полный валидированный результат    |
| promptHash                 | String                      | SHA-256, hex                       |
| tokensInput / tokensOutput | Int?                        | из usage, если есть                |
| durationMs                 | Int?                        |                                    |
| errorMessage               | String?                     | безопасный текст, без raw response |
| createdAt                  | DateTime                    |                                    |

Индекс: `(leadId, createdAt)`. Одна запись на каждую попытку provider (успешную или неуспешную) — это покрывает историю попыток. Последний анализ — `orderBy createdAt desc, take 1`; поле `latestAnalysisId` не вводится.

Не хранятся: полный prompt, raw response, API key, заголовки запроса.

### 7.8. ActivityLog

| Поле        | Тип                         | Примечание                                  |
| ----------- | --------------------------- | ------------------------------------------- |
| id          | String @id @default(uuid()) |                                             |
| workspaceId | String                      | FK Workspace                                |
| entityType  | String                      | allow-list: lead, contact, task, automation |
| entityId    | String                      | без FK; dangling reference допустим         |
| action      | String                      | например `lead.created`, `lead.ai_applied`  |
| actorId     | String?                     | FK User, onDelete SetNull                   |
| metadata    | Json?                       | минимальный, без секретов/PII               |
| createdAt   | DateTime                    |                                             |

Индекс: `(workspaceId, entityType, entityId, createdAt)`. ActivityLog не удаляется при удалении сущности и не имеет FK на неё.

### 7.9. Integration

| Поле                  | Тип                         | Примечание                                                        |
| --------------------- | --------------------------- | ----------------------------------------------------------------- |
| id                    | String @id @default(uuid()) |                                                                   |
| workspaceId           | String                      | FK Workspace                                                      |
| type                  | IntegrationType             | n8n / telegram                                                    |
| name                  | String                      |                                                                   |
| status                | IntegrationStatus           | default NOT_CONFIGURED                                            |
| configMetadata        | Json?                       | allow-list: Telegram `chat_id`, `bot_username`; n8n `workflow_id` |
| lastCheckedAt         | DateTime?                   |                                                                   |
| createdAt / updatedAt | DateTime                    |                                                                   |

Ограничение: `@@unique([workspaceId, type])`. В `configMetadata` запрещены токены, API-ключи, HMAC-секреты и пароли. Seed создаёт обе записи со статусом NOT_CONFIGURED. ACTIVE выставляется только после реального успешного вызова/проверки, не из-за наличия ENV.

### 7.10. AutomationEvent

| Поле                  | Тип                         | Примечание                                |
| --------------------- | --------------------------- | ----------------------------------------- |
| id                    | String @id @default(uuid()) | внутренний UUID                           |
| workspaceId           | String                      | FK Workspace                              |
| eventType             | String                      | `lead.created`                            |
| entityId              | String                      | lead id                                   |
| payload               | Json                        | title, priority, category, summary, url   |
| status                | AutomationEventStatus       | default PENDING                           |
| idempotencyKey        | String @unique              | основной ключ дедупликации                |
| externalEventId       | String?                     | n8n execution id, диагностика             |
| attempts              | Int                         | default 0; только фактические HTTP-вызовы |
| lastError             | String?                     | безопасный текст                          |
| nextRetryAt           | DateTime?                   |                                           |
| lockedAt              | DateTime?                   | DB lease                                  |
| lockToken             | String?                     | DB lease                                  |
| createdAt / updatedAt | DateTime                    |                                           |

Индексы: `(status, nextRetryAt, lockedAt)`, `(externalEventId)`. `idempotencyKey` уникален глобально.

Переходы: PENDING → SENT; SENT → DELIVERED; SENT → FAILED; FAILED → RETRYING; RETRYING → SENT; RETRYING → FAILED.

### 7.11. n8n_processed (SQL-миграция)

```sql
CREATE TABLE n8n_processed (
  idempotency_key text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('CLAIMED', 'SENT', 'FAILED')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL,
  external_event_id text NULL,
  last_error text NULL
);
CREATE INDEX n8n_processed_status_claimed_at_idx
  ON n8n_processed (status, claimed_at);
```

Таблица не входит в Prisma schema. Создаётся отдельной SQL-миграцией. n8n работает с ней через роль `n8n_dedupe` с правами только SELECT/INSERT/UPDATE на эту таблицу. `CLAIMED` старше 15 минут не переотправляется автоматически; отображается как требующее ручной сверки.

Проверено 2026-11-19: `prisma/migrations/20261119000100_n8n_processed/migration.sql` применяется через `prisma migrate deploy`; Prisma-модели для этой таблицы нет (сохранён подход ТЗ 24.12).

Этап 4 добавил:

- `docker/n8n/init-db.sql` — идемпотентное создание ролей `n8n_app` (владелец отдельной БД `n8n`) и `n8n_dedupe` (`NOSUPERUSER NOCREATEDB NOCREATEROLE`);
- Compose-сервис `n8n-db-init` под профилем `automation`, который запускается после `migrate`;
- миграцию `20261119000200_n8n_processed_grants`: `REVOKE ALL` + `GRANT SELECT, INSERT, UPDATE` для `n8n_dedupe`, если роль существует;
- отзыв `CONNECT` на CRM-БД у `PUBLIC`, чтобы `n8n_app` не имел доступа к бизнес-таблицам.

### 7.12. Правила удаления

| Сущность   | Правило                                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| Lead       | `AIAnalysis` cascade delete; `Task.leadId → NULL`; Contact не удаляется; ActivityLog сохраняется с исходным `entityId` |
| Contact    | Если есть `Lead.contactId` или `Task.contactId` — 409 `ENTITY_IN_USE`; сначала явная отвязка. Cascade запрещён         |
| Task       | hard delete; ActivityLog сохраняется                                                                                   |
| User       | удаление в MVP не реализуется; пользователи создаются seed-ом                                                          |
| Workspace  | удаление в MVP не реализуется                                                                                          |
| AIAnalysis | удаляется только каскадом с Lead; отдельного endpoint нет                                                              |

### 7.13. Нормализация email/phone

`lib/utils/normalize.ts`:

- email: `trim().toLowerCase()`; пустое → `null`;
- phone: удалить всё, кроме цифр; если 11 цифр и первая `7` или `8` → `+7` + последние 10 цифр; иначе оставить строку цифр без добавления кода страны; пустое → `null`.

Функции покрываются unit-тестами. Проверка дублей — только внутри текущего Workspace.

## 8. Авторизация и роли

### 8.1. Auth.js v5

- Credentials Provider, JWT strategy.
- `auth.config.ts` — edge-safe конфигурация без Prisma (для middleware).
- `auth.ts` — полная конфигурация с Credentials `authorize` и Prisma.
- `authorize`: Zod email/password → normalize email → `prisma.user.findFirst({ where: { email } })` → `bcrypt.compare` → вернуть безопасный user object.
- Пароль не логируется; ошибка всегда «Invalid email or password».
- Session maxAge 8 часов (предположение, ТЗ не задаёт), updateAge 15 минут.
- Cookie: Auth.js defaults — `httpOnly`, `sameSite=lax`, `secure` при HTTPS/production. Проверяется в этапе 1.
- `AUTH_SECRET` обязателен; `AUTH_URL`/`AUTH_TRUST_HOST` для Docker.

### 8.2. JWT claims и актуальность

JWT содержит `sub`, `role`, `workspaceId` для UI/middleware. Сервисы не доверяют этим полям: `requireUser()` загружает пользователя из БД по `sub`, проверяет существование и возвращает актуальные `role`/`workspaceId`. Это снижает риск устаревшей роли при JWT без revocation.

### 8.3. Middleware

- `middleware.ts` защищает `/(dashboard)/*` и `/api/*`.
- Исключения: `/api/auth/*`, `/api/webhooks/*` (собственная HMAC-аутентификация), `/api/ai/health`.
- Страницы без сессии → redirect `/login?callbackUrl=...` (с безопасной проверкой callback).
- API без сессии → 401 с единым envelope.
- Middleware не импортирует Prisma и не заменяет проверки в Route Handlers/services.
- `workspaceId` из JWT не используется для бизнес-запросов.

### 8.4. Матрица прав

См. `AGENTS.md`, раздел 8. Проверка выполняется в сервисах:

- `requireRole(user, ['ADMIN','MANAGER'])` для delete/automation retry;
- чтение/создание/редактирование Leads/Contacts/Tasks — все роли;
- удаление — ADMIN/MANAGER;
- журнал automation и retry — ADMIN/MANAGER;
- настройки интеграций — ADMIN (в MVP только read-only).

### 8.5. Workspace scope и IDOR

- Любая выборка: `where: { id, workspaceId }`; чужая запись → 404, не 403 (не раскрывать существование).
- Запись связей: `Lead.contactId`, `Lead.assignedToId`, `Task.leadId`, `Task.contactId`, `Task.assignedToId` проверяются на тот же Workspace. Несуществующий и чужой ID дают одинаковый 404.
- `assignedToId` должен быть пользователем того же Workspace.
- Дубли контактов — только внутри Workspace.
- Тесты: пользователь A не читает/не меняет/не удаляет данные Workspace B.

## 9. API

### 9.1. Формат

Успех: `{ "success": true, "data": ..., "error": null }`.  
Ошибка: `{ "success": false, "data": null, "error": { "code": "...", "message": "..." } }`.

Допускается `error.details` для Zod issues и duplicate candidates; секреты и stack trace не включаются.

### 9.2. Endpoints

| Метод            | Path                               | Роли                       | Примечание                            |
| ---------------- | ---------------------------------- | -------------------------- | ------------------------------------- |
| GET/POST         | `/api/leads`                       | все                        | список/создание                       |
| GET/PATCH/DELETE | `/api/leads/:id`                   | все / delete ADMIN+MANAGER |                                       |
| POST             | `/api/leads/:id/analyze`           | все                        | AI-анализ                             |
| POST             | `/api/leads/:id/apply-analysis`    | все                        | добавлен для требования 24.5          |
| GET/POST         | `/api/contacts`                    | все                        |                                       |
| GET/PATCH/DELETE | `/api/contacts/:id`                | все / delete ADMIN+MANAGER |                                       |
| GET/POST         | `/api/tasks`                       | все                        |                                       |
| GET/PATCH/DELETE | `/api/tasks/:id`                   | все / delete ADMIN+MANAGER |                                       |
| POST             | `/api/ai/analyze-lead`             | все                        | альтернативный вход к тому же service |
| POST             | `/api/ai/generate-reply`           | все                        | реальный AI-вызов, без автоотправки   |
| GET              | `/api/ai/history`                  | все                        | история по leadId                     |
| GET              | `/api/ai/health`                   | public                     | минимальный статус + configured, без секретов |
| GET              | `/api/automation/events`           | ADMIN/MANAGER              | журнал + lazy dispatch                |
| POST             | `/api/automation/events/:id/retry` | ADMIN/MANAGER              | ручной retry                          |
| GET              | `/api/automation/status`           | ADMIN/MANAGER              | counts + integrations + lazy dispatch |
| POST             | `/api/webhooks/n8n`                | HMAC                       | callback n8n                          |
| —                | `/api/webhooks/lead-created`       | —                          | отсутствует                           |

### 9.3. Списки

Query: `page=1`, `limit=20` (1–100), `search`, `status`, `priority` (Leads/Tasks), `sort=createdAt:desc`.

Allow-list сортировки:

- Leads: `createdAt`, `updatedAt`, `title`, `status`, `priority`, `leadScore`.
- Contacts: `createdAt`, `updatedAt`, `name`, `company`, `status`.
- Tasks: `createdAt`, `updatedAt`, `title`, `status`, `priority`, `dueDate`.

Ответ: `items` + `pagination: { page, limit, total, totalPages }`. `totalPages = ceil(total/limit)` (0 при total=0). Пользовательская строка сортировки не попадает в Prisma `orderBy`.

### 9.4. Лимиты body

- `/api/leads` и `/api/ai/*` — 256 KB.
- Остальные бизнес-endpoints и webhook — 64 KB.
- Сначала `Content-Length`, затем чтение потока с фактическим подсчётом байт; превышение → 413.
- JSON endpoints требуют `application/json`; иначе 415.

### 9.5. Rate limits

| Группа  | Лимит      | Ключ    |
| ------- | ---------- | ------- |
| Auth    | 5 / 15 мин | IP      |
| AI      | 10 / час   | user id |
| CRUD    | 100 / мин  | user id |
| Webhook | 1000 / мин | IP      |

In-memory Map + TTL, 429 + `Retry-After`. Ограничение одного процесса; после рестарта счётчики сбрасываются; несколько экземпляров не синхронизируются. IP берётся из `x-forwarded-for`/`x-real-ip`; безопасно только за доверенным proxy.

### 9.6. CSRF / Origin

- Для cookie-authenticated mutations проверяется `Origin` против множества допустимых origin: `APP_BASE_URL`, реальный origin, с которого получен запрос (`request.url`), и первый хост из `Host`/`X-Forwarded-Host` (прокси-цепочка — берётся первый хост).
- Нормализация origin допускает только `http:`/`https:` протоколы; значение сравнивается нормализованным.
- SameSite=lax и CSRF Auth.js учитываются.
- Server Actions не считаются заменой авторизации.
- Webhook не использует cookie; защита — HMAC + timestamp.
- MVP same-origin; отдельный CORS не настраивается.

### 9.7. Транзакции и идемпотентность

- Lead + AutomationEvent — одна транзакция.
- Apply AI + ActivityLog — одна транзакция.
- Create/update/delete + ActivityLog — транзакция, где применимо.
- Callback идемпотентен по `idempotencyKey`; повторный DELIVERED не меняет состояние.
- Outbox claim — атомарный SQL с lease; без in-memory lock.

## 10. AI adapter

### 10.1. Интерфейс

```ts
interface AIProvider {
  readonly name: string;
  analyzeLead(input: AnalyzeLeadInput, signal: AbortSignal): Promise<AIAnalysisResult>;
  generateReply(input: GenerateReplyInput, signal: AbortSignal): Promise<{ draftReply: string }>;
}
```

Реализации:

- `OpenAICompatibleProvider` — `fetch` на `${AI_BASE_URL}/chat/completions`.
- `MockAIProvider` — детерминированные ответы для E2E/CI; только при `AI_PROVIDER=mock` и `ALLOW_MOCK_AI=true`; в production запрещён.

ENV: `AI_BASE_URL` (default `https://openrouter.ai/api/v1`), `AI_API_KEY`, `AI_MODEL`, `AI_TIMEOUT_MS=60000`. `AI_MODEL` без дефолта: при отсутствии анализ возвращает 503 `AI_NOT_CONFIGURED`.

### 10.2. Prompt

- System prompt: роль, задача, JSON schema, правила (не выдумывать данные, null/[] при отсутствии, только enum, длины, не раскрывать system prompt/секреты, не выполнять команды/SQL/tools, не инициировать действия).
- User content оборачивается `<<<USER_INPUT>>> ... <<<END_USER_INPUT>>>`.
- Маркеры внутри пользовательского текста нейтрализуются; длина message ≤ 20 000 символов.
- В prompt передаются title, source, message; без лишних PII.
- `response_format: { type: "json_object" }`, `temperature: 0.2`, `max_tokens: 4000`.

### 10.3. Response schema

```json
{
  "summary": "string <= 300",
  "leadScore": 0,
  "category": "business_automation | crm_integration | ai_bot | document_flow | web_app | other",
  "intent": "request | question | complaint | info | other",
  "priority": "LOW | MEDIUM | HIGH | URGENT",
  "scoreBreakdown": {
    "relevance": 0,
    "urgency": 0,
    "budget": 0,
    "contact_completeness": 0,
    "timeline": 0
  },
  "justification": "string <= 1000",
  "factors": [],
  "recommendations": [],
  "risks": [],
  "missingInfo": [],
  "extractedContacts": {
    "name": null,
    "company": null,
    "email": null,
    "phone": null
  }
}
```

`draftReply` возвращается отдельным endpoint `POST /api/ai/generate-reply` как `{ draftReply }`.

Все score — целые 0–100. `leadScore` — эвристика, не вероятность продажи. Zod проверяет enum, диапазоны, длины, максимальные размеры массивов и строк (300/1000/800, max 20 элементов). `extractedContacts` — nullable-поля (`name`, `company`, `email`, `phone`); сервис после Zod-запроса вызывает `filterExtractedContacts(sourceText, extracted)`: для текстовых полей проверяется нормализованное включение в текст заявки, для телефона — совпадение цифровой последовательности. Незафиксированные LLM значения обнуляются до сохранения и ответа.

### 10.4. Retry и timeout

- Один retry только при невалидном JSON/схеме.
- Общий бюджет 60 секунд включая retry; AbortController реально прерывает HTTP.
- При timeout retry не выполняется, если бюджет исчерпан.
- Provider error (non-2xx, network) не ретраится автоматически.
- При повторной ошибке — `AI_INVALID_RESPONSE` / `AI_PROVIDER_ERROR` / `AI_TIMEOUT`.
- Максимум 4000 output tokens.
- Одна запись `AIAnalysis` на каждую попытку; raw prompt/response не сохраняются.

### 10.5. Применение результата

`POST /api/leads/:id/apply-analysis`:

- проверяет `analysisId`, принадлежность Lead/Workspace, status SUCCESS;
- в транзакции обновляет `leadScore`, `scoreBreakdown`, `category`, `intent`, `customerType`, `priority`, `summary`;
- создаёт ActivityLog `lead.ai_applied`;
- не создаёт контакт/задачу автоматически; UI предлагает отдельные явные действия;
- повторное применение того же analysisId возвращает актуальный Lead; ActivityLog создаётся только при фактическом изменении полей (без duplicate log).

### 10.6. Draft reply

- Кнопка «Скопировать» через Clipboard API.
- Кнопка «Открыть в почте» — корректно закодированный `mailto:` (`encodeURIComponent` для адреса, subject, body).
- Кнопки отправки сообщения клиенту нет.
- `generate-reply` возвращает черновик, не сохраняет и не отправляет его.

### 10.7. AI History

`AIAnalysis` хранит provider, model, status, resultJson, tokens, durationMs, errorMessage, promptHash, leadId, createdAt. Полный prompt и rawResponse не хранятся. `GET /api/ai/history?leadId=` возвращает историю с Workspace scope и пагинацией.

## 11. Automation: n8n, HMAC, Telegram

### 11.1. Outbox

- `AutomationEvent` создаётся в транзакции с Lead.
- `idempotencyKey = lead.created:<leadId>`; при retry не меняется.
- Payload: title, priority, category, summary, public URL. Текст заявки и контактные данные не включаются.
- Dispatcher: max 10 событий, lease 5 минут, `FOR UPDATE SKIP LOCKED`, `lockedAt` + `lockToken`.
- Claim SQL сравнивает Prisma `timestamp(3)`-колонки через `AT TIME ZONE 'UTC'`, иначе lease зависит от timezone PostgreSQL-сессии.
- `attempts` увеличивается только при фактическом HTTP-вызове.
- События старше 24 часов → FAILED без отправки.
- `SENT` = n8n принял; `DELIVERED` = Telegram подтверждён callback.
- Lazy invocation: после создания Lead, Dashboard, Settings/Automation, automation API. Eventual-доставка документируется.
- In-memory lock отсутствует; конкурентные dispatcher-вызовы безопасны.

### 11.2. Retry

- 1 первоначальная + максимум 3 автоматические попытки (всего 4 HTTP-вызова).
- Задержки: 1 мин, 5 мин, 30 мин.
- Максимальный возраст 24 часа с `createdAt`.
- Постоянные 4xx (кроме 429) → FAILED. 429 — `max(расписание, Retry-After)`, в пределах лимита попыток и 24 часов.
- Ручной retry ADMIN/MANAGER только для FAILED и до 24 часов; тот же event/idempotencyKey; `attempts` сбрасывается в 0, статус RETRYING.
- После исчерпания — FAILED, причина в `lastError`.

### 11.3. HMAC исходящий

`HMAC-SHA256(N8N_WEBHOOK_SECRET, timestamp + "." + rawBody)`.

`timestamp` — Unix epoch seconds в виде строки; подпись — lowercase hex. `X-BizPilot-Event-Id` = `idempotencyKey`. Headers: `X-BizPilot-Signature`, `X-BizPilot-Timestamp`, `X-BizPilot-Event-Id`. n8n проверяет constant-time и timestamp ±5 минут. Секрет не логируется и не попадает в workflow JSON.

### 11.4. HMAC callback

n8n → BizPilot: `HMAC-SHA256(N8N_CALLBACK_SECRET, timestamp + "." + rawBody)`, headers `X-N8N-Signature`, `X-N8N-Timestamp`. `timestamp` — Unix epoch seconds, подпись — lowercase hex. Секрет должен отличаться от `N8N_WEBHOOK_SECRET`; совпадение отклоняется как misconfiguration. BizPilot читает raw bytes до JSON.parse, проверяет constant-time, окно ±5 минут, Zod payload, идемпотентность по `idempotencyKey`, игнорирует присланный `workspaceId`. Переход DELIVERED → FAILED запрещён; повтор с тем же статусом возвращает `duplicate=true`.

### 11.5. n8n workflow `lead_created_notification`

Файл: `n8n/workflows/lead_created_notification.json`.

**Статус:** DRAFT для импорта. Реальный импорт и Telegram runtime не проверены (BLOCKED: нет n8n/Telegram credentials и Docker). Это явно указано в имени workflow, sticky note и `docs/N8N.md`; файл не выдаётся за экспорт работающего workflow.

Порядок nodes:

1. Webhook (raw body, headers, response node).
2. Code: HMAC + timestamp; invalid → stop до side effect.
3. Postgres: `INSERT INTO n8n_processed (idempotency_key, status) VALUES ($1, 'CLAIMED') ON CONFLICT (idempotency_key) DO NOTHING RETURNING idempotency_key`.
4. Ветка дубликата: `SENT` → повторный callback без Telegram; `CLAIMED < 15 мин` → duplicate; `CLAIMED ≥ 15 мин` → manual reconciliation; `FAILED` → атомарный reclaim `UPDATE ... WHERE status='FAILED'` и повторная отправка.
5. Telegram: сообщение (title, priority, category, summary, link), plain text.
6. Postgres: `status='SENT'`, `processed_at=now()`, `external_event_id`; при ошибке Telegram `FAILED` + безопасный `last_error`.
7. Code: подписанный callback в BizPilot; `$env` для секретов, raw body string для подписи.
8. Error output Telegram → FAILED + callback failed.

Execution data с payload не сохраняется (`saveDataSuccessExecution=none`, `saveDataErrorExecution=none`), чтобы не накапливать персональные данные. Граница гарантии: предотвращаются конкурентные повторы, но нет математического exactly-once для Telegram API. Падение после Telegram до записи SENT оставляет CLAIMED; старше 15 минут — ручная сверка, без автоотправки. At-most-once bias документируется в `docs/N8N.md` и `docs/SECURITY.md`.

### 11.6. Telegram

ENV: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (для n8n/локального compose; в приложении не используются для отправки). Токен хранится в n8n Credential; workflow использует credential и `TELEGRAM_CHAT_ID`. Сообщение: название, приоритет, категория, краткое резюме, ссылка при наличии `APP_BASE_URL`. Только уведомления; приём сообщений отложен.

### 11.7. Интеграции и Settings

Seed: `n8n` и `telegram` со статусом NOT_CONFIGURED. При успешном вызове n8n — ACTIVE + `lastCheckedAt`; при ошибке — ERROR. При callback DELIVERED — telegram ACTIVE; FAILED — ERROR. ACTIVE не выставляется только из-за наличия ENV; если ENV снят, status API показывает NOT_CONFIGURED независимо от исторического значения в БД.

Settings: read-only profile, automation status, integrations status, журнал событий, кнопка ручного retry, logout. Формы изменения секретов/ENV не создаются. OPERATOR видит только profile/logout; automation/integrations sections доступны ADMIN/MANAGER.

### 11.8. Реализованные API и UI этапа 4

- `GET /api/automation/events` — ADMIN/MANAGER, пагинация, lazy dispatcher.
- `GET /api/automation/status` — counts, конфигурация n8n/Telegram, stale CLAIMED, политика retry.
- `POST /api/automation/events/:id/retry` — ADMIN/MANAGER, Origin check, только FAILED, <24h, тот же key; после смены статуса dispatcher пытается отправить событие.
- `POST /api/webhooks/n8n` — HMAC, raw body 64 KB, timestamp ±5 минут, Zod, идемпотентность.
- `/settings` — read-only профиль, n8n/Telegram, политика доставки, журнал с ошибками и временем последней попытки, retry для FAILED.
- Dispatcher вызывается на Dashboard, `/settings`, automation API и после создания Lead.

## 12. Frontend

### 12.1. Маршруты

- `/login`
- `/dashboard` — Overview
- `/leads`, `/leads/[id]`
- `/crm`, `/crm/[id]`
- `/tasks`, `/tasks/[id]`
- `/ai-assistant`
- `/settings`

Группы: `(auth)` и `(dashboard)`. Навигация: Overview, Leads, CRM, Tasks, AI Assistant, Settings. Analytics/Integrations отдельных страниц нет.

### 12.2. Рендеринг

- Server Components по умолчанию; данные через services, не через внутренний fetch.
- Client Components — формы, фильтры, dialogs, charts, clipboard.
- Server Actions — login/logout и узкие серверные действия, где это оправдано; API endpoints остаются обязательными.
- Dashboard/списки динамические (`force-dynamic`/`noStore`), без статической генерации с БД.
- После мутации — `router.refresh()`.

### 12.3. Состояния UI

Обязательны: loading (skeleton), empty, error, success, disabled, permission denied. Ошибки API показываются понятным текстом; 403 — отдельное состояние. Все кнопки рабочие; фиктивных нет.

### 12.4. Дизайн и адаптивность

- Светлый фон, тёмный navy/graphite текст, сдержанные синие акценты.
- Зелёный success, жёлтый warning, красный critical.
- Компактные таблицы, удобные фильтры, чёткая типографика.
- Системный font stack (без сетевой загрузки шрифтов в Docker build).
- shadcn/ui components, Lucide icons.
- Проверка 1440, 1280, 768, 375 px; на мобильных таблицы скроллятся или превращаются в карточки, sidebar — в drawer.
- Тёмная тема не входит в MVP.

### 12.5. Dashboard

- Total Leads — все Lead Workspace.
- New Leads — status NEW.
- Qualified Leads — строго status QUALIFIED (без порога leadScore).
- Conversion Rate — `CONVERTED / (CONVERTED + REJECTED) * 100`; знаменатель 0 → «—»; подпись «Конверсия среди закрытых заявок».
- Pending Tasks — status TODO/IN_PROGRESS.
- Overdue Tasks — dueDate < now и status TODO/IN_PROGRESS.
- Leads by day — последние 14 дней, zero-filled (предположение, ТЗ не задаёт окно).
- Leads by status — groupBy status.
- Demo data banner — если есть Lead с title, начинающимся на `[DEMO]`.
- Lazy dispatcher вызывается при загрузке страницы (max 10, best-effort).

### 12.6. Детали Lead / CRM / Task

- Lead: поля, статус/приоритет, контакт, исполнитель, история, AI-панель (последний анализ, запуск, применение, история, draft reply copy/mailto), кнопки создания контакта/задачи с предзаполнением.
- Contact: поля, связанные Leads/Tasks, история, предупреждение о дублях, удаление с 409-обработкой.
- Task: поля, overdue-индикатор, связи, исполнитель, история.
- Удаление — confirm dialog; OPERATOR не видит кнопку и получает 403 при прямом запросе.

## 13. Безопасность

### 13.1. Обязательные меры

- bcryptjs cost 12; пароли не логируются и не возвращаются.
- Auth.js JWT в httpOnly cookie; `secure` в production; `sameSite=lax`.
- `AUTH_SECRET` только ENV; ротация разлогинивает пользователей (JWT без revocation — известное ограничение).
- Серверная проверка роли и Workspace в каждом сервисе; IDOR/BOLA protection.
- Zod на body/query/params, AI response и webhook payload.
- Rate limiting по группам; 429 + `Retry-After`.
- Body limits с фактическим подсчётом байт; 413.
- CSRF/Origin для cookie-auth mutations; SameSite; Auth.js CSRF.
- HMAC-SHA256 + timestamp ±5 минут + constant-time compare для webhook в обе стороны.
- Replay protection: timestamp window; идемпотентность по `idempotencyKey`; n8n_processed.
- Prisma/параметризованные запросы; raw SQL только tagged template/параметры.
- Секреты только ENV/credentials; `.env` в `.gitignore`; `.env.example` без значений.
- Ошибки клиенту безопасные; stack trace/SQL/секреты/prompt/raw response не раскрываются.
- Логи с redaction: не логировать message, prompt, raw AI response, email/phone, токены.
- AI: маркеры недоверенного ввода, отсутствие tools, серверная Zod-валидация, лимиты длины/токенов/времени.
- n8n: отдельная DB-роль только на `n8n_processed`; секреты в credentials/ENV, не в workflow JSON.

### 13.2. Security review (этап 5)

В `docs/SECURITY.md` заполнена таблица `Проверка | Команда/метод | Результат | Замечания | Статус`:

- `pnpm audit --prod` — 2 high (`zod@3`, `deepmerge-ts@7`); `postcss`/`effect` исправлены overrides;
- secret scan gitleaks по исходникам и всей Git-истории — 0 находок;
- OWASP-oriented проход: IDOR/BOLA (integration-тесты), SQLi, XSS, CSRF, auth bypass, role bypass, rate-limit bypass, HMAC/replay, secret exposure, error handling;
- `.env` в `.gitignore`, примеры без секретов;
- перечень непроверенных runtime-пунктов (Docker, n8n, Telegram) и причин.

Не отмечать PASS, если проверка не выполнялась.

### 13.3. Известные ограничения безопасности MVP

1. Фактически single-tenant; полноценная multi-tenancy отложена.
2. In-memory rate limit: один процесс, сброс при рестарте, нет синхронизации экземпляров.
3. JWT без полноценного revocation.
4. Hard delete.
5. Часть integration-тестов использует mocks.
6. Telegram E2E — ручной тест.
7. Один n8n workflow.
8. Нет OAuth/magic links, CSV, enterprise IAM.
9. Eventual-доставка outbox при отсутствии трафика.
10. n8n 1.x EOL 2026-12-31 (см. раздел 17).
11. Auth.js v5 beta.32: возможны регрессии/breaking changes (см. раздел 17.2).
12. Все три demo-пользователя используют один `SEED_ADMIN_PASSWORD`; пароль не публикуется в README/Git и передаётся только через ENV.

## 14. Деплой

### 14.1. Docker Compose

Сервисы по умолчанию:

- `postgres` — `postgres:16.16-alpine`, healthcheck, volume, порт только `127.0.0.1:5432`.
- `migrate` — builder-образ, `prisma migrate deploy`, зависит от healthy postgres, завершается.
- `app` — runtime-образ, зависит от `migrate` (completed), порт 3000, healthcheck.

Profile `automation`:

- `n8n-db-init` — `postgres:16.16-alpine`, запускается после `migrate`; идемпотентно вызывает `docker/n8n/init-db.sql`, создаёт роли `n8n_app` и `n8n_dedupe`, отзывает доступ `n8n_app` к CRM-БД.
- `n8n` — `n8nio/n8n:1.123.98`, порт только `127.0.0.1:5678`, volume `n8n_data`, отдельная БД `n8n`, Postgres credential `n8n_dedupe` для `bizpilot.n8n_processed`, Telegram credential.
- `n8n` зависит от `n8n-db-init` (completed), `postgres` (healthy), `app` (started).

Команды:

```bash
docker compose up -d --build
docker compose --env-file .env.docker --profile automation up -d
```

Базовый стек не требует n8n-секретов; они обязательны только для профиля `automation`. CRM работает при выключенном n8n: события остаются PENDING/RETRYING, интеграция NOT_CONFIGURED/ERROR.

### 14.2. Dockerfile

- Multi-stage: `deps` → `builder` → `runner`.
- Base `node:24.20.0-bookworm-slim`; `openssl` для Prisma.
- `pnpm install --frozen-lockfile`; `prisma generate`; `next build` с `output: "standalone"`.
- Runner: non-root user, только standalone + static + public + Prisma engine.
- Prisma CLI остаётся в `migrate` (builder target), не в runtime.
- Healthcheck `/api/ai/health` (public, минимальный, без секретов; возвращает `{ status: "ok", configured: boolean }`).

### 14.3. ENV

Обязательные:

- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_URL` (например `http://localhost:3000`)
- `AUTH_TRUST_HOST=true` для Docker/proxy
- `APP_BASE_URL`
- `SEED_ADMIN_PASSWORD`
- `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_TIMEOUT_MS=60000`
- `AI_PROVIDER=openai-compatible` (в тестах `mock` + `ALLOW_MOCK_AI=true`)
- `N8N_WEBHOOK_URL`
- `N8N_WEBHOOK_SECRET`
- `N8N_CALLBACK_SECRET` (обязан отличаться от webhook secret)
- `N8N_TIMEOUT_MS=10000`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (для n8n/compose)
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `N8N_ENCRYPTION_KEY`, `N8N_BASIC_AUTH_USER`, `N8N_BASIC_AUTH_PASSWORD`
- `N8N_DB_NAME`, `N8N_DB_USER`, `N8N_DB_PASSWORD`
- `N8N_DEDUPE_DB_USER`, `N8N_DEDUPE_DB_PASSWORD`
- Только для профиля automation: `N8N_PUBLIC_URL`, `N8N_HOST`, `N8N_TIMEZONE`, `BIZPILOT_BASE_URL`, `NODE_FUNCTION_ALLOW_BUILTIN=crypto`

`BIZPILOT_BASE_URL` — адрес приложения **из контейнера n8n** (`http://app:3000` в Compose или публичный HTTPS). `N8N_WEBHOOK_URL` — адрес webhook n8n **из контейнера приложения** (`http://n8n:5678/webhook/lead-created`).

Секреты генерируются случайно (≥32 байта) и не коммитятся. `.env.example` содержит только имена и пустые заглушки.

### 14.4. Миграции и seed

```bash
pnpm prisma migrate deploy
pnpm prisma db seed
```

В Docker: `migrate` применяет миграции; seed запускается отдельно (`docker compose run --rm migrate pnpm prisma db seed`) и требует `SEED_ADMIN_PASSWORD`. Seed создаёт 1 Workspace, 3 пользователей (все с `SEED_ADMIN_PASSWORD`), 10 контактов, 20 заявок, 15 задач, 2 Integration (NOT_CONFIGURED). Автоматический seed в production не выполняется.

## 15. Тестирование

### 15.1. Unit (Vitest)

- Zod schemas (leads/contacts/tasks/query/AI/webhook).
- AI JSON validation: valid, invalid enum, out-of-range, too long summary/draft.
- Lead scoring/priority rules (clamp, enum).
- Status transitions: допустимые enum, отсутствие AI-мутаций Lead до apply.
- Task business rules: overdue, done/cancelled.
- Role checks и Workspace scope helpers.
- Idempotency key format/stability.
- normalize email/phone (включая 7/8 → +7, пустые).
- Sort allow-list и pagination parsing.
- HMAC constant-time/verify, timestamp window, raw body integrity.
- Body limit helper.
- Automation retry schedule, 24h limit, 429/4xx/5xx classification.
- Callback transition/idempotency, role checks, lease expiry helpers.
- n8n config/secret separation, Retry-After parsing.

### 15.2. Integration (PostgreSQL)

Три обязательные группы:

1. CRUD + Prisma: create/read/update/delete, Workspace isolation, delete rules, duplicate contacts, ActivityLog.
2. AI adapter: valid response, invalid JSON (retry), timeout (AbortController), provider error, token/duration history, no raw prompt storage.
3. n8n/outbox: valid HMAC, invalid signature, stale timestamp, replay, callback idempotency, retry schedule, 4xx/5xx/429, `n8n_processed` atomic dedupe, `FOR UPDATE SKIP LOCKED` claim, lease expiry, concurrent dispatch.

Тесты читают `DATABASE_URL` (локальный PostgreSQL 16) и используют только созданные ими строки с cleanup. В CI должна быть отдельная тестовая БД; production БД для тестов не используется. Реальные n8n/Telegram вызовы в integration-тестах не выполняются (fake client), это фиксируется как BLOCKED для runtime.

### 15.3. E2E (Playwright)

1. Login → Dashboard → создать Lead → найти в списке → связать Contact → создать Task.
2. Заявка → AI-анализ (mock provider) → summary/priority/score/history → явное применение.
3. Auth/role guards: redirect без сессии, API 401, OPERATOR DELETE/automation 403.
4. Responsive UI: Dashboard/Leads/CRM/Tasks/AI/Settings на 1440/1280/768/375 без горизонтального overflow и ошибок консоли.

E2E поднимает dev-сервер и использует `AI_PROVIDER=mock` + `ALLOW_MOCK_AI=true`;
реальный provider не вызывается (только при явном `E2E_REAL_AI=true`). Отчёт и
artifacts сохраняются в CI. Production build проверяется отдельно командой
`pnpm build`.

### 15.4. Реальный AI smoke

`scripts/test-ai.ts` вызывает реальный provider, валидирует общей Zod-схемой, печатает безопасную сводку (category, intent, priority, score, lengths, tokens, duration), без PII/секретов. Запускается вручную; результат фиксируется в `docs/IMPLEMENTATION_PLAN.md`. В CI не запускается.

### 15.5. Telegram

Ручной тест с credentials: n8n workflow → Telegram → callback. В CI `test.skip` с пояснением. Результат — в `docs/N8N.md` и `docs/IMPLEMENTATION_PLAN.md`. На 2026-11-19 runtime BLOCKED: credentials не предоставлены; workflow — draft. Приложение проверено через подписанный callback (`pnpm test:webhook`) без реального Telegram.

### 15.6. CI

`.github/workflows/ci.yml` (push/pull_request): jobs `lint`, `typecheck`, `unit`, `integration` (Postgres service + `migrate deploy`), `build`, `docker` (Compose config/build/up + health, base profile); pnpm frozen lockfile.

`.github/workflows/e2e.yml` (`workflow_dispatch`): Postgres, migrations, seed, Playwright Chromium, upload report/artifacts; mock AI.

CI не вызывает реальный LLM. Docker job использует временный `.env.docker` с
тестовыми значениями; n8n-профиль в CI не запускается.

## 16. Observability и логирование

- Structured JSON logs в stdout.
- Поля: timestamp, level, event, requestId, route, method, status, durationMs, userId?, workspaceId?, errorCode?.
- Request ID — `crypto.randomUUID()`; заголовок `x-request-id` в ответе.
- Не логировать: пароли, hash, токены, HMAC-секреты, AI API key, полный message, prompt, raw AI response, email/phone.
- AI: логировать provider, model, status, duration, tokens, errorCode; не raw body.
- n8n: eventId, idempotencyKey (можно, не секрет), attempt, status, sanitized error.
- Prisma errors маппятся в безопасные коды; stack trace только в серверный лог.
- Health endpoint не раскрывает конфигурацию/секреты.

## 17. Риски, предположения и открытые вопросы

### 17.1. Блокеры окружения

1. **Docker и Docker Compose не установлены локально.** `docker` отсутствует в PATH; Docker Desktop/WSL2 не установлены. Compose runtime локально не проверен; проверка добавлена в CI job `docker`. Требуется решение пользователя для локальной Docker-приёмки.
2. **Локальный PostgreSQL 16 работает** и используется для миграций, seed, API, integration- и E2E-проверок. `psql` в PATH может отсутствовать, но сервер доступен по `DATABASE_URL`.
3. **8 GB RAM.** Docker Desktop + PostgreSQL + n8n + Next build могут быть медленными; риск таймаутов, не блокер.
4. **`pnpm audit --prod`:** 2 high остаются (`zod@3`, транзитивный `deepmerge-ts`); исправления требуют major-обновлений и согласования. `postcss` и `effect` исправлены overrides.

### 17.2. Риски версий

1. **Auth.js v5 beta.** Stable v5 нет; используется `5.0.0-beta.32`. Возможны регрессии/breaking changes. Митигация: точная фиксация, тесты login/roles, изоляция конфигурации.
2. **n8n 1.x EOL 2026-12-31.** Baseline ТЗ — image `1`; зафиксирован `1.123.98`. Официально поддержка 1.x заканчивается 31.12.2026; текущая линия 2.x, 3.0 stable ожидается в начале декабря 2026. Для демо в 2026 году 1.x ещё работает, но после EOL не получает патчей. Нужно решение: остаться на 1.123.98 по ТЗ или согласовать 2.x/3.x (потребует проверки workflow/Code node/env defaults).
3. **Next.js 15 при актуальном Next 16.** Baseline ТЗ — 15; используется последняя 15.5.29. Не обновлять без согласования.
4. **TypeScript 5.9.3, не 7.x.** TS 7 не входит в baseline и не валидировался с Next 15/eslint-config-next 15.
5. **pnpm 9.15.9 при глобальном 12.16.1.** Проект фиксирует 9.15.9 через `packageManager`/Corepack; глобальная версия не должна использоваться для install.
6. **shadcn CLI 4.23.0 ориентирован на новые версии Tailwind.** Компоненты будут вендориться вручную в Tailwind 3-совместимом виде; CLI не должен переписывать конфигурацию на Tailwind 4.

### 17.3. Предположения, требующие подтверждения (низкий риск)

1. `ContactStatus = NEW | ACTIVE | INACTIVE` — ТЗ не задаёт значения.
2. `AIAnalysisStatus = SUCCESS | FAILED` — ТЗ не задаёт значения.
3. `Lead.source` — свободный текст; значения не заданы.
4. Dashboard «New Leads» = status NEW; окно графика «Leads by day» = 14 дней; Pending Tasks = TODO + IN_PROGRESS.
5. `POST /api/leads/:id/apply-analysis` — endpoint добавлен, так как 24.5 требует кнопку «Применить результат», но endpoint в списке 11 отсутствует.
6. Apply AI обновляет только поля из 24.5; контакт/задача создаются отдельными явными действиями пользователя (без автоматического merge).
7. Session maxAge 8 часов — ТЗ не задаёт.
8. `GET /api/ai/health` возвращает минимальный `{ status: "ok", configured: boolean }`, без provider/model/секретов.
9. `Lead.message` ограничен 20 000 символов в Zod (body limit 256 KB — не то же самое, что контекст LLM).
10. `scoreBreakdown` хранится как JSON с ключами AI-схемы; отображение — 5 прогресс-баров.
11. Строгий граф переходов Lead/Task status не задан. MVP валидирует enum и не позволяет AI менять `status`; если нужен строгий граф — требуется согласование.
12. **n8n_processed FAILED vs manual retry — решено на этапе 4.** Основной механизм остаётся `INSERT ... ON CONFLICT DO NOTHING RETURNING` (ТЗ 24.12). После конфликта workflow читает статус и только для `FAILED` выполняет атомарный `UPDATE ... WHERE status='FAILED'` (reclaim) перед повторной отправкой. `SENT` и `CLAIMED` не переотправляются автоматически; `CLAIMED` старше 15 минут требует ручной сверки. Это сохраняет требование 24.12 и делает ручной retry (24.13) рабочим. Проверено unit/integration-тестами и SQL-тестами на реальном PostgreSQL; runtime n8n — BLOCKED.
13. **Время последней попытки в UI.** Отдельное поле `lastAttemptAt` не добавлялось: `AutomationEvent.updatedAt` обновляется при claim/retry/смене статуса и отображается как «время последней попытки». Это не меняет схему ТЗ.

### 17.4. Что потребуется от пользователя позже

- Docker Desktop + WSL2 или локальный PostgreSQL 16 (этап 1).
- AI credentials: `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` (этап 3).
- n8n/Telegram credentials и chat_id (этап 4).
- Решение по n8n 1.x vs 2.x/3.x (до этапа 4).
- GitHub remote и CI secrets (этап 5, если публикация).

## 18. Журнал архитектурных решений

| Дата       | Решение                                                            | Причина                                                                  |
| ---------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 2026-11-19 | Три слоя без `domain/`                                             | ТЗ 24.2                                                                  |
| 2026-11-19 | Workspace scope через пользователя из БД                           | ТЗ 10, 24.9; защита от подмены workspaceId                               |
| 2026-11-19 | Outbox + lazy dispatcher + DB lease                                | ТЗ 24.11; надёжность без worker/cron                                     |
| 2026-11-19 | n8n_processed через SQL-миграцию                                   | ТЗ 24.12; атомарный dedupe                                               |
| 2026-11-19 | Два HMAC-секрета и две схемы                                       | ТЗ 24.10; разделение входящего/исходящего доверия                        |
| 2026-11-19 | AIAnalysis на каждую попытку                                       | ТЗ 8.3/8.5; история успешных и неуспешных попыток                        |
| 2026-11-19 | apply-analysis отдельным endpoint                                  | ТЗ 24.5; нет endpoint в списке 11                                        |
| 2026-11-19 | Contact/ Task создаются отдельными действиями после apply          | 24.5 перечисляет только поля Lead + ActivityLog; избегаем неявного merge |
| 2026-11-19 | Auth.js 5.0.0-beta.32                                              | Единственная опубликованная v5; ТЗ требует v5                            |
| 2026-11-19 | n8n 1.123.98                                                       | Baseline ТЗ; EOL риск зафиксирован                                       |
| 2026-11-19 | Outbox claim через `FOR UPDATE SKIP LOCKED` + `AT TIME ZONE 'UTC'` | Lease не зависит от timezone PostgreSQL-сессии; проверено real DB        |
| 2026-11-19 | n8n_processed: DO NOTHING + reclaim только FAILED                  | Совместимо с 24.12 и делает ручной retry 24.13 рабочим                   |
| 2026-11-19 | `n8n-db-init` под profile `automation`                             | Роли/права не требуются базовому стеку; init идемпотентен                |
| 2026-11-19 | n8n workflow помечен DRAFT                                         | Нет runtime n8n/Telegram; запрещено выдавать за проверенный экспорт      |
| 2026-11-19 | shadcn/ui вендорится под Tailwind 3                                | Baseline Tailwind 3; CLI 4.x может тянуть Tailwind 4                     |

## 19. Источники проверки версий

- npm registry (`npm view`) — 2026-11-19: next, react, prisma, @prisma/client, zod, tailwindcss, pnpm, typescript, vitest, @playwright/test, next-auth, radix, recharts, lucide-react, react-hook-form, @hookform/resolvers, bcryptjs, eslint, eslint-config-next, prettier, tsx, @types/*, postcss, autoprefixer.
- Auth.js installation docs: https://authjs.dev/getting-started/installation?framework=next.js — `next-auth@beta`; npm dist-tags `beta=5.0.0-beta.32`, `latest=4.24.15`.
- n8n release notes: https://docs.n8n.io/release-notes/ — текущая линия 2.x (npm latest 2.48.5 на 2026-11-19), 3.0 stable ожидается в начале декабря 2026; 1.x support ends 2026-12-31 (n8n blog v3 announcement: https://blog.n8n.io/introducing-n8n-v3/).
- Docker Hub API: `postgres:16.16-alpine`, `node:24.20.0-bookworm-slim`, `n8nio/n8n:1.123.98`.
- Node.js 24.20.0 — LTS Krypton (`node -p process.release.lts`).
- Локальное окружение: Windows 10 Pro 19045, 8 GB RAM, 187 GB free, Node 24.20.0, pnpm 12.16.1, npm 11.19.0, Git 2.56.0, локальный PostgreSQL 16 запущен, Docker отсутствует, WSL отсутствует.

## 20. Связанные документы

- `AGENTS.md` — правила работы.
- `docs/IMPLEMENTATION_PLAN.md` — этапы, статусы, проверки, блокеры.
- `docs/API.md` — endpoints, envelope, automation/webhook, ошибки.
- `docs/SECURITY.md` — модель безопасности, проверки, audit, ограничения.
- `docs/DEPLOYMENT.md` — Docker, ENV, миграции, seed.
- `docs/N8N.md` — workflow, HMAC, dedupe, Telegram, retry, диагностика.
