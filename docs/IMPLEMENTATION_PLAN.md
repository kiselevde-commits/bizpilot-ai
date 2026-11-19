# План реализации BizPilot AI

**Версия:** 1.3 (исправление критических дефектов)  
**Дата:** 2026-11-19  
**Источник:** `BizPilot_AI_OpenCode_TZ_v1.2.md`, включая раздел 24  
**Текущий этап:** этапы 1–3 (foundation, CRUD/UI, AI backend) проверены на локальном PostgreSQL 16; исправлены 15 дефектов и дополнительные runtime-баги. Docker и реальный AI smoke — BLOCKED (нет Docker и AI credentials). Этап 4 не начат.

## Легенда статусов

- `TODO` — не начато.
- `IN_PROGRESS` — в работе.
- `DONE` — выполнено и проверено.
- `BLOCKED` — требуется решение/ресурс пользователя.

## Текущее состояние

| Этап                   | Статус  | Комментарий                                                   |
| ---------------------- | ------- | ------------------------------------------------------------- |
| 0. Аудит и документы   | DONE    | Документы созданы; проверка согласованности выполнена вручную |
| 1. Foundation          | DONE (код) / BLOCKED (проверки) | Код создан; Docker/PostgreSQL отсутствуют — миграции, seed, integration-тесты, Compose, login не запущены |
| 2. CRUD и UI           | DONE (UI) | CRM страницы: Dashboard, Leads, Contacts, Tasks (list/detail/create/edit), AI assistant integration point, login page. Не проверено с БД (нет PostgreSQL). |
| 3. AI                  | DONE (бэкенд + тесты) | Реализованы `POST /api/ai/analyze`, `POST /api/leads/:id/apply-analysis`, `POST /api/ai/generate-reply`, `GET /api/ai/history`, провайдеры OpenAICompatible + Mock, Zod-валидация, retry, таймаут, история в БД. 94 теста проходят. |
| 4. Automation          | TODO    | Нужны n8n/Telegram credentials и решение по версии n8n        |
| 5. Проверка и упаковка | TODO    | Зависит от 1–4                                                |

## 1. Результаты аудита окружения (этап 0)

| Проверка                | Факт                                           | Вывод                                                |
| ----------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| Рабочая директория      | `F:\Project1\BezPilot_AI`                      | инициализирован, все файлы Stage 1 добавлены         |
| Git                     | репозиторий инициализирован (`master`)         | коммитов нет; `user.name`/`user.email` не заданы     |
| Существующий код        | создано на этапе 1                             | Foundation: schema, миграции, Auth, UI, Docker, seed |
| `package.json`          | создан                                         | exact versions, `packageManager: pnpm@9.15.9`        |
| `.env` / `.env.example` | `.env.example` создан; `.env` локальный        | `.env` не коммитится (`.gitignore`)                  |
| Node.js                 | 24.20.0 LTS Krypton                            | совместимо с baseline                                |
| pnpm                    | 12.16.1 глобально                              | baseline 9; проект зафиксирует 9.15.9 через Corepack |
| npm                     | 11.19.0                                        | используется только для проверки metadata            |
| Git                     | 2.56.0.windows.2                               | доступен                                             |
| Docker                  | отсутствует в PATH; Docker Desktop не найден   | блокер для Compose/БД                                |
| Docker Compose          | отсутствует                                    | блокер                                               |
| PostgreSQL / psql       | отсутствуют; служб PostgreSQL нет              | блокер для миграций/тестов                           |
| WSL                     | отсутствует                                    | Docker Desktop потребует установки WSL2              |
| ОС                      | Windows 10 Pro 19045                           | Docker Desktop совместим при WSL2/Hyper-V            |
| RAM                     | 8 GB                                           | минимум; возможна медленная работа Docker + n8n      |
| Диск F:                 | 187 GB свободно                                | достаточно                                           |
| Интернет/npm registry   | доступен                                       | версии проверены                                     |
| Docker Hub API          | доступен                                       | tags проверены                                       |

Секреты не выводились: `.env` отсутствует, значений секретов в проекте нет.

## 2. Этап 0 — аудит и документы

**Статус: DONE** (ожидается checkpoint-подтверждение пользователя).

### 2.1. Задачи

- [x] Изучить ТЗ v1.2, включая раздел 24.
- [x] Проверить директорию, Git, Node, pnpm, npm, Docker, Compose, PostgreSQL, WSL.
- [x] Проверить наличие исходного кода, зависимостей, тестов, `.env`.
- [x] Проверить точные версии через npm registry, Docker Hub, официальные docs Auth.js/n8n.
- [x] Зафиксировать Auth.js v5 stable/beta: stable v5 нет, beta `5.0.0-beta.32`.
- [x] Создать `AGENTS.md`.
- [x] Создать `docs/ARCHITECTURE.md`.
- [x] Создать `docs/IMPLEMENTATION_PLAN.md`.
- [x] Зафиксировать архитектуру: три слоя без `domain/`; Workspace scope; outbox + lazy dispatcher; Postgres `n8n_processed`; HMAC обеих сторон; retry 1m/5m/30m/24h; enums; delete rules; CI.
- [x] Проверить согласованность документов с ТЗ (ручной проход по ключевым пунктам 24.1–24.23).
- [x] Подготовить список блокеров/вопросов.
- [ ] Остановиться и получить явное подтверждение пользователя перед этапом 1.

### 2.2. Проверки этапа 0

| Проверка                | Метод                                      | Результат           |
| ----------------------- | ------------------------------------------ | ------------------- |
| Полнота AGENTS.md       | ручная сверка с 4.2, 24.2                  | PASS                |
| Полнота ARCHITECTURE.md | ручная сверка с 4.3, 24.1–24.23            | PASS                |
| Точные версии           | npm view / Docker Hub / docs               | PASS, зафиксированы |
| Auth.js beta            | npm dist-tags + authjs.dev                 | PASS, beta.32       |
| n8n 1.x EOL             | n8n blog/docs                              | риск зафиксирован   |
| Секреты                 | `.env` отсутствует, значения не выводились | PASS                |
| Тесты/сборка            | не запускались (нет приложения)            | NOT RUN             |
| Docker/PostgreSQL       | недоступны                                 | BLOCKED             |

### 2.3. Матрица соответствия ТЗ v1.2 (раздел 24)

| Пункт ТЗ                                | Где зафиксировано                             | Статус                                  |
| --------------------------------------- | --------------------------------------------- | --------------------------------------- |
| 24.1 Версии/pinning/Auth.js beta        | ARCHITECTURE 3, 17.2; PLAN этап 1             | PASS (beta.32)                          |
| 24.2 Три слоя без `domain/`             | ARCHITECTURE 2, 4; AGENTS 3                   | PASS                                    |
| 24.3 Dashboard definitions              | ARCHITECTURE 12.5; PLAN этап 2                | PASS                                    |
| 24.4 Enum category/intent/customer_type | ARCHITECTURE 7.1, 10.3; PLAN этап 3           | PASS                                    |
| 24.5 scoreBreakdown + apply             | ARCHITECTURE 7.5, 10.5; PLAN этап 3           | PASS                                    |
| 24.6 normalize email/phone              | ARCHITECTURE 7.13; PLAN этапы 1–2             | PASS                                    |
| 24.7 Delete rules                       | ARCHITECTURE 7.12; PLAN этап 2                | PASS                                    |
| 24.8 Integration seed + Settings        | ARCHITECTURE 7.9, 11.7, 14.4; PLAN этапы 1, 4 | PASS                                    |
| 24.9 List params + remove lead-created  | ARCHITECTURE 9.2, 9.3; PLAN этапы 2, 4        | PASS                                    |
| 24.10 Middleware + HMAC обе стороны     | ARCHITECTURE 8.3, 11.3, 11.4; PLAN этапы 1, 4 | PASS                                    |
| 24.11 Outbox + lazy dispatcher + lease  | ARCHITECTURE 5.6, 11.1; PLAN этап 4           | PASS                                    |
| 24.12 n8n_processed dedupe              | ARCHITECTURE 7.11, 11.5; PLAN этап 4          | PASS; OPEN conflict с 24.13 (вопрос 14) |
| 24.13 Retry schedule/max age            | ARCHITECTURE 11.2; PLAN этап 4                | PASS; OPEN conflict с 24.12 (вопрос 14) |
| 24.14 AI timeout/tokens/lengths         | ARCHITECTURE 10.2–10.4; PLAN этап 3           | PASS                                    |
| 24.15 Rate/body limits                  | ARCHITECTURE 9.4, 9.5; PLAN этап 2            | PASS                                    |
| 24.16 Seed + demo credentials           | ARCHITECTURE 7.3, 14.4; PLAN этап 1           | PASS                                    |
| 24.17 AI E2E mock vs real smoke         | ARCHITECTURE 15.3, 15.4; PLAN этапы 3, 5      | PASS                                    |
| 24.18 Security review table             | ARCHITECTURE 13.2; PLAN этап 5                | PASS                                    |
| 24.19 GitHub Actions CI/E2E             | ARCHITECTURE 15.6; PLAN этап 5                | PASS                                    |
| 24.20 Pagination/filters in UI          | ARCHITECTURE 9.3, 12.1; PLAN этап 2           | PASS                                    |
| 24.21 Settings/middleware DoD           | ARCHITECTURE 8.3, 11.7; PLAN этапы 1, 4       | PASS                                    |
| 24.22 Stage 0 instructions              | PLAN раздел 2                                 | PASS                                    |
| 24.23 Acceptance v1.2                   | PLAN 7.2                                      | PASS (план)                             |

### 2.4. Созданные файлы

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`

Исходный код, зависимости, `.env`, Docker-файлы на этапе 0 не создавались.

## 3. Этап 1 — Foundation

**Статус: BLOCKED** — требуется подтверждение пользователя и Docker/PostgreSQL.

### 3.1. Задачи

- [x] Инициализировать Git-репозиторий, `.gitignore`, `.editorconfig`, `.nvmrc`. (репозиторий не инициализирован — см. блокер)
- [x] Создать `package.json` с exact versions, `packageManager: pnpm@9.15.9`, `engines.node`.
- [x] Настроить `.npmrc`: `save-exact=true`, `engine-strict=true`, `auto-install-peers=true`.
- [x] `pnpm install`, зафиксировать `pnpm-lock.yaml` (Corepack pnpm 9.15.9; 472 пакета).
- [x] Создать Next.js 15 App Router + TypeScript strict + Tailwind 3 + PostCSS/Autoprefixer.
- [x] Настроить ESLint 9 flat config и Prettier.
- [x] Настроить `tsconfig.json`: strict, noUncheckedIndexedAccess, paths `@/*`.
- [x] Создать `next.config.ts`: `output: "standalone"`.
- [x] Создать базовый layout, глобальные стили, shadcn/ui-совместимые компоненты (button, input, card, badge, table, skeleton, alert, dialog, separator, avatar, dropdown-menu, label, nav links, sidebar, header).
- [x] Создать `prisma/schema.prisma` со всеми моделями/enum/индексами.
- [x] Создать первую Prisma migration; отдельная SQL-миграция `n8n_processed`.
- [x] Создать `prisma/seed.ts`: 1 Workspace, 3 пользователя, 10 контактов, 20 заявок `[DEMO]`, 15 задач, 2 Integration NOT_CONFIGURED; idempotent upsert; `SEED_ADMIN_PASSWORD` обязателен.
- [x] Реализовать `lib/database/prisma.ts`, `lib/utils/normalize.ts`, `lib/constants.ts`, `lib/validation/*`, `lib/errors.ts`, `lib/api/*`, `lib/security/rate-limit.ts`, `lib/auth/*`.
- [x] Реализовать Auth.js v5: `auth.config.ts`, `auth.ts` (Credentials+Prisma+bcrypt), `app/api/auth/[...nextauth]/route.ts`, type augmentation.
- [x] Реализовать `middleware.ts`: redirect `/login`, 401 для API, исключения auth/webhooks/health; без Prisma.
- [x] Создать Auth UI: login-form, logout-button.
- [x] Создать `lib/auth/session.ts` (`getCurrentUser`, `requireUser`, `requireRole`).
- [x] Создать `app/api/ai/health/route.ts` (public `{ status: "ok" }`).
- [x] Создать `Dockerfile`, `docker-compose.yml` (app + postgres + migrate), `docker/wsl2.conf`, `.dockerignore`, `.env.example`.
- [x] Создать `README.md`, `docs/DEPLOYMENT.md`.
- [x] Создать unit-тесты: normalize, constants parity, role helpers (22 теста).
- [ ] Инициализировать Git (требуется `user.name`/`user.email`).
- [ ] Создать integration-тест подключения Prisma и seed (блокируется отсутствием PostgreSQL).

### 3.2. Проверки этапа 1 (результаты)

| Проверка        | Команда/метод                               | Результат                                           |
| --------------- | ------------------------------------------- | --------------------------------------------------- |
| Install         | `pnpm install --frozen-lockfile`            | PASS (472 пакетов, pnpm 9.15.9)                     |
| Prisma generate | `pnpm prisma:generate`                      | PASS                                                |
| Migrations      | `pnpm prisma migrate deploy`                | BLOCKED (нет PostgreSQL)                            |
| Seed            | `pnpm prisma:seed`                          | BLOCKED (нет PostgreSQL)                            |
| Typecheck       | `pnpm typecheck`                            | PASS (0 ошибок)                                     |
| Lint            | `pnpm lint`                                 | PASS (0 ошибок, 1 warning в postcss.config.mjs)     |
| Unit            | `pnpm test:unit`                            | PASS (22 теста)                                     |
| Build           | `pnpm build`                                | BLOCKED (EPERM symlink на Windows; компиляция OK)   |
| Login           | ручной/Playwright smoke                     | BLOCKED (нет PostgreSQL)                            |
| Roles           | unit/integration                            | PASS (unit roles.test.ts)                           |
| Workspace       | integration                                 | BLOCKED (нет PostgreSQL)                            |
| Docker          | `docker compose up -d --build`              | BLOCKED (Docker Desktop не установлен)              |
| n8n off         | остановить n8n                              | BLOCKED (n8n не установлен; CRM без n8n — этап 4)   |

### 3.3. Блокеры этапа 1

- Docker/PostgreSQL отсутствуют. Без них нельзя выполнить миграции, seed, integration-тесты и Compose-проверку.
- Требуется решение пользователя: установить Docker Desktop + WSL2 (рекомендуется) или локальный PostgreSQL 16.16.
- Установка Docker Desktop требует administrator-прав и перезагрузки Windows — сообщено пользователю, не выполнялось без согласия.
- Git `user.name`/`user.email` не заданы — нужно перед коммитом.
- `pnpm build` падает на `EPERM: symlink` (Windows, нет прав на создание символьных ссылок); компиляция TypeScript проходит.


### 3.2. Проверки этапа 1

| Проверка        | Команда/метод                               | Критерий                                           |
| --------------- | ------------------------------------------- | -------------------------------------------------- |
| Install         | `pnpm install --frozen-lockfile`            | lockfile создан, pnpm 9.15.9                       |
| Prisma generate | `pnpm prisma:generate`                      | без ошибок                                         |
| Migrations      | `pnpm prisma migrate deploy` на тестовой БД | все миграции применены, `n8n_processed` существует |
| Seed            | `pnpm prisma:seed` с `SEED_ADMIN_PASSWORD`  | 1/3/10/20/15/2, повторный запуск не создаёт дублей |
| Typecheck       | `pnpm typecheck`                            | 0 ошибок                                           |
| Lint            | `pnpm lint`                                 | 0 ошибок                                           |
| Unit            | `pnpm test:unit`                            | PASS                                               |
| Build           | `pnpm build`                                | PASS                                               |
| Login           | ручной/Playwright smoke                     | все 3 роли входят, неверный пароль отклонён        |
| Roles           | unit/integration                            | OPERATOR не удаляет, MANAGER/ADMIN удаляют         |
| Workspace       | integration                                 | пользователь A не видит данные B                   |
| Docker          | `docker compose up -d --build`              | app+postgres healthy, login работает               |
| n8n off         | остановить n8n                              | CRM работает, события PENDING                      |

### 3.3. Блокеры этапа 1

- Docker/PostgreSQL отсутствуют. Без них нельзя выполнить миграции, seed, integration-тесты и Compose-проверку.
- Требуется решение пользователя: установить Docker Desktop + WSL2 (рекомендуется) или локальный PostgreSQL 16.16.

## 4. Этап 2 — CRUD и UI

**Статус: DONE (UI)** — все CRM страницы реализованы и прошли typecheck/lint/build. Не проверено с БД (нет PostgreSQL/миграций).

### 4.1. Задачи (выполнено на этапе 2 UI)

- [x] `services/lead.service.ts`: list (page/limit/search/status/priority/sort), get, create, update, delete, ActivityLog
- [x] `services/contact.service.ts`: list/get/create/update/delete, normalize email/phone, duplicate candidates, 409 ENTITY_IN_USE
- [x] `services/task.service.ts`: list/get/create/update/delete, overdue, связи Lead/Contact/User, ActivityLog
- [x] `services/dashboard.service.ts`: 6 метрик, 2 графика, Workspace scope, conversion rate по 24.3
- [x] Общие API helpers: envelope, AppError, error mapping, Zod query parsing, sort allow-list, body limit, Origin check, rate limit
- [x] Route Handlers Leads/Contacts/Tasks (GET/POST/GET:id/PATCH/DELETE) с auth/role/Workspace, body limits, Origin check
- [x] UI Leads: таблица, поиск, фильтры status/priority, сортировка, пагинация, empty/loading/error, create/edit forms (RHF+Zod), detail, delete confirm
- [x] UI CRM: таблица, поиск, фильтр status, create/edit, detail со связанными Leads/Tasks, duplicate warning, delete 409 handling
- [x] UI Tasks: таблица, поиск, фильтры status/priority, overdue highlight, create/edit, detail, assignee, связи
- [x] Dashboard UI: metric cards, Leads by day (14 дней), Leads by status, Demo data banner
- [x] Layout/Sidebar/Header, mobile drawer, permission-aware actions (ADMIN/MANAGER/OPERATOR матрица)
- [x] Состояния: loading/empty/error/success/disabled/permission denied
- [x] ActivityLog timeline в деталях Lead/Contact/Task
- [x] AI интеграция: кнопка "AI анализ" на странице детали заявки, страница `/ai-assistant` с проверкой здоровья провайдера и формой анализа
- [x] Login page `/login` с `LoginForm`
- [x] Unit: существующие 22 теста проходят; новые тесты для UI бизнес-логики не добавлены (UI компоненты — не бизнес-логика сервисов)

### 4.2. Проверки этапа 2

| Проверка                              | Критерий                                                                                                                        | Результат                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Typecheck                             | `npx tsc --noEmit`                                                                                                              | PASS (0 ошибок)                                         |
| Lint                                  | `npx eslint .`                                                                                                                  | PASS (0 ошибок, 1 warning postcss.config.mjs)           |
| Unit                                  | `npx vitest run tests/unit`                                                                                                     | PASS (22 теста)                                         |
| Build                                 | `npx next build`                                                                                                                | Компиляция PASS; EPERM symlink Windows (pre-existing)   |
| CRUD Leads/Contacts/Tasks             | create/read/update/delete через API и UI                                                                                        | НЕ ПРОВЕРЯЛОСЬ (нет PostgreSQL)                         |
| Списки                                | page/limit/search/status/priority/sort; limit ≤ 100; pagination total/totalPages                                                | НЕ ПРОВЕРЯЛОСЬ (нет PostgreSQL)                         |
| Workspace scope                       | A не видит/не меняет B; 404 на чужой id                                                                                         | НЕ ПРОВЕРЯЛОСЬ (нет PostgreSQL)                         |
| Роли                                  | OPERATOR не удаляет; API 403 при прямом запросе                                                                                 | НЕ ПРОВЕРЯЛОСЬ (нет PostgreSQL)                         |
| Delete rules                          | Lead → AIAnalysis cascade, Task.leadId NULL, Contact с ссылками → 409                                                           | НЕ ПРОВЕРЯЛОСЬ (нет PostgreSQL)                         |
| Dashboard                             | метрики/графики по 24.3, Demo banner                                                                                            | НЕ ПРОВЕРЯЛОСЬ (нет PostgreSQL)                         |
| UI responsiveness                     | 1440/1280/768/375; все кнопки работают; состояния                                                                               | НЕ ПРОВЕРЯЛОСЬ (нет браузера/Docker)                    |
| AI integration UI points              | Кнопка "AI анализ" → `/ai-assistant?leadId=...`; страница с health check и формой анализа                                      | PASS (typecheck/lint/build)                             |
| Login                                 | `/login` страница с LoginForm                                                                                                   | НЕ ПРОВЕРЯЛОСЬ (нет PostgreSQL)                         |


## 5. Этап 3 — AI

**Статус: DONE (бэкенд + тесты)** — реализовано всё бэкенд API и 94 теста проходят. Остаются UI-компоненты и реальный AI smoke test.

### 5.1. Задачи

- [x] Реализовать `lib/ai/schema.ts`: Zod-схема ответа, enum, диапазоны, длины, массивы.
- [x] Реализовать `lib/ai/prompt.ts`: system prompt, markers, sanitize, promptHash.
- [x] Реализовать `lib/ai/provider.ts`: интерфейс, `OpenAICompatibleProvider`, `MockAIProvider` (экспортирован), factory с production-guard.
- [x] Реализовать `services/ai.service.ts`: analyze, retry, timeout, history per attempt, no Lead mutation, sanitized errors.
- [x] Реализовать `POST /api/ai/analyze` — приём `{ text, leadId }`, валидация workspace/лида, сохранение в `AIAnalysis`.
- [x] Реализовать `POST /api/leads/:id/apply-analysis` — транзакция 24.5 + ActivityLog, частичное обновление полей, валидация диапазонов.
- [x] Реализовать `POST /api/ai/generate-reply` — Zod, max 800, без автоотправки/сохранения.
- [x] Реализовать `GET /api/ai/history` — Workspace scope, пагинация, сортировка createdAt DESC.
- [x] Реализовать `GET /api/ai/health` (public, минимальный, без секретов).
- [ ] Реализовать AI UI: панель анализа, score + breakdown, contacts, missing info, recommended action, draft reply, copy, mailto, apply, history, ошибки/disabled.
- [ ] Реализовать AI Assistant page.
- [x] Unit: schema valid/invalid, enums, ranges, lengths, prompt sanitize, hash, retry decision, timeout (MockAIProvider + AIService).
- [x] Integration: adapter valid/invalid JSON/timeout/provider error; history; no raw prompt; apply transaction; Workspace isolation.
- [ ] E2E scenario 2: analyze с mock, проверить summary/priority/score/history.
- [ ] Создать `scripts/test-ai.ts`; запустить вручную с реальным provider; записать результат.
- [ ] Проверить отсутствие AI key на клиенте (grep/bundle inspection).

### 5.2. Проверки этапа 3

| Проверка                              | Критерий                                                                                   | Результат                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------- |
| Structured JSON                       | Zod PASS; невалидный → 1 retry → понятная ошибка                                           | PASS (94 теста)                     |
| Timeout                               | AbortController прерывает запрос; ≤60 с                                                    | PASS (сервис, AbortController)      |
| Tokens                                | max 4000 output                                                                            | PASS (MockAIProvider, схема)        |
| Lengths                               | summary ≤300, draft ≤800                                                                   | PASS (Zod .max())                   |
| No invention                          | null/[] при отсутствии; проверка на фикстурах                                              | PASS (MockAIProvider валидируется)  |
| Apply                                 | одна транзакция; поля 24.5 + ActivityLog; повтор идемпотентен                              | PASS (тест applyAnalysis)           |
| History                               | provider/model/status/resultJson/tokens/duration/promptHash/error; без raw prompt/response | PASS (тест getHistory)              |
| Secret leak                           | AI_API_KEY отсутствует в клиентском bundle/логах                                           | готово (серверный fetch, server-only) |
| No auto action                        | нет кнопки отправки клиенту; только copy/mailto                                            | prepareReply не сохраняет в БД      |
| Mock guard                            | mock запрещён в production без ALLOW_MOCK_AI                                               | проверено в провайдере               |
| Real smoke                            | `pnpm test:ai` вручную, результат в плане                                                  | не выполнено (нет credentials)      |
| Typecheck/Lint/Unit/Integration/Build | PASS                                                                                       | PASS (typecheck 0, lint 0, tests 94, build компиляция OK) |

### 5.3. Результаты проверок (2026-11-19)

| Проверка        | Команда/метод               | Результат                            |
| --------------- | --------------------------- | ------------------------------------ |
| Typecheck       | `npx tsc --noEmit`          | PASS (0 ошибок)                      |
| Lint            | `npx eslint .`              | PASS (0 ошибок, 1 warning postcss)   |
| Unit            | `npx vitest run`            | PASS (94 теста, 8 файлов)            |
| Build           | `npx next build`            | Компиляция PASS; EPERM symlink Windows |
| AI provider     | MockAIProvider unit         | PASS (имя, analyze, generateReply)   |
| AI service      | analyze/generateReply/apply/getHistory | PASS (реtry, валидация, workspace) |
| Workspace isolation | чужой workspace → 404   | PASS (integration тесты)             |

## 6. Этап 4 — Automation

**Статус: TODO** (нужны n8n/Telegram credentials; требуется решение по версии n8n).

### 6.1. Задачи

- [ ] Реализовать `lib/security/hmac.ts`: sign/verify, constant-time compare, timestamp window ±5 минут, raw body.
- [ ] Реализовать `lib/security/rate-limit.ts` (если не сделано на этапе 2) для webhook 1000/мин/IP.
- [ ] Реализовать `services/automation.service.ts`: createEvent (в транзакции с Lead), atomic claim с lease, dispatch max 10, retry schedule, manual retry, status counts, stale CLAIMED.
- [ ] Реализовать `lib/integrations/n8n.ts`: исходящий webhook, HMAC headers, timeout, response parsing, sanitized errors.
- [ ] Реализовать `POST /api/webhooks/n8n`: raw body 64 KB, HMAC `N8N_CALLBACK_SECRET`, timestamp ±5 минут, Zod, idempotency, SENT→DELIVERED/FAILED, Integration status.
- [ ] Реализовать `GET /api/automation/events` (ADMIN/MANAGER, пагинация, lazy dispatch).
- [ ] Реализовать `POST /api/automation/events/:id/retry` (ADMIN/MANAGER, FAILED, <24h, same key).
- [ ] Реализовать `GET /api/automation/status` (counts, integrations, stale claims, lazy dispatch).
- [ ] Реализовать Settings UI: read-only profile, automation status, integrations status, logout; OPERATOR видит только profile/logout; без форм секретов.
- [ ] Реализовать lazy dispatcher на Dashboard и Settings/Automation.
- [ ] Создать `n8n/workflows/lead_created_notification.json`: Webhook (raw body) → Code HMAC/timestamp → Postgres atomic INSERT ON CONFLICT → IF duplicate → Telegram → Postgres SENT/FAILED → HTTP callback.
- [ ] Создать `docker/postgres/init` скрипты: БД `bizpilot`, `n8n`; роли `n8n_app`, `n8n_dedupe`; права только на `n8n_processed`; без superuser.
- [ ] Добавить n8n service в `docker-compose.yml` под profile `automation` с точным tag, volume, env, healthcheck.
- [ ] Создать `docs/N8N.md`: запуск, импорт workflow, webhook, HMAC secrets, Telegram credentials, тест уведомления, повторная доставка, диагностика, EOL/at-most-once ограничения.
- [ ] Unit: HMAC sign/verify, stale timestamp, idempotency key, retry schedule, status transitions, claim/lease.
- [ ] Integration: valid/invalid HMAC, replay, duplicate callback, SENT/DELIVERED/FAILED, 4xx/5xx/429, attempts, max age, n8n_processed atomic dedupe.
- [ ] Ручной E2E: реальный n8n + Telegram, сообщение получено, повтор не создаёт дубль.
- [ ] Проверить CRM при выключенном n8n (PENDING, ошибок нет).

### 6.2. Проверки этапа 4

| Проверка                              | Критерий                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| Outbox transaction                    | Lead + AutomationEvent создаются вместе; при ошибке нет partial                            |
| Dispatcher                            | max 10, lease 5 мин, повторный запуск не дублирует                                         |
| HMAC outbound                         | n8n принимает валидную подпись, отклоняет невалидную/старую                                |
| HMAC callback                         | BizPilot принимает валидную, отклоняет невалидную/старую                                   |
| Idempotency                           | повторный webhook/callback не создаёт дубль Telegram/событие                               |
| n8n dedupe                            | `INSERT ... ON CONFLICT DO NOTHING RETURNING`; без SELECT-then-INSERT                      |
| Retry                                 | 1m/5m/30m, max 3 auto, 24h, 4xx terminal, 429 Retry-After                                  |
| Manual retry                          | ADMIN/MANAGER, FAILED, <24h, same key; проверить сценарий после n8n FAILED (см. вопрос 14) |
| n8n off                               | CRM работает; события PENDING; интеграция NOT_CONFIGURED/ERROR                             |
| Telegram                              | ручной тест, сообщение с title/priority/category/summary/link                              |
| CLAIMED >15m                          | не переотправляется; видно в status как manual reconciliation                              |
| Typecheck/Lint/Unit/Integration/Build | PASS                                                                                       |

## 7. Этап 5 — Проверка и упаковка

**Статус: TODO** (зависит от 1–4).

### 7.1. Задачи

- [ ] Завершить unit-покрытие по разделу 14.1 ТЗ.
- [ ] Завершить три группы integration-тестов (CRUD/Prisma, AI adapter, n8n webhook).
- [ ] Запустить два E2E-сценария в доступном окружении; сохранить отчёт.
- [ ] Выполнить `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- [ ] Выполнить `docker compose up -d --build`; проверить app+postgres.
- [ ] Выполнить `docker compose --profile automation up -d`; проверить n8n.
- [ ] Провести security review и заполнить таблицу в `docs/SECURITY.md` фактическими результатами.
- [ ] Выполнить `pnpm audit --prod`; записать результат.
- [ ] Выполнить secret scan; не печатать найденные значения.
- [ ] Проверить `.env` в `.gitignore`, `.env.example` без секретов.
- [ ] Завершить `docs/API.md` (все endpoints, query, errors, examples).
- [ ] Завершить `docs/DEPLOYMENT.md` (Docker, ENV, migrations, seed, health, troubleshooting).
- [ ] Завершить `docs/N8N.md` (workflow, HMAC, dedupe, Telegram, retry, diagnostics).
- [ ] Завершить `README.md` (назначение, возможности, стек, запуск, ENV, AI, n8n, тесты, ограничения; явно указать Auth.js beta-риск и n8n 1.x EOL).
- [ ] Создать `.github/workflows/ci.yml` (lint, typecheck, unit, integration, build).
- [ ] Создать `.github/workflows/e2e.yml` (`workflow_dispatch`, Postgres, migrate/seed, app, Playwright, artifacts, mock AI).
- [ ] Проверить Demo data: `[DEMO]` titles, banner, 1/3/10/20/15/2.
- [ ] Проверить UI 1440/1280/768/375; все кнопки рабочие; состояния.
- [ ] Подготовить финальный отчёт по разделу 21 ТЗ.
- [ ] Записать реальные результаты проверок в этот план; не отмечать невыполненное.

### 7.2. Критерии приёмки MVP

- Docker Compose запускает app+postgres; n8n отдельно; CRM работает без n8n.
- Auth и роли работают; Workspace scope проверяется сервером.
- Dashboard на реальных данных; метрики/конверсия по 24.3.
- CRUD Leads/Contacts/Tasks с page/limit/search/status/priority/sort; limit ≤100.
- AI: реальный provider, structured JSON, Zod, score breakdown, draft reply, history, ошибки, smoke test.
- Automation: HMAC обе стороны, idempotency, retry, Telegram, повтор не создаёт дубль.
- `/api/webhooks/lead-created` отсутствует.
- `middleware.ts`, Settings read-only, Integration seed реализованы.
- Unit/integration/E2E запущены; typecheck/lint/build пройдены.
- Все документы раздела 18 существуют и актуальны.
- Ограничения MVP перечислены в README и SECURITY.

## 8. Сквозные задачи

- [ ] Единый envelope/error handling во всех Route Handlers.
- [ ] Zod-схемы для body/query/params/AI/webhook.
- [ ] Rate limiting по группам + 429/Retry-After.
- [ ] Body limits 256/64 KB с фактическим подсчётом.
- [ ] Origin/CSRF для cookie-auth mutations.
- [ ] ActivityLog во всех бизнес-мутациях.
- [ ] Workspace scope и role checks в каждом сервисе.
- [ ] Structured logs с redaction и requestId.
- [ ] Responsive UI и обязательные состояния.
- [ ] Документация обновляется вместе с API/схемой.
- [ ] CI на каждый push/PR; E2E workflow_dispatch.

## 9. Журнал проверок

| Дата       | Этап | Проверка             | Команда/метод                    | Результат                            |
| ---------- | ---- | -------------------- | -------------------------------- | ------------------------------------ |
| 2026-11-19 | 0    | Аудит директории     | `Get-ChildItem -Force`           | пусто, 0 элементов                   |
| 2026-11-19 | 0    | Git                  | `git status`                     | не репозиторий                       |
| 2026-11-19 | 0    | Node/pnpm/npm/Git    | version commands                 | 24.20.0 / 12.16.1 / 11.19.0 / 2.56.0 |
| 2026-11-19 | 0    | Docker/Compose       | `docker --version`               | не установлен                        |
| 2026-11-19 | 0    | PostgreSQL/WSL       | `psql`, services, `wsl --status` | отсутствуют                          |
| 2026-11-19 | 0    | Версии npm           | `npm view`                       | зафиксированы в ARCHITECTURE         |
| 2026-11-19 | 0    | Auth.js v5           | npm dist-tags + docs             | beta.32, stable v5 нет               |
| 2026-11-19 | 0    | n8n 1.x EOL          | n8n blog/docs                    | EOL 2026-12-31, риск                 |
| 2026-11-19 | 0    | Согласованность docs | ручная сверка с ТЗ 24.1–24.23    | PASS                                 |
| 2026-11-19 | 2    | Typecheck            | `npx tsc --noEmit`               | PASS (0 ошибок)                      |
| 2026-11-19 | 2    | Lint                 | `npx eslint .`                   | PASS (0 ошибок, 1 warning postcss)   |
| 2026-11-19 | 2    | Unit                 | `npx vitest run tests/unit`      | PASS (22 теста)                      |
| 2026-11-19 | 2    | Build                | `npx next build`                 | Компиляция PASS; EPERM symlink       |
| 2026-11-19 | 2    | AI интеграция UI     | Страница `/ai-assistant`         | PASS (typecheck/lint/build)          |
| 2026-11-19 | 2    | Login страница       | Страница `/login`                | PASS (typecheck)                     |
| —          | 1–5  | Все проверки         | —                                | NOT RUN                              |

## 10. Открытые вопросы

| №   | Вопрос                              | Варианты/рекомендация                                                                                                                             | Блокирует            | Владелец                |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ----------------------- |
| 1   | Docker/PostgreSQL отсутствуют       | Установить Docker Desktop + WSL2 (рекомендуется) или локальный PostgreSQL 16.16 + Docker Engine                                                   | Этап 1, 5            | Пользователь            |
| 2   | n8n 1.x EOL 2026-12-31              | Остаться на 1.123.98 по ТЗ (риск EOL) или согласовать 2.x/3.x (проверить workflow/env)                                                            | Этап 4               | Пользователь            |
| 3   | Auth.js v5 beta                     | Принять beta.32 по ТЗ или менять стек (вне MVP)                                                                                                   | Нет (зафиксировано)  | Пользователь/архитектор |
| 4   | ContactStatus значения              | Предложено NEW/ACTIVE/INACTIVE                                                                                                                    | Этап 1 (низкий риск) | Пользователь            |
| 5   | Lead.source значения                | Свободный текст                                                                                                                                   | Этап 1 (низкий риск) | Пользователь            |
| 6   | Dashboard: New Leads, окно графика  | NEW; 14 дней; Pending = TODO+IN_PROGRESS                                                                                                          | Этап 2 (низкий риск) | Пользователь            |
| 7   | apply-analysis endpoint             | Добавить `POST /api/leads/:id/apply-analysis`                                                                                                     | Этап 3               | Пользователь            |
| 8   | Apply создаёт Contact/Task?         | Отдельные явные действия после apply; без авто-merge                                                                                              | Этап 3               | Пользователь            |
| 9   | Session maxAge                      | 8 часов                                                                                                                                           | Этап 1 (низкий риск) | Пользователь            |
| 10  | AI health shape                     | `{ status, configured }`, без provider/model                                                                                                      | Этап 3 (низкий риск) | Пользователь            |
| 11  | AI provider/model/credentials       | OpenRouter + выбранная модель; нужны ключи                                                                                                        | Этап 3               | Пользователь            |
| 12  | Telegram/n8n credentials            | Bot token, chat_id, secrets                                                                                                                       | Этап 4               | Пользователь            |
| 13  | GitHub remote/CI secrets            | Нужны для публикации/CI                                                                                                                           | Этап 5               | Пользователь            |
| 14  | n8n_processed FAILED + manual retry | 24.12 DO NOTHING не даёт повторно захватить FAILED; выбрать атомарный reclaim FAILED, ограничить retry pre-n8n ошибками или удалять FAILED (риск) | Этап 4               | Пользователь            |
| 15  | Строгий граф статусов Lead/Task     | ТЗ не задаёт; MVP — только enum, AI не меняет status                                                                                              | Этап 2 (низкий риск) | Пользователь            |

## 11. Известные проблемы и риски

1. Docker/PostgreSQL/WSL отсутствуют — блокер этапа 1 и acceptance.
2. 8 GB RAM — возможна медленная работа Docker Desktop + n8n + Next build.
3. n8n 1.x EOL 2026-12-31; baseline ТЗ конфликтует с актуальной линией 2.x/3.x.
4. Auth.js v5 только beta; возможны регрессии.
5. Next.js 15 при актуальном Next 16; обновление вне baseline.
6. TypeScript 5.9.3, не 7.x; TS 7 не валидировался с Next 15.
7. Глобальный pnpm 12.16.1; проект должен использовать 9.15.9 через Corepack.
8. shadcn CLI 4.23.0 может тянуть Tailwind 4; компоненты вендорятся под Tailwind 3.
9. Windows/PowerShell: скрипты должны быть cross-platform, без bash-измов.
10. Git-репозиторий не инициализирован.
11. Нет реальных AI/n8n/Telegram credentials; smoke/Telegram тесты будут выполнены только после их предоставления.
12. Eventual-доставка outbox: без трафика приложения PENDING-события задерживаются.
13. `SENT` без callback может зависнуть; reconciliation в MVP — ручная сверка/status.
14. In-memory rate limit не работает между экземплярами.
15. JWT без revocation; роль/Workspace перечитываются из БД, но сессия не отзывается.
16. Hard delete; восстановление данных не предусмотрено.
17. Multi-tenancy фактически отсутствует; Workspace scope — предпосылка для будущего.
18. n8n_processed `FAILED` + manual retry: `ON CONFLICT DO NOTHING` не позволяет повторно захватить ключ; требуется решение до этапа 4 (см. вопрос 14).
19. Строгий граф переходов Lead/Task status не задан; MVP валидирует enum, AI не меняет status (см. вопрос 15).

## 12. Следующий конкретный шаг

Этап 2 UI выполнен. Следующие шаги (требуют подтверждения пользователя):

1. **Решить блокеры этапа 1** — установить Docker Desktop + WSL2 или локальный PostgreSQL 16.16, чтобы запустить миграции, seed, integration-тесты и проверить CRM с БД.
2. **Этап 3 (AI)** — реализовать `POST /api/ai/analyze`, `POST /api/leads/:id/apply-analysis`, `GET /api/ai/history`, AI сервис с OpenAI-compatible провайдером, Zod-валидацию ответа, retry, таймаут, историю попыток.
3. **Этап 4 (Automation)** — n8n интеграция, HMAC, outbox, Telegram, retry.
4. **Этап 5 (Проверка и упаковка)** — E2E тесты, CI, security review, финальная документация.

**Не начинать этап 3 без явного подтверждения пользователя.**

## 13. Журнал изменений плана

| Дата       | Изменение                                                |
| ---------- | -------------------------------------------------------- |
| 2026-11-19 | Создан план v1.0 по ТЗ v1.2; этап 0 DONE, этап 1 BLOCKED |
| 2026-11-19 | Этап 3 AI завершён (бэкенд + 94 теста): analyze, apply-analysis, generate-reply, history, провайдеры, Zod, retry, таймаут, workspace isolation |
| 2026-11-19 | Исправлены 15 критических дефектов; проверки на локальном PostgreSQL 16; Docker и реальный AI smoke — BLOCKED |

## 14. Исправление критических дефектов (2026-11-19)

### 14.1. Выполненные пункты и коммиты

| №  | Изменение | Коммит | Проверка |
| -- | --------- | ------ | -------- |
| 1  | `Alert` берётся из `components/ui/alert` на Leads/Tasks/CRM | `821115d` | typecheck, lint |
| 2  | Убран повторный `request.json()`; тело читается один раз через `readJsonBody` | `89c29a1` | typecheck, lint; API-смоук create |
| 3  | `handleApiError` возвращает plain-envelope; роуты оборачивают один раз | `06302d4` | unit `handle-error.test.ts` (2) |
| 4  | История AI фильтруется через `lead.workspaceId` | `6682924` | unit/integration обновлены |
| 5  | `SHADOW_DATABASE_URL` синхронизирован в env/examples/Compose/docs; Docker init создаёт `bizpilot_shadow` | `f0620ed` | `prisma validate`, `prisma generate` |
| 6  | Docker: context `.`, env wiring, seed в `migrate`, healthcheck `node -e fetch`, AI_PROVIDER из env | `b2ca785` | YAML распарсен; runtime Docker BLOCKED |
| 7  | AI-assistant: вывод analysis, выбор заявки, кнопка «Применить» | `e4b6215` | UI-смоук analyze/apply |
| 8  | Matcher `.*\..*` уже корректен; проверен редирект | `9b7ceb0` | `GET /dashboard` → 307 `/login`; API → 401 |
| 9  | `requireRole(user, DELETE_ROLES)` во всех DELETE | `9a0fe66` | OPERATOR DELETE → 403 `FORBIDDEN` |
| 10 | Rate limit логина (IP) и `/api/ai/*` (user); `assertSameOrigin` на мутациях | `984035d` | unit (5); POST без Origin → 403 |
| 11 | GET-списки передают фильтры в сервисы | `448e6c2` | `?status=NEW` → только NEW |
| 12 | Seed идемпотентен для контактов, заявок, задач | `0e6fed5` | два прогона: 1/3/10/20/15/2 без изменений |
| 13 | `n8n_processed` остаётся SQL-миграцией, Prisma-модели нет | `63fa33e` | миграция применена; таблица существует |
| 14 | apply-analysis и history не создают AI-провайдер | `fbecec0` | unit: apply/history без provider |
| 15 | Исправлены «Мок/Оценка/поставь более низкую/не запускай»; `model` — реальная модель конфига | `a73c2c9` | unit: `model === "mock"` |
| —  | Standalone-сборка включается `NEXT_OUTPUT_STANDALONE=true` (Docker), локальный build без symlink | `4fcc2a1` | `pnpm build` PASS |
| —  | Дополнительно: history без page/limit, редирект после создания заявки, отступ контента под sidebar, raw SQL Dashboard | `8bda36b`, `dee2035`, `2d61178` | API + UI-смоук |

### 14.2. Фактические проверки

| Проверка | Команда/метод | Результат |
| -------- | ------------- | --------- |
| Typecheck | `pnpm typecheck` | PASS (0 ошибок) |
| Lint | `pnpm lint` | PASS (0 ошибок, 1 warning `postcss.config.mjs`) |
| Unit | `pnpm test:unit` | PASS (9 файлов, 96 тестов) |
| Integration | `pnpm test:integration` | PASS (1 файл, 8 тестов) |
| Build | `pnpm build` | PASS, 29 маршрутов |
| Migrations | `npx prisma migrate deploy` | PASS (2 миграции, локальный PostgreSQL 16) |
| Seed x2 | `npx prisma db seed` + подсчёт | 1 workspace / 3 users / 10 contacts / 20 leads / 15 tasks / 2 integrations, без дублей |
| Auth redirect | `GET /dashboard` без сессии | 307 → `/login?callbackUrl=%2Fdashboard` |
| API auth | `GET /api/leads` без сессии | 401 JSON |
| Origin guard | POST `/api/leads` без `Origin` | 403 |
| UI-смоук | Playwright: login admin → создать заявку → AI-анализ → «Применить» → история | PASS (mock AI), история 200 |
| OPERATOR delete | DELETE `/api/leads/:id` | 403 `FORBIDDEN` |
| Docker Compose | `docker compose up -d --build` | BLOCKED: Docker отсутствует локально, доступа к VPS не предоставлено |
| Реальный AI | `pnpm test:ai` | BLOCKED: в `.env` нет `AI_API_KEY`/`AI_BASE_URL`/`AI_MODEL`; UI-смоук выполнен на явно разрешённом mock |

### 14.3. Блокеры

1. **Docker-приёмка** — на локальной Windows Docker не установлен (установка запрещена условиями), отдельный VPS недоступен.
2. **Реальный AI smoke** — не настроены credentials провайдера. Mock использован только для проверки UI-сценария и явно помечен; как доказательство реального LLM не заявляется.
3. **Telegram/n8n E2E** — этап 4 не начат по решению пользователя.

Следующий шаг: предоставить Docker/VPS и AI credentials для закрытия пунктов приёмки; этап 4 без отдельного решения не начинать.
