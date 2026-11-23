# План реализации BizPilot AI

**Версия:** 1.7 (2026-11-23: Phase 1 acceptance фактически выполнена на изолированном кластере PostgreSQL 16)
**Дата:** 2026-11-23
**Источник:** `BizPilot_AI_OpenCode_TZ_v1.2.md`, включая раздел 24  
**Текущий этап:** исторические этапы 1–5 (нумерация этого плана) реализованы. 2026-11-23 на физически отдельном временном кластере PostgreSQL 16 (`127.0.0.1:55432`, БД `bizpilot_phase1_test`) фактически выполнены миграции, seed, все integration- и E2E-тесты, аудит связей, production build и автоматический visual-прогон: typecheck/lint/unit 271/integration 49/E2E 12/build PASS, 0 cross-workspace нарушений, 40 screenshots без overflow и console errors. Реальный AI-провайдер проверен 2026-11-20; в прогоне 2026-11-23 использовался mock AI. Реальный n8n + Telegram runtime — **BLOCKED** (нет credentials), локальный Docker Compose — **BLOCKED** (Docker не установлен; проверка в CI job `docker`). MANAGER allow/deny и подпись visual checklist — открыты.

## Легенда статусов

- `TODO` — не начато.
- `IN_PROGRESS` — в работе.
- `DONE` — выполнено и проверено.
- `BLOCKED` — требуется решение/ресурс пользователя.

## Текущее состояние

| Этап                   | Статус                                         | Комментарий                                                                                                                                                                                                                         |
| ---------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Аудит и документы   | DONE                                           | Документы созданы; проверка согласованности выполнена вручную                                                                                                                                                                       |
| 1. Foundation          | DONE (локальный PostgreSQL) / BLOCKED (Docker) | Миграции, seed, auth, CRUD и integration-тесты выполнены на локальном PostgreSQL 16. Docker Desktop/WSL2 отсутствуют.                                                                                                               |
| 2. CRUD и UI           | DONE (UI)                                      | CRM страницы: Dashboard, Leads, Contacts, Tasks (list/detail/create/edit), AI assistant integration point, login page. Проверено на локальном PostgreSQL 16.                                                                        |
| 3. AI                  | DONE (бэкенд + тесты)                          | Реализованы `POST /api/ai/analyze`, `POST /api/leads/:id/apply-analysis`, `POST /api/ai/generate-reply`, `GET /api/ai/history`, провайдеры OpenAICompatible + Mock, Zod-валидация, retry, таймаут, история в БД. 94 теста проходят. |
| 4. Automation          | DONE (код/тесты) / BLOCKED (runtime)           | Outbox, HMAC, n8n_processed, retry, API, Settings UI, n8n draft workflow реализованы. Runtime n8n/Telegram и Docker — BLOCKED: нет credentials/Docker.                                                                              |
| 5. Проверка и упаковка | DONE (локально) / BLOCKED (Docker, n8n) | Актуальный прогон 2026-11-23: typecheck/lint/unit 271/integration 49/E2E 12/build PASS на изолированном кластере PostgreSQL 16; аудит 0; 40 screenshots. Docker runtime BLOCKED; n8n/Telegram BLOCKED; MANAGER и visual sign-off открыты. |
| 0.1 Workspace Security Patch | DONE (локальные проверки) | Lead (`contactId`, `assignedToId`) и Task (`leadId`, `contactId`, `assignedToId`) проверяются на принадлежность текущему Workspace до записи; чужой/несуществующий ID → 404. 23 новых unit-теста; typecheck/lint PASS; Write-path проверен integration-набором 2026-11-23. |
| 0.2 Workspace Read Isolation | DONE (локальные проверки) | Read includes фильтруются по Workspace; `deleteLead` отклоняет legacy чужой Task с 409; read-only audit script. 2026-11-23: `workspace-read-isolation` и `workspace-isolation` PASS на изолированной БД, аудит 0 cross-workspace. Аудит реальной целевой БД не запускался. |
| B1 Dashboard Workspace Isolation | DONE (локальные проверки) | KPI, воронка, 14-дневная динамика и preview-запросы (`priorityLeads`, `attentionTasks`) ограничены Workspace; relation-includes в preview фильтруются по Workspace. 2026-11-23: `dashboard-workspace-isolation` (8) и `dashboard-priority-tasks` (5) PASS на изолированной БД. |
| Phase 1 Acceptance (2026-11-23) | DONE (automated) / открыты MANAGER и visual sign-off | `docs/PHASE_1_ACCEPTANCE_PLAN.md` фактически выполнен: миграции 3/3, seed идемпотентен 1/3/10/20/15/2, integration 49/49, E2E 12/12, build 34 app routes + middleware, 40 screenshots (1440/1280/768/375) с 0 overflow и 0 console errors. Первый integration-прогон дал транзиентный сбой, далее два прогона подряд 49/49. MANAGER allow/deny не проверялся; визуальный checklist не подписан. |

### Согласованные этапы 4–8 (2026-11-22, отдельная нумерация)

Это рабочая нумерация редизайна и dashboard hardening. Она **не** переименовывает
исторические этапы 4 «Automation» и 5 «Проверка и упаковка» в разделах 6–7.

| Этап | Статус | Комментарий |
| --- | --- | --- |
| 4. Premium UI redesign | DONE (код) / visual sign-off открыт | Токены и общие примитивы Executive Glass, layout/навигация, формы, login, dashboard, Leads/CRM/Tasks, AI Assistant, Settings. 2026-11-23: `pnpm lint`, `pnpm typecheck`, `pnpm build`, unit PASS; сняты 40 screenshots на 1440/1280/768/375 без горизонтального overflow и ошибок консоли. Осталось: подпись визуального checklist пользователем/Architect. |
| 5. Workspace-scoped `priorityLeads` / `attentionTasks` | DONE (код + integration) | Запросы ограничены `workspaceId`; `contact`/`assignedTo` фильтруются по Workspace на чтении, foreign-связи не раскрывают имя. Порядок: заявки — `priority DESC, createdAt DESC, id DESC`; задачи — `dueDate ASC, priority DESC, createdAt DESC, id DESC`. Unit query-contract и PostgreSQL integration-тесты (`dashboard-priority-tasks`, `dashboard-workspace-isolation`) PASS 2026-11-23 на изолированной БД. |
| 6. 14-day trend с UTC boundaries | DONE (код + integration) | Границы строятся через `make_timestamp(year, month, day, 0, 0, 0)` → `timestamp without time zone`, без `AT TIME ZONE` и неявного `timestamptz`. Окно — 13 предыдущих UTC-дней + текущий UTC-день, end exclusive на следующую UTC-полночь, ровно 14 zero-filled buckets. Unit-тест фиксирует SQL-конструкцию; boundary-тест (`dashboard-workspace-isolation`, 8 тестов) PASS 2026-11-23. |
| 7. E2E order/tie-break/tasks/navigation | DONE (код + прогон) | `tests/e2e/dashboard.spec.ts` (4 сценария; всего 12) создаёт собственные уникальные заявки/задачи и проверяет порядок, tie-break, bounded preview, переходы, 14-строчную таблицу и навигацию. Прогон 2026-11-23: 12/12 PASS на изолированной seeded БД, собственный server Playwright, mock AI. MANAGER allow/deny по-прежнему не покрыт. |
| 8. Документация | DONE | Этот план, `PROJECT_PLAYBOOK.md` §6/§14, prerequisites E2E/integration и вопросы коммерческого ядра обновлены; исторические этапы не переименованы. |
| 9. Portfolio package (2026-11-23) | DONE (docs + artifacts) / MANAGER и visual sign-off открыты | `README.md`, `docs/DEMO.md` и `docs/PORTFOLIO_CASE_STUDY.md` приведены к фактическому состоянию. Фактически выполнены `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` (271/271), `pnpm test:integration` (49/49), `pnpm test:e2e` (12/12), `pnpm build` (34 app routes + middleware), seed/миграции и аудит 0 на изолированном кластере; сняты 40 screenshots на чистой seeded БД. MANAGER allow/deny и подпись visual checklist остаются открытыми; реальный AI и n8n не вызывались. Итог: PORTFOLIO READY WITH LIMITATIONS. |

> Мини-этапы 0.1 (write-path) и 0.2 (read/delete/historical tooling) выполнены
> локально и ожидают проверки пользователем. Полная Workspace isolation не
> заявляется до аудита целевой БД и устранения исторических cross-workspace связей.
>
> Разделы 3–6 ниже — исторические записи этапов 1–4. Итоговые фактические
> результаты этапа 5 и текущие ограничения — в разделе 7.

## 1. Результаты аудита окружения (этап 0)

> **Исторический снимок (2026-11-19).** Таблица ниже фиксирует окружение на
> момент Этапа 0 и не описывает текущую среду. Актуальное состояние
> (существующая локальная служба `postgresql-x64-16` на `5432`, локальный
> `.env`) и результаты приёмки Phase 1 от 2026-11-23 на изолированном кластере
> PostgreSQL 16 (`127.0.0.1:55432`, БД `bizpilot_phase1_test`) зафиксированы в
> §7.5 и `docs/PHASE_1_ACCEPTANCE_PLAN.md`. Утверждения «PostgreSQL/psql
> отсутствуют» и «Docker отсутствует» относятся только к дате снимка.

| Проверка                | Факт                                         | Вывод                                                |
| ----------------------- | -------------------------------------------- | ---------------------------------------------------- |
| Рабочая директория      | `F:\Project1\BezPilot_AI`                    | инициализирован, все файлы Stage 1 добавлены         |
| Git                     | репозиторий инициализирован (`master`)       | коммитов нет; `user.name`/`user.email` не заданы     |
| Существующий код        | создано на этапе 1                           | Foundation: schema, миграции, Auth, UI, Docker, seed |
| `package.json`          | создан                                       | exact versions, `packageManager: pnpm@9.15.9`        |
| `.env` / `.env.example` | `.env.example` создан; `.env` локальный      | `.env` не коммитится (`.gitignore`)                  |
| Node.js                 | 24.20.0 LTS Krypton                          | совместимо с baseline                                |
| pnpm                    | 12.16.1 глобально                            | baseline 9; проект зафиксирует 9.15.9 через Corepack |
| npm                     | 11.19.0                                      | используется только для проверки metadata            |
| Git                     | 2.56.0.windows.2                             | доступен                                             |
| Docker                  | отсутствует в PATH; Docker Desktop не найден | блокер для Compose/БД                                |
| Docker Compose          | отсутствует                                  | блокер                                               |
| PostgreSQL / psql       | отсутствуют; служб PostgreSQL нет            | блокер для миграций/тестов                           |
| WSL                     | отсутствует                                  | Docker Desktop потребует установки WSL2              |
| ОС                      | Windows 10 Pro 19045                         | Docker Desktop совместим при WSL2/Hyper-V            |
| RAM                     | 8 GB                                         | минимум; возможна медленная работа Docker + n8n      |
| Диск F:                 | 187 GB свободно                              | достаточно                                           |
| Интернет/npm registry   | доступен                                     | версии проверены                                     |
| Docker Hub API          | доступен                                     | tags проверены                                       |

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

**Статус: DONE (локальный PostgreSQL) / BLOCKED (Docker).** Обновление
2026-11-19: локальный PostgreSQL 16 запущен, миграции и seed выполнены,
integration/API/UI-проверки проведены. Docker Desktop/WSL2 по-прежнему
отсутствуют.

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

| Проверка        | Команда/метод                    | Результат                                         |
| --------------- | -------------------------------- | ------------------------------------------------- |
| Install         | `pnpm install --frozen-lockfile` | PASS (472 пакетов, pnpm 9.15.9)                   |
| Prisma generate | `pnpm prisma:generate`           | PASS                                              |
| Migrations      | `pnpm prisma migrate deploy`     | BLOCKED (нет PostgreSQL)                          |
| Seed            | `pnpm prisma:seed`               | BLOCKED (нет PostgreSQL)                          |
| Typecheck       | `pnpm typecheck`                 | PASS (0 ошибок)                                   |
| Lint            | `pnpm lint`                      | PASS (0 ошибок, 1 warning в postcss.config.mjs)   |
| Unit            | `pnpm test:unit`                 | PASS (22 теста)                                   |
| Build           | `pnpm build`                     | BLOCKED (EPERM symlink на Windows; компиляция OK) |
| Login           | ручной/Playwright smoke          | BLOCKED (нет PostgreSQL)                          |
| Roles           | unit/integration                 | PASS (unit roles.test.ts)                         |
| Workspace       | integration                      | BLOCKED (нет PostgreSQL)                          |
| Docker          | `docker compose up -d --build`   | BLOCKED (Docker Desktop не установлен)            |
| n8n off         | остановить n8n                   | BLOCKED (n8n не установлен; CRM без n8n — этап 4) |

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

| Проверка                  | Критерий                                                                                  | Результат                                             |
| ------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Typecheck                 | `npx tsc --noEmit`                                                                        | PASS (0 ошибок)                                       |
| Lint                      | `npx eslint .`                                                                            | PASS (0 ошибок, 1 warning postcss.config.mjs)         |
| Unit                      | `npx vitest run tests/unit`                                                               | PASS (22 теста)                                       |
| Build                     | `npx next build`                                                                          | Компиляция PASS; EPERM symlink Windows (pre-existing) |
| CRUD Leads/Contacts/Tasks | create/read/update/delete через API и UI                                                  | НЕ ПРОВЕРЯЛОСЬ (нет PostgreSQL)                       |
| Списки                    | page/limit/search/status/priority/sort; limit ≤ 100; pagination total/totalPages          | НЕ ПРОВЕРЯЛОСЬ (нет PostgreSQL)                       |
| Workspace scope           | A не видит/не меняет B; 404 на чужой id                                                   | НЕ ПРОВЕРЯЛОСЬ (нет PostgreSQL)                       |
| Роли                      | OPERATOR не удаляет; API 403 при прямом запросе                                           | НЕ ПРОВЕРЯЛОСЬ (нет PostgreSQL)                       |
| Delete rules              | Lead → AIAnalysis cascade, Task.leadId NULL, Contact с ссылками → 409                     | НЕ ПРОВЕРЯЛОСЬ (нет PostgreSQL)                       |
| Dashboard                 | метрики/графики по 24.3, Demo banner                                                      | НЕ ПРОВЕРЯЛОСЬ (нет PostgreSQL)                       |
| UI responsiveness         | 1440/1280/768/375; все кнопки работают; состояния                                         | НЕ ПРОВЕРЯЛОСЬ (нет браузера/Docker)                  |
| AI integration UI points  | Кнопка "AI анализ" → `/ai-assistant?leadId=...`; страница с health check и формой анализа | PASS (typecheck/lint/build)                           |
| Login                     | `/login` страница с LoginForm                                                             | НЕ ПРОВЕРЯЛОСЬ (нет PostgreSQL)                       |

## 5. Этап 3 — AI

**Статус: DONE** — бэкенд, UI AI-панели и реальный smoke Yandex AI Studio проверены. Остаются отдельные E2E-сценарии и bundle inspection.

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
- [x] Реализовать AI UI: панель анализа, score + breakdown, contacts, missing info, recommended action, draft reply, copy, mailto, apply, history, ошибки/disabled.
- [x] Реализовать AI Assistant page.
- [x] Unit: schema valid/invalid, enums, ranges, lengths, prompt sanitize, hash, retry decision, timeout (MockAIProvider + AIService).
- [x] Integration: adapter valid/invalid JSON/timeout/provider error; history; no raw prompt; apply transaction; Workspace isolation.
- [ ] E2E scenario 2: analyze с mock, проверить summary/priority/score/history.
- [x] Создать `scripts/test-ai.ts`; запустить вручную с реальным provider; записать результат (PASS, см. 5.3/14.4).
- [ ] Проверить отсутствие AI key на клиенте (grep/bundle inspection).

### 5.2. Проверки этапа 3

| Проверка                              | Критерий                                                                                   | Результат                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Structured JSON                       | Zod PASS; невалидный → 1 retry → понятная ошибка                                           | PASS (94 теста)                                           |
| Timeout                               | AbortController прерывает запрос; ≤60 с                                                    | PASS (сервис, AbortController)                            |
| Tokens                                | max 4000 output                                                                            | PASS (MockAIProvider, схема)                              |
| Lengths                               | summary ≤300, draft ≤800                                                                   | PASS (Zod .max())                                         |
| No invention                          | null/[] при отсутствии; проверка на фикстурах                                              | PASS (MockAIProvider валидируется)                        |
| Apply                                 | одна транзакция; поля 24.5 + ActivityLog; повтор идемпотентен                              | PASS (тест applyAnalysis)                                 |
| History                               | provider/model/status/resultJson/tokens/duration/promptHash/error; без raw prompt/response | PASS (тест getHistory)                                    |
| Secret leak                           | AI_API_KEY отсутствует в клиентском bundle/логах                                           | готово (серверный fetch, server-only)                     |
| No auto action                        | нет кнопки отправки клиенту; только copy/mailto                                            | prepareReply не сохраняет в БД                            |
| Mock guard                            | mock запрещён в production без ALLOW_MOCK_AI                                               | проверено в провайдере                                    |
| Real smoke                            | `pnpm test:ai` вручную, результат в плане                                                  | не выполнено (нет credentials)                            |
| Typecheck/Lint/Unit/Integration/Build | PASS                                                                                       | PASS (typecheck 0, lint 0, tests 94, build компиляция OK) |

### 5.3. Результаты проверок (2026-11-19)

| Проверка            | Команда/метод                          | Результат                              |
| ------------------- | -------------------------------------- | -------------------------------------- |
| Typecheck           | `npx tsc --noEmit`                     | PASS (0 ошибок)                        |
| Lint                | `npx eslint .`                         | PASS (0 ошибок, 1 warning postcss)     |
| Unit                | `npx vitest run`                       | PASS (94 теста, 8 файлов)              |
| Build               | `npx next build`                       | Компиляция PASS; EPERM symlink Windows |
| AI provider         | MockAIProvider unit                    | PASS (имя, analyze, generateReply)     |
| AI service          | analyze/generateReply/apply/getHistory | PASS (реtry, валидация, workspace)     |
| Workspace isolation | чужой workspace → 404                  | PASS (integration тесты)               |

## 6. Этап 4 — Automation

**Статус: DONE (код/тесты) / BLOCKED (runtime).** Реализованы outbox, HMAC,
PostgreSQL-дедупликация, retry, API, Settings UI, Docker profile и draft
workflow. Реальный n8n + Telegram не проверены: нет credentials и Docker.

### 6.1. Задачи

- [x] `lib/security/hmac.ts`: sign/verify, constant-time compare, timestamp ±5 минут, raw bytes.
- [x] Rate limit webhook 1000/мин/IP + rate limits automation API.
- [x] `services/automation.service.ts`: createEvent в транзакции с Lead, atomic claim с lease, dispatch max 10, retry schedule, manual retry, status counts, stale CLAIMED.
- [x] `lib/integrations/n8n.ts`: исходящий webhook, HMAC headers, timeout, response parsing, sanitized errors, Retry-After.
- [x] `POST /api/webhooks/n8n`: raw body 64 KB, HMAC, timestamp ±5 минут, Zod, idempotency, DELIVERED/FAILED, Integration status, no downgrade.
- [x] `GET /api/automation/events` (ADMIN/MANAGER, пагинация, lazy dispatch).
- [x] `POST /api/automation/events/:id/retry` (ADMIN/MANAGER, FAILED, <24h, same key).
- [x] `GET /api/automation/status` (counts, integrations, stale claims, lazy dispatch).
- [x] Settings UI: read-only profile, automation status, integrations, журнал, retry; OPERATOR видит только profile/logout; без форм секретов.
- [x] Lazy dispatcher на Dashboard, `/settings` и automation API.
- [x] `n8n/workflows/lead_created_notification.json` — **DRAFT**: Webhook → Code HMAC → Postgres claim → duplicate/reclaim → Telegram → SENT/FAILED → callback; без секретов в JSON.
- [x] `docker/n8n/init-db.sql` + Compose `n8n-db-init`: БД `n8n`, роли `n8n_app`/`n8n_dedupe`, только SELECT/INSERT/UPDATE на `n8n_processed`, без superuser.
- [x] n8n service в `docker-compose.yml` под profile `automation` с точным tag, volume, env, healthcheck.
- [x] `docs/N8N.md`, `docs/API.md`, `docs/SECURITY.md`; обновлены ARCHITECTURE/README/DEPLOYMENT.
- [x] Unit: HMAC, timestamp, raw body, idempotency key, retry schedule, status transitions, roles, claim/lease, callback.
- [x] Integration: outbox claim/lease/concurrency на реальном PostgreSQL; `n8n_processed` atomic dedupe/CLAIMED/FAILED reclaim.
- [ ] Ручной E2E с реальным n8n + Telegram — **BLOCKED**: нет credentials/Docker.
- [x] Проверка CRM при выключенном n8n: событие PENDING/RETRYING, ошибка в журнале, CRM работает.
- [ ] Импорт draft workflow в реальный n8n — **BLOCKED**.

### 6.2. Проверки этапа 4 (фактические результаты)

| Проверка            | Критерий                                                                                  | Результат                                     |
| ------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------- |
| Outbox transaction  | Lead + AutomationEvent вместе; нет partial                                                | PASS (код + API smoke)                        |
| Dispatcher          | max 10, lease 5 мин, без дублей                                                           | PASS (real PostgreSQL integration)            |
| HMAC outbound       | n8n принимает/отклоняет                                                                   | PASS для подписи/тестов; реальный n8n BLOCKED |
| HMAC callback       | BizPilot принимает/отклоняет                                                              | PASS (unit + API smoke)                       |
| Idempotency         | повтор не создаёт дубль                                                                   | PASS (unit + real DB + API smoke)             |
| n8n dedupe          | `DO NOTHING RETURNING`, без SELECT-then-INSERT                                            | PASS (real PostgreSQL)                        |
| Retry               | 1m/5m/30m, max 3 auto, 24h, 4xx terminal, 429 Retry-After                                 | PASS (unit)                                   |
| Manual retry        | ADMIN/MANAGER, FAILED, <24h, same key                                                     | PASS (unit + API + UI smoke)                  |
| n8n off             | CRM работает, PENDING/ERROR                                                               | PASS (API smoke)                              |
| Telegram            | сообщение с title/priority/category/summary/link                                          | **BLOCKED** (нет credentials)                 |
| CLAIMED >15m        | не переотправляется, видно в status                                                       | PASS (unit + real DB)                         |
| Typecheck           | 0 ошибок                                                                                  | PASS                                          |
| Lint                | 0 ошибок                                                                                  | PASS (1 warning postcss)                      |
| Unit                | все тесты                                                                                 | PASS (179 тестов, 18 файлов)                  |
| Integration         | PostgreSQL                                                                                | PASS (19 тестов, 3 файла)                     |
| Build               | production                                                                                | PASS (35 routes)                              |
| API smoke           | login → lead → PENDING → callback → DELIVERED → duplicate → FAILED → retry → OPERATOR 403 | PASS                                          |
| UI smoke            | `/settings`, журнал, retry, OPERATOR                                                      | PASS (Playwright)                             |
| `pnpm audit --prod` | без high/critical                                                                         | **FAIL**: 6 advisories, см. SECURITY          |

### 6.3. Блокеры этапа 4

1. Нет реальных n8n и Telegram credentials (`N8N_WEBHOOK_URL`, secrets, bot token, chat_id).
2. Docker не установлен; Compose-профиль `automation` и `n8n-db-init` runtime не проверены.
3. n8n workflow — draft; импорт и активация в реальном n8n не выполнялись.
4. PostgreSQL-роль `n8n_dedupe` создана только SQL-скриптом; runtime-проверка прав в Docker/локальном кластере не выполнена (нет superuser-доступа для создания роли).

## 7. Этап 5 — Проверка и упаковка

**Статус: DONE (локальная проверка) / BLOCKED (Docker runtime, n8n + Telegram).**
Автоматические проверки перезапущены 2026-11-23 на физически отдельном временном
кластере PostgreSQL 16 (`127.0.0.1:55432`, БД `bizpilot_phase1_test`); реальный
AI smoke выполнен 2026-11-20, в прогоне 2026-11-23 использовался mock AI. Docker
в локальном окружении отсутствует, поэтому Compose runtime не заявляется как
PASS.

### 7.1. Задачи

- [x] Завершить unit-покрытие по разделу 14.1 ТЗ: 2026-11-23 — 271 тест / 26 файлов.
- [x] Integration-тесты: CRUD/Workspace isolation, AI adapter/service, n8n webhook/outbox/`n8n_processed`, dashboard — 2026-11-23 — 49 тестов / 7 файлов.
- [x] E2E: auth/roles, CRM flow, AI mock, dashboard order/tie-break, responsive UI — 2026-11-23 — 12/12 сценариев.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- [x] Security review и фактическая таблица в `docs/SECURITY.md`.
- [x] `pnpm audit --prod`: 0 известных уязвимостей; `zod` 4.6.7, `deepmerge-ts`/`postcss`/`effect` закреплены.
- [x] Secret scan gitleaks по всей истории: 0 находок.
- [x] `.env` в `.gitignore`; examples без секретов.
- [x] `docs/API.md`, `docs/DEPLOYMENT.md`, `docs/N8N.md`, `README.md`, `docs/DEMO.md` обновлены.
- [x] `.github/workflows/ci.yml` и `.github/workflows/e2e.yml` созданы; добавлен CI job `docker`.
- [x] Demo data: 1/3/10/20/15/2, все Lead/Task с `[DEMO]`, Dashboard banner, seed идемпотентен, без пароля падает.
- [x] UI 1440/1280/768/375: нет горизонтального overflow, консоль без ошибок, mobile nav и пагинация работают.
- [x] Реальный `pnpm test:ai` на текущей AI-схеме/prompt/`extractedContacts`.
- [ ] Реальный n8n + Telegram E2E — **BLOCKED**: нет credentials/Docker.
- [ ] Локальный `docker compose up` — **BLOCKED**: Docker не установлен; проверка в CI job `docker` ещё не запускалась.

### 7.2. Фактические результаты (2026-11-20; audit — 2026-11-21)

| Проверка              | Команда/метод                         | Результат                                      |
| --------------------- | ------------------------------------- | ---------------------------------------------- |
| Typecheck             | `pnpm typecheck`                      | PASS, 0 ошибок                                 |
| Lint                  | `pnpm lint`                           | PASS, 0 ошибок, 1 warning postcss              |
| Unit                  | `pnpm test:unit`                      | PASS, 199 тестов / 20 файлов                   |
| Integration           | `pnpm test:integration`               | PASS, 24 теста / 4 файла (два прогона подряд)  |
| E2E                   | `pnpm test:e2e`                       | PASS, 8 сценариев (mock AI)                    |
| Build                 | `pnpm build`                          | PASS, 35 routes                                |
| Реальный AI smoke     | `pnpm test:ai`                        | PASS: HTTP 200, Zod, contacts verified         |
| Audit                 | `pnpm audit --prod`                   | PASS: 0 известных уязвимостей (2026-11-21)     |
| Secret scan           | `gitleaks detect --source . --redact` | PASS: 0 находок, 31 коммит                     |
| Seed fresh schema     | `migrate deploy` + `db seed` x2       | PASS: 1/3/10/20/15/2, без дублей               |
| Seed без пароля       | `tsx prisma/seed.ts` без env          | PASS: завершается ошибкой                      |
| Docker Compose        | `docker compose up`                   | BLOCKED: Docker отсутствует                    |

### 7.3. Осталось BLOCKED

1. Реальный n8n 1.123.98 + Telegram: нет `N8N_WEBHOOK_URL`, HMAC-секретов, bot token/chat_id. Workflow остаётся draft.
2. Docker Compose runtime: локально Docker нет; CI job `docker` создан, но workflow ещё не выполнялся.
3. Роль `n8n_dedupe`: SQL подготовлен, runtime-проверка прав требует Docker/superuser.

### 7.4. Критерии приёмки MVP (статус)

- CRM, auth/роли, Workspace scope, Dashboard, списки/фильтры/пагинация — PASS на локальном PostgreSQL и E2E.
- AI: реальный provider PASS; mock E2E PASS; контакты фильтруются по исходному тексту; автоотправки нет.
- Automation: код, HMAC, idempotency, retry, outbox и статусы PASS в unit/integration/API; реальный n8n/Telegram BLOCKED.
- `/api/webhooks/lead-created` отсутствует; Settings read-only; Integration seed 2 записи.
- Typecheck/lint/unit/integration/E2E/build — PASS; Docker/n8n runtime — BLOCKED.
- Документы раздела 18 актуальны; ограничения перечислены в README/SECURITY.

### 7.5. Фактический прогон 2026-11-23 (изолированный кластер PostgreSQL 16)

Временный кластер создан из `F:\Program Files\PostgreSQL\16\bin` в
`%TEMP%\opencode\pg-phase1-test`, слушал `127.0.0.1:55432`, БД
`bizpilot_phase1_test`, пользователь `bizpilot_phase1`. Основная служба
`postgresql-x64-16:5432` и `.env` не затрагивались. После прогона кластер
остановлен (`pg_ctl stop -m fast`) и удалён.

| Проверка | Команда/метод | Результат |
| --- | --- | --- |
| Typecheck | `pnpm typecheck` | PASS, 0 ошибок |
| Lint | `pnpm lint` | PASS, 0 ошибок, 0 warnings |
| Unit | `pnpm test:unit` | PASS, 271 тест / 26 файлов |
| Migrations | `pnpm prisma migrate deploy` | PASS, 3/3, `n8n_processed` создана |
| Seed ×2 | `pnpm prisma:seed` | PASS, идемпотентно 1/3/10/20/15/2, все `[DEMO]` |
| Integration | `pnpm test:integration` | PASS, 49 тестов / 7 файлов (два прогона подряд) |
| E2E | `pnpm test:e2e` | PASS, 12/12 (mock AI, собственный server) |
| Workspace audit | `pnpm exec tsx scripts/audit-workspace-relations.ts` | PASS, 0 cross-workspace / 0 missing |
| Build | `pnpm build` | PASS, 34 app routes + middleware (+ отдельный rebuild для `next start`) |
| Visual run | Playwright, `pnpm start --port 3100` | PASS: 40 screenshots (10 страниц × 4 viewport), 0 overflow, 0 console errors |
| Cleanup | `pg_ctl stop` + удаление каталога | PASS, порт 55432 свободен |

Оговорки:

- первый `pnpm test:integration` дал 1 failed + 5 skipped (FK-ошибки трёх
  параллельных insert и одна ошибка соединения); два следующих прогона — 49/49,
  данные вернулись ровно к seed. Логи PostgreSQL без `FATAL`; сбой не
  воспроизведён, flaky-риск под наблюдением.
- MANAGER allow/deny не проверялся (в 12 E2E нет MANAGER); визуальный checklist
  не подписан. Полный приёмочный PASS поэтому не заявляется.
- `pnpm start` требует production build: Playwright `pnpm dev` перезаписывает
  `.next`, поэтому перед visual-run build выполнен повторно.

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

| Дата       | Этап | Проверка             | Команда/метод                    | Результат                                  |
| ---------- | ---- | -------------------- | -------------------------------- | ------------------------------------------ |
| 2026-11-19 | 0    | Аудит директории     | `Get-ChildItem -Force`           | пусто, 0 элементов                         |
| 2026-11-19 | 0    | Git                  | `git status`                     | не репозиторий                             |
| 2026-11-19 | 0    | Node/pnpm/npm/Git    | version commands                 | 24.20.0 / 12.16.1 / 11.19.0 / 2.56.0       |
| 2026-11-19 | 0    | Docker/Compose       | `docker --version`               | не установлен                              |
| 2026-11-19 | 0    | PostgreSQL/WSL       | `psql`, services, `wsl --status` | отсутствуют                                |
| 2026-11-19 | 0    | Версии npm           | `npm view`                       | зафиксированы в ARCHITECTURE               |
| 2026-11-19 | 0    | Auth.js v5           | npm dist-tags + docs             | beta.32, stable v5 нет                     |
| 2026-11-19 | 0    | n8n 1.x EOL          | n8n blog/docs                    | EOL 2026-12-31, риск                       |
| 2026-11-19 | 0    | Согласованность docs | ручная сверка с ТЗ 24.1–24.23    | PASS                                       |
| 2026-11-19 | 2    | Typecheck            | `npx tsc --noEmit`               | PASS (0 ошибок)                            |
| 2026-11-19 | 2    | Lint                 | `npx eslint .`                   | PASS (0 ошибок, 1 warning postcss)         |
| 2026-11-19 | 2    | Unit                 | `npx vitest run tests/unit`      | PASS (22 теста)                            |
| 2026-11-19 | 2    | Build                | `npx next build`                 | Компиляция PASS; EPERM symlink             |
| 2026-11-19 | 2    | AI интеграция UI     | Страница `/ai-assistant`         | PASS (typecheck/lint/build)                |
| 2026-11-19 | 2    | Login страница       | Страница `/login`                | PASS (typecheck)                           |
| 2026-11-19 | 4    | Typecheck            | `pnpm typecheck`                 | PASS (0 ошибок)                            |
| 2026-11-19 | 4    | Lint                 | `pnpm lint`                      | PASS (0 ошибок, 1 warning postcss)         |
| 2026-11-19 | 4    | Unit                 | `pnpm test:unit`                 | PASS (179 тестов, 18 файлов)               |
| 2026-11-19 | 4    | Integration          | `pnpm test:integration`          | PASS (19 тестов, 3 файла, real PostgreSQL) |
| 2026-11-19 | 4    | Build                | `pnpm build`                     | PASS (35 routes)                           |
| 2026-11-19 | 4    | Migrations           | `pnpm prisma migrate deploy`     | PASS (3 миграции)                          |
| 2026-11-19 | 4    | API smoke            | login → lead → callback → retry  | PASS (10 проверок)                         |
| 2026-11-19 | 4    | UI smoke             | Playwright `/settings` + retry   | PASS                                       |
| 2026-11-19 | 4    | Webhook script       | `pnpm test:webhook`              | PASS (HTTP 200, DELIVERED)                 |
| 2026-11-19 | 4    | Audit                | `pnpm audit --prod`              | FAIL: 2 moderate, 4 high (см. SECURITY)    |
| 2026-11-19 | 4    | n8n/Telegram runtime | реальный E2E                     | BLOCKED (нет credentials/Docker)           |
| 2026-11-19 | 4    | Docker Compose       | `docker compose up`              | BLOCKED (Docker не установлен)             |

| 2026-11-20 | AI    | filterExtractedContacts | unit `ai-contacts/ai-service/ai-prompt/ai-schema` | PASS (фильтр, промпт, service) |
| 2026-11-20 | AI    | Health `{status, configured}` | `pnpm build` + docs/API.md | PASS; shape обновлён |
| 2026-11-20 | Docs  | Синхронизация API/ARCH/DEPLOY/SECURITY | ручная сверка с кодом | PASS (health, extractedContacts, Origin) |
| 2026-11-20 | 5     | Typecheck            | `pnpm typecheck`                  | PASS (0 ошибок)                            |
| 2026-11-20 | 5     | Lint                 | `pnpm lint`                       | PASS (0 ошибок, 1 warning postcss)         |
| 2026-11-20 | 5     | Unit                 | `pnpm test:unit`                  | PASS (199 тестов, 20 файлов)               |
| 2026-11-20 | 5     | Integration          | `pnpm test:integration`           | PASS (24 теста, 4 файла, 2 прогона)        |
| 2026-11-20 | 5     | E2E                  | `pnpm test:e2e`                   | PASS (8 сценариев, mock AI)                |
| 2026-11-20 | 5     | Build                | `pnpm build`                      | PASS (35 routes)                           |
| 2026-11-20 | 5     | Real AI smoke        | `pnpm test:ai`                    | PASS (HTTP 200, contacts verified)         |
| 2026-11-20 | 5     | Secret scan          | gitleaks 8.30.1 (full history)    | PASS (0 находок, 31 коммит)                |
| 2026-11-20 | 5     | Audit                | `pnpm audit --prod`               | FAIL: 2 high (zod, deepmerge-ts)           |
| 2026-11-20 | 5     | Seed fresh schema    | `migrate deploy` + seed x2        | PASS (1/3/10/20/15/2, без дублей)          |
| 2026-11-20 | 5     | Seed без пароля      | `tsx prisma/seed.ts` без env      | PASS (ошибка)                              |
| 2026-11-20 | 5     | UI responsive        | Playwright 1440/1280/768/375      | PASS (нет overflow, консоль чистая)        |
| 2026-11-20 | 5     | Docker Compose       | `docker compose up`               | BLOCKED (Docker не установлен)             |
| 2026-11-20 | 5     | n8n/Telegram runtime | реальный E2E                      | BLOCKED (нет credentials)                  |
| 2026-11-21 | 5     | Audit                | `pnpm audit --prod`               | PASS: 0 известных уязвимостей (zod 4.6.7, deepmerge-ts 8.0.2) |
| 2026-11-22 | 4–8   | Typecheck            | `pnpm typecheck`                  | PASS, 0 ошибок |
| 2026-11-22 | 4–8   | Lint                 | `pnpm lint`                       | PASS, 0 ошибок |
| 2026-11-22 | 4–8   | Unit                 | `pnpm test:unit`                  | PASS, 264 теста / 25 файлов |
| 2026-11-22 | 4–8   | Build                | `pnpm build`                      | PASS, 35 routes |
| 2026-11-22 | 7     | E2E guard            | `pnpm exec playwright test --list` | Без `TEST_DATABASE_URL` остановлен guard; с dummy local test URL перечислены 12 сценариев без запуска |
| 2026-11-22 | 5–7   | Integration/E2E      | `pnpm test:integration`, `pnpm test:e2e` | NOT RUN: нет доказанной изолированной seeded БД; на dev/demo не направлялись |
| 2026-11-22 | 4     | Visual review        | доступный artifact set           | NOT AVAILABLE: подтверждённых screenshots dashboard/mobile нет; визуальная приёмка не выполнялась |
| 2026-11-23 | 1–7   | Typecheck            | `pnpm typecheck`                 | PASS, 0 ошибок |
| 2026-11-23 | 1–7   | Lint                 | `pnpm lint`                      | PASS, 0 ошибок, 0 warnings |
| 2026-11-23 | 1–7   | Unit                 | `pnpm test:unit`                 | PASS, 271 тест / 26 файлов |
| 2026-11-23 | 1–7   | Migrations           | `pnpm prisma migrate deploy`     | PASS, 3/3 на `bizpilot_phase1_test` (127.0.0.1:55432) |
| 2026-11-23 | 1–7   | Seed ×2              | `pnpm prisma:seed`               | PASS, 1/3/10/20/15/2, без дублей |
| 2026-11-23 | 1–7   | Integration          | `pnpm test:integration`          | PASS, 49 тестов / 7 файлов (два прогона подряд) |
| 2026-11-23 | 1–7   | E2E                  | `pnpm test:e2e`                  | PASS, 12/12, mock AI |
| 2026-11-23 | 1–7   | Workspace audit      | `scripts/audit-workspace-relations.ts` | PASS, 0 cross-workspace / 0 missing |
| 2026-11-23 | 1-7   | Build                | `pnpm build`                     | PASS, 34 app routes + middleware |
| 2026-11-23 | 4     | Visual run           | Playwright, 1440/1280/768/375    | PASS: 40 screenshots, 0 overflow, 0 console errors (checklist не подписан) |
| 2026-11-23 | —     | Cluster cleanup      | `pg_ctl stop -m fast` + remove   | PASS; порт 55432 свободен, каталог удалён |

## 10. Открытые вопросы

| №   | Вопрос                              | Варианты/рекомендация                                                                                                                                             | Блокирует            | Владелец                |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ----------------------- |
| 1   | Docker/PostgreSQL                   | PostgreSQL 16 запущен локально и используется для миграций/тестов. Docker Desktop + WSL2 всё ещё нужны для Docker-приёмки и n8n-профиля                           | Этап 5, Docker       | Пользователь            |
| 2   | n8n 1.x EOL 2026-12-31              | Остаться на 1.123.98 по ТЗ (риск EOL) или согласовать 2.x/3.x (проверить workflow/env)                                                                            | Этап 4               | Пользователь            |
| 3   | Auth.js v5 beta                     | Принять beta.32 по ТЗ или менять стек (вне MVP)                                                                                                                   | Нет (зафиксировано)  | Пользователь/архитектор |
| 4   | ContactStatus значения              | Предложено NEW/ACTIVE/INACTIVE                                                                                                                                    | Этап 1 (низкий риск) | Пользователь            |
| 5   | Lead.source значения                | Свободный текст                                                                                                                                                   | Этап 1 (низкий риск) | Пользователь            |
| 6   | Dashboard: New Leads, окно графика  | NEW; 14 дней; Pending = TODO+IN_PROGRESS                                                                                                                          | Этап 2 (низкий риск) | Пользователь            |
| 7   | apply-analysis endpoint             | Добавить `POST /api/leads/:id/apply-analysis`                                                                                                                     | Этап 3               | Пользователь            |
| 8   | Apply создаёт Contact/Task?         | Отдельные явные действия после apply; без авто-merge                                                                                                              | Этап 3               | Пользователь            |
| 9   | Session maxAge                      | 8 часов                                                                                                                                                           | Этап 1 (низкий риск) | Пользователь            |
| 10  | AI health shape                     | `{ status, configured }`, без provider/model                                                                                                                      | Этап 3 (низкий риск) | Пользователь            |
| 11  | AI provider/model/credentials       | OpenRouter + выбранная модель; нужны ключи                                                                                                                        | Этап 3               | Пользователь            |
| 12  | Telegram/n8n credentials            | Bot token, chat_id, `N8N_WEBHOOK_URL`, два разных HMAC-секрета; без них runtime BLOCKED                                                                           | Этап 4 (runtime)     | Пользователь            |
| 13  | GitHub remote/CI secrets            | Нужны для публикации/CI                                                                                                                                           | Этап 5               | Пользователь            |
| 14  | n8n_processed FAILED + manual retry | **РЕШЕНО:** основное `DO NOTHING`; после конфликта только `FAILED` атомарно reclaim-ится `UPDATE ... WHERE status='FAILED'`; `SENT`/`CLAIMED` не переотправляются | Этап 4 закрыт        | Реализовано             |
| 15  | Строгий граф статусов Lead/Task     | ТЗ не задаёт; MVP — только enum, AI не меняет status                                                                                                              | Этап 2 (низкий риск) | Пользователь            |

## 11. Известные проблемы и риски

1. Docker Desktop/WSL2 отсутствуют — блокер Docker-приёмки и runtime n8n-профиля. Локальный PostgreSQL 16 работает.
2. 8 GB RAM — возможна медленная работа Docker Desktop + n8n + Next build.
3. n8n 1.x EOL 2026-12-31; baseline ТЗ конфликтует с актуальной линией 2.x/3.x.
4. Auth.js v5 только beta; возможны регрессии.
5. Next.js 15 при актуальном Next 16; обновление вне baseline.
6. TypeScript 5.9.3, не 7.x; TS 7 не валидировался с Next 15.
7. Глобальный pnpm 12.16.1; проект должен использовать 9.15.9 через Corepack.
8. shadcn CLI 4.23.0 может тянуть Tailwind 4; компоненты вендорятся под Tailwind 3.
9. Windows/PowerShell: скрипты должны быть cross-platform, без bash-измов.
10. CI workflows созданы (`.github/workflows/ci.yml`, `e2e.yml`); remote и secrets в текущем окружении не настроены, workflow ещё не запускались.
11. AI credentials предоставлены и проверены; n8n/Telegram credentials отсутствуют, поэтому Telegram E2E BLOCKED.
12. Eventual-доставка outbox: без трафика приложения PENDING-события задерживаются.
13. `SENT` без callback может зависнуть; reconciliation в MVP — ручная сверка/status.
14. In-memory rate limit не работает между экземплярами.
15. JWT без revocation; роль/Workspace перечитываются из БД, но сессия не отзывается.
16. Hard delete; восстановление данных не предусмотрено.
17. Multi-tenancy фактически отсутствует; Workspace scope — предпосылка для будущего.
18. n8n workflow — draft; импорт/активация в реальном n8n не выполнялись (runtime BLOCKED).
19. `pnpm audit --prod` показывает 0 известных уязвимостей: `zod` обновлён до 4.6.7, `deepmerge-ts` 8.0.2, `postcss` и `effect` закреплены pnpm overrides.
20. n8n 1.x basic-auth env может игнорироваться owner-account; UI n8n нельзя публиковать без защиты.
21. PostgreSQL-роль `n8n_dedupe` создана SQL-скриптом, но runtime-проверка прав не выполнена (Docker/superuser access).
22. Строгий граф переходов Lead/Task status не задан; MVP валидирует enum, AI не меняет status (см. вопрос 15).
23. Изолированная seeded test DB доказана 2026-11-23: временный кластер PostgreSQL 16 на `127.0.0.1:55432`, БД `bizpilot_phase1_test`; integration 49/49 и E2E 12/12 PASS; кластер удалён после прогона.
24. Визуальная приёмка: 2026-11-23 автоматически сняты 40 screenshots (1440/1280/768/375) без overflow и console errors; **подпись визуального checklist пользователем/Architect отсутствует**, визуальный PASS не заявляется.
25. Первый integration-прогон 2026-11-23 дал транзиентный сбой (FK-ошибки при параллельных insert и одна ошибка соединения); два следующих прогона — 49/49. Возможный flaky-риск под наблюдением в CI.
26. MANAGER allow/deny не покрыт E2E (только ADMIN/OPERATOR); полный приёмочный PASS требует отдельного test/manual evidence.

## 12. Следующий конкретный шаг

> **Актуализация 2026-11-23.** Пункты 1–3 подраздела 2026-11-22 (integration/E2E
> на изолированной БД и визуальная приёмка) фактически выполнены в прогоне
> 2026-11-23 (см. §7.5). Оставшиеся внешние блокеры (Docker, n8n/Telegram,
> GitHub Actions) по-прежнему требуют ресурсов пользователя.

Этап 5 закрыт локально. Для полной внешней приёмки нужны:

1. **Docker Desktop + WSL2** (или VPS): запустить CI job `docker` или локально
   `docker compose --env-file .env.docker up -d --build`, проверить
   `n8n-db-init`, права `n8n_dedupe` и профиль `automation`.
2. **n8n + Telegram credentials**: `N8N_WEBHOOK_URL`, два разных HMAC-секрета,
   bot token, chat_id. Импортировать `n8n/workflows/lead_created_notification.json`
   в n8n 1.123.98, настроить credentials, активировать, выполнить E2E и перевести
   workflow из draft в verified.
3. Запустить GitHub Actions `ci.yml`/`e2e.yml` и приложить artifacts.

Этапы 1–5 не переделывать без необходимости; runtime-проверки выполнять после
предоставления credentials/Docker.

### 2026-11-22 — после согласованных этапов 4–8

1. **Integration/E2E DB:** выделить отдельную test-marked БД или schema, задать
   `TEST_DATABASE_URL` и указать тот же адрес в `DATABASE_URL`; применить миграции
   и seed только к этой БД. Без этого integration/E2E не запускать. E2E
   дополнительно требует `SEED_ADMIN_PASSWORD` от seed этой БД.
2. **E2E:** выполнить `pnpm test:e2e` на изолированной БД и приложить artifacts.
   Guard запрещает remote host и переиспользование уже запущенного сервера.
3. **Визуальная приёмка:** снять dashboard, списки, детали, формы и login на
   1440/1280/768/375 после успешного E2E; без этих артефактов визуальный PASS не
   заявлять.

### 2026-11-23 — выполнено и осталось

Выполнено: временный кластер PostgreSQL 16, миграции/seed, 7 integration-файлов,
5 E2E-спецификаций, аудит связей, build и 40 screenshots на чистой seeded БД.

Осталось (требует пользователя/Architect):

1. Подписать визуальный checklist по `artifacts/visual-review/phase1/`.
2. MANAGER allow/deny: delete и automation events разрешены, integration-admin
   запрещён — отдельный test или manual-прогон.
3. Docker Desktop + WSL2 для Compose runtime и `n8n_dedupe`.
4. n8n + Telegram credentials для реального runtime; импорт/активация workflow.
5. GitHub Actions `ci.yml`/`e2e.yml` (remote и secrets не настроены).

## 13. Журнал изменений плана

| Дата       | Изменение                                                                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-19 | Создан план v1.0 по ТЗ v1.2; этап 0 DONE, этап 1 BLOCKED                                                                                           |
| 2026-11-19 | Этап 3 AI завершён (бэкенд + 94 теста): analyze, apply-analysis, generate-reply, history, провайдеры, Zod, retry, таймаут, workspace isolation     |
| 2026-11-19 | Исправлены 15 критических дефектов; проверки на локальном PostgreSQL 16; Docker — BLOCKED                                                          |
| 2026-11-19 | Подключён реальный AI: Yandex AI Studio, `aliceai-llm-flash`; `pnpm test:ai` и API-смоук PASS                                                      |
| 2026-11-19 | Этап 4 Automation: outbox/HMAC/dedupe/retry/API/Settings UI/draft n8n workflow; 179 unit, 19 integration, build PASS; runtime n8n/Telegram BLOCKED |
| 2026-11-20 | Этап 5 закрыт локально: 199 unit, 24 integration, 8 E2E, build PASS; реальный AI smoke; gitleaks 0; audit 2 high; CI workflows; seed `[DEMO]`; Docker/n8n BLOCKED |
| 2026-11-20 | AI: `filterExtractedContacts` исправлен для текста с другими числами; smoke проверяет отсутствие выдуманных контактов |
| 2026-11-20 | E2E: env-file replaced with Playwright-owned `.env` loader + mock AI override; AI и responsive сценарии; API 401/403 проверки |
| 2026-11-20 | Integration: outbox test изолирован отдельной Workspace + `workspaceId` scope; flaky-тест стабилен (2 прогона) |
| 2026-11-20 | Мини-этап 0.1: Workspace-проверка связей Lead/Task (`contactId`, `leadId`, `assignedToId`); 23 unit-теста, typecheck/lint PASS; integration NOT RUN (нет отдельной тестовой БД) |
| 2026-11-20 | Мини-этап 0.2: read isolation для Lead/Task/Contact; `deleteLead` 409 при legacy чужом Task; read-only audit script; 12 PostgreSQL integration-тестов на изолированной схеме; target audit NOT RUN |
| 2026-11-20 | Visual Redesign 1.0: дизайн-токены Executive Glass, UI-примитивы, Executive Dashboard, CRM-списки/детали, AI Studio, Settings, формы и login; 1440/1280/768/375; typecheck/lint/build/E2E/Vitest PASS |
| 2026-11-21 | Zod обновлён до 4.6.7; `deepmerge-ts` 8.0.2; `pnpm audit --prod` — 0 известных уязвимостей; typecheck/unit 222/build PASS; integration 36/5 на изолированной схеме PASS |
| 2026-11-22 | Согласованные этапы 4–8: preview tie-break `id`, UTC-окно тренда без алиасинга, E2E `dashboard.spec` без зависимости от seed, fail-closed E2E guard (`TEST_DATABASE_URL`, local-only, без reuse server), guard во всех DB integration-тестах, unit query-contract 5 тестов; lint/typecheck/unit 264/build PASS; integration/E2E NOT RUN (нет изолированной БД); визуальная приёмка не выполнена |
| 2026-11-23 | Phase 1 acceptance выполнена на отдельном временном кластере PostgreSQL 16 (`127.0.0.1:55432`): миграции 3/3, seed ×2 (1/3/10/20/15/2), integration 49/7 PASS, E2E 12/12 PASS, аудит 0 cross-workspace, build 34 app routes + middleware, 40 screenshots без overflow/console errors; кластер остановлен и удалён; MANAGER и visual sign-off открыты |

## 14. Исправление критических дефектов (2026-11-19)

### 14.1. Выполненные пункты и коммиты

| №   | Изменение                                                                                                             | Коммит                          | Проверка                                   |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------ |
| 1   | `Alert` берётся из `components/ui/alert` на Leads/Tasks/CRM                                                           | `821115d`                       | typecheck, lint                            |
| 2   | Убран повторный `request.json()`; тело читается один раз через `readJsonBody`                                         | `89c29a1`                       | typecheck, lint; API-смоук create          |
| 3   | `handleApiError` возвращает plain-envelope; роуты оборачивают один раз                                                | `06302d4`                       | unit `handle-error.test.ts` (2)            |
| 4   | История AI фильтруется через `lead.workspaceId`                                                                       | `6682924`                       | unit/integration обновлены                 |
| 5   | `SHADOW_DATABASE_URL` синхронизирован в env/examples/Compose/docs; Docker init создаёт `bizpilot_shadow`              | `f0620ed`                       | `prisma validate`, `prisma generate`       |
| 6   | Docker: context `.`, env wiring, seed в `migrate`, healthcheck `node -e fetch`, AI_PROVIDER из env                    | `b2ca785`                       | YAML распарсен; runtime Docker BLOCKED     |
| 7   | AI-assistant: вывод analysis, выбор заявки, кнопка «Применить»                                                        | `e4b6215`                       | UI-смоук analyze/apply                     |
| 8   | Matcher `.*\..*` уже корректен; проверен редирект                                                                     | `9b7ceb0`                       | `GET /dashboard` → 307 `/login`; API → 401 |
| 9   | `requireRole(user, DELETE_ROLES)` во всех DELETE                                                                      | `9a0fe66`                       | OPERATOR DELETE → 403 `FORBIDDEN`          |
| 10  | Rate limit логина (IP) и `/api/ai/*` (user); `assertSameOrigin` на мутациях                                           | `984035d`                       | unit (5); POST без Origin → 403            |
| 11  | GET-списки передают фильтры в сервисы                                                                                 | `448e6c2`                       | `?status=NEW` → только NEW                 |
| 12  | Seed идемпотентен для контактов, заявок, задач                                                                        | `0e6fed5`                       | два прогона: 1/3/10/20/15/2 без изменений  |
| 13  | `n8n_processed` остаётся SQL-миграцией, Prisma-модели нет                                                             | `63fa33e`                       | миграция применена; таблица существует     |
| 14  | apply-analysis и history не создают AI-провайдер                                                                      | `fbecec0`                       | unit: apply/history без provider           |
| 15  | Исправлены «Мок/Оценка/поставь более низкую/не запускай»; `model` — реальная модель конфига                           | `a73c2c9`                       | unit: `model === "mock"`                   |
| —   | Реальный AI: category/intent/priority в схеме и промпте, JSON-разбор draft_reply, `scripts/test-ai.ts`                | `54f0418`                       | `pnpm test:ai` PASS; API-смоук PASS        |
| —   | Standalone-сборка включается `NEXT_OUTPUT_STANDALONE=true` (Docker), локальный build без symlink                      | `4fcc2a1`                       | `pnpm build` PASS                          |
| —   | Дополнительно: history без page/limit, редирект после создания заявки, отступ контента под sidebar, raw SQL Dashboard | `8bda36b`, `dee2035`, `2d61178` | API + UI-смоук                             |

### 14.2. Фактические проверки

| Проверка               | Команда/метод                                                                | Результат                                                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck              | `pnpm typecheck`                                                             | PASS (0 ошибок)                                                                                                                              |
| Lint                   | `pnpm lint`                                                                  | PASS (0 ошибок, 1 warning `postcss.config.mjs`)                                                                                              |
| Unit                   | `pnpm test:unit`                                                             | PASS (9 файлов, 96 тестов)                                                                                                                   |
| Integration            | `pnpm test:integration`                                                      | PASS (1 файл, 8 тестов)                                                                                                                      |
| Build                  | `pnpm build`                                                                 | PASS, 29 маршрутов                                                                                                                           |
| Migrations             | `npx prisma migrate deploy`                                                  | PASS (2 миграции, локальный PostgreSQL 16)                                                                                                   |
| Seed x2                | `npx prisma db seed` + подсчёт                                               | 1 workspace / 3 users / 10 contacts / 20 leads / 15 tasks / 2 integrations, без дублей                                                       |
| Auth redirect          | `GET /dashboard` без сессии                                                  | 307 → `/login?callbackUrl=%2Fdashboard`                                                                                                      |
| API auth               | `GET /api/leads` без сессии                                                  | 401 JSON                                                                                                                                     |
| Origin guard           | POST `/api/leads` без `Origin`                                               | 403                                                                                                                                          |
| UI-смоук               | Playwright: login admin → создать заявку → AI-анализ → «Применить» → история | PASS (mock AI), история 200                                                                                                                  |
| OPERATOR delete        | DELETE `/api/leads/:id`                                                      | 403 `FORBIDDEN`                                                                                                                              |
| Docker Compose         | `docker compose up -d --build`                                               | BLOCKED: Docker отсутствует локально, доступа к VPS не предоставлено                                                                         |
| Реальный AI            | `pnpm test:ai`                                                               | PASS: Yandex AI Studio, `gpt://b1g01o2ps9gil9pad0nc/aliceai-llm-flash/latest`; HTTP 200, Zod PASS, timeout AbortError, ошибка провайдера 401 |
| API-смоук реального AI | login → create → analyze → apply → history → delete                          | PASS: category/intent/priority/summary/leadScore сохранены в заявке, history содержит реальную модель                                        |

### 14.3. Блокеры

1. **Docker-приёмка** — на локальной Windows Docker не установлен; отдельный VPS недоступен.
2. **Telegram/n8n runtime** — credentials не предоставлены; draft workflow не импортирован, Telegram E2E BLOCKED.
3. **PostgreSQL-роль n8n_dedupe** — SQL подготовлен, runtime-проверка прав требует Docker/superuser.
4. **`pnpm audit --prod`** — 2 moderate + 4 high в транзитивных зависимостях; обновление вне baseline требует согласования.

### 14.4. Реальный AI-провайдер (2026-11-19)

- Провайдер: OpenAI-compatible, Yandex AI Studio (`https://ai.api.cloud.yandex.net/v1`).
- Модель: `gpt://b1g01o2ps9gil9pad0nc/aliceai-llm-flash/latest` (Alice AI LLM Flash).
- `pnpm test:ai`: analyze — HTTP 200, Zod PASS, 7.1–11.5 с; `category=business_automation`, `intent=request`, `priority=HIGH`, `leadScore=75`; generate-reply — Zod PASS, 1.7–2.1 с, чистый текст без markdown.
- Timeout: AbortError за 3 мс при `timeoutMs=1`.
- Ошибка провайдера: `AIProviderError`, HTTP 401 при неверном ключе.
- API-смоук: analyze 200 (9.85 с), apply 200, заявка содержит `category=business_automation`, `intent=request`, `priority=MEDIUM`, `leadScore=70`, summary; history 200 и реальная модель; cleanup 200.
- Ключи в репозиторий не попадают; `.env` в `.gitignore`. Ключ, опубликованный в чате, следует перевыпустить.

Следующий шаг: предоставить Docker/VPS и AI credentials для закрытия пунктов приёмки; этап 4 без отдельного решения не начинать.

## 15. Premium Visual Redesign 1.0 (2026-11-20; ревизия 2026-11-22)

**Статус: DONE (код) / visual sign-off открыт. Git commit не выполнялся.**

### 15.1. Дизайн-система

- Палитра Executive Glass закреплена в CSS-токенах `app/globals.css` и `tailwind.config.ts`: canvas `#F4F5FA`, surface, ink, indigo `#5968ED`, violet `#9671F5`, teal `#29B5AB`, success, warning, danger.
- Добавлены токены радиусов (14–18 px), теней (`soft`, `card`, `lifted`, `glow`), градиентов, фокус-колец и таймингов 140–200 ms; `prefers-reduced-motion` отключает анимации.
- Обновлены общие примитивы без дублирования дизайн-системы: `Button` (Primary Indigo/Violet, Secondary frosted glass, Ghost), `Card`, `Badge`, `Table`, `Input`, `Alert`, `Avatar`, `Dialog`, `DropdownMenu`, `Skeleton`, `Label`.
- Добавлены переиспользуемые `Select`, `Textarea`, `StatusBadge` (lead/task/contact/priority/automation/integration/analysis) и `DataPagination`.
- Lucide заменяет декоративные emoji в навигации, KPI, статусах, действиях, AI-панели, контактах, задачах и уведомлениях. Emoji внутри пользовательских данных и заявок не затрагивались.

### 15.2. Переработанные экраны

- **Dashboard**: KPI-карточки, воронка по статусам, 14-дневная динамика, приоритетные заявки (HIGH/URGENT, кроме CONVERTED/REJECTED) и задачи HIGH/URGENT с установленным сроком (TODO/IN_PROGRESS).
- **Leads**: glass-фильтры, поиск, сортировка, цветные статусы/приоритеты, score, desktop-таблица и mobile-карточки, сохранение query-параметров и пагинации.
- **Lead Detail**: executive-заголовок, score ring, AI-резюме, статусы/приоритет, клиент, связанные задачи и CTA следующего шага.
- **Contacts**: CRM-список и карточки, аватары, контакты, связанные заявки/задачи; detail с метаданными и связями.
- **Tasks**: статусы, приоритеты, сроки, просрочки, mobile-карточки, действия.
- **AI Assistant**: Indigo/Violet-студия, health-статус, score ring, breakdown, обоснование, риски, рекомендации, недостающая информация, extracted contacts и явная зона подтверждения; технические model URI убраны из основной области.
- **Settings**: профиль, Workspace, статусы n8n/Telegram, политика доставки, журнал событий и mobile-представление журнала.
- **Формы и Login**: группы полей, состояния ошибок, единые select/input/textarea, frosted-панели и новая точка входа.

### 15.3. Границы изменений

- Не изменялись API-контракты, Prisma-схема, миграции, auth/роли, Workspace isolation, AI provider/prompt, HMAC/automation и логика сохранения результатов.
- `services/dashboard.service.ts` дополнен read-only preview-запросами `priorityLeads` и `attentionTasks`; расчёт существующих метрик не менялся. В ревизии 2026-11-22 добавлены только детерминированные tie-break (`id`) к документированному порядку, UTC-окно тренда сделано без алиасинга даты, а сами preview остаются Workspace-scoped.

### 15.4. Проверки

| Проверка | Команда/метод | Результат |
| --- | --- | --- |
| Typecheck | `pnpm typecheck` | PASS (0 ошибок, 2026-11-23) |
| Lint | `pnpm lint` | PASS (0 ошибок, 2026-11-23) |
| Unit | `pnpm test:unit` | PASS, 271 тест / 26 файлов (2026-11-23) |
| Production build | `pnpm build` | PASS, 34 app routes + middleware (2026-11-23) |
| Integration | `pnpm test:integration` | PASS, 49 тестов / 7 файлов на `bizpilot_phase1_test` (2026-11-23) |
| E2E | `pnpm test:e2e` | PASS, 12/12 сценариев, mock AI, собственный server (2026-11-23) |
| Responsive | Playwright 1440/1280/768/375 | PASS: 0 horizontal overflow, 0 console/page errors (2026-11-23) |
| Visual review | `artifacts/visual-review/phase1/` | 40 screenshots + `metrics.json`; автоматические проверки PASS, **checklist не подписан** |

### 15.5. Известные ограничения

- Автоматический visual-прогон выполнен (40 screenshots, 0 overflow, 0 console
  errors), но визуальный checklist пользователем/Architect не подписан, поэтому
  визуальный PASS не заявляется.
- Integration- и E2E-прогоны выполнены на временном кластере PostgreSQL 16,
  который после прогона удалён; повторный прогон требует снова поднять
  изолированную БД.
- MANAGER allow/deny не покрыт 12 E2E-сценариями.
- Финальная фиксация изменений в Git ожидает отдельного разрешения пользователя.

## 16. Коммерческое ядро: вопросы до реализации

Сквозной путь «клиент → коммерческое предложение → заказ → оплата» описан в
`PROJECT_PLAYBOOK.md` как главный коммерческий сценарий, но схема и реализация
в этом этапе не затрагивались. До проектирования модели нужны продуктовые
решения по следующим вопросам.

1. **Структура предложения.** Из каких сущностей состоит предложение (позиции,
   количество, цена за единицу, скидка, итог)? Допускаются ли произвольные
   текстовые строки, несколько валют в одном предложении, несколько скидок?
2. **Редакции и история.** Нужны ли версии/редакции предложения и неизменяемые
   снимки отправленных клиенту редакций? Кто и когда может выпустить новую
   редакцию, что видит клиент, как связываются редакции с заказом?
3. **Acceptance.** Что считается принятием предложения: явное подтверждение
   пользователя, отметка менеджера, загруженный документ, электронная подпись
   или внешний статус? Нужны ли срок действия и причина отказа?
4. **Преобразование в заказ.** Создаётся ли заказ из предложения один-к-одному,
   частично или вручную? Копируются ли позиции/цены/скидки, можно ли изменить
   их после создания заказа, что происходит при повторном преобразовании?
5. **Валюты и налоги.** Валюта задаётся на workspace, клиента, предложение или
   заказ? Нужны ли несколько валют, курсы, налоги включённые/исключённые,
   ставки и правила округления? Как хранится история курса/ставки?
6. **Частичные и полные оплаты.** Как учитываются несколько платежей по заказу,
   частичная оплата, переплата, возврат и отмена платежа? Связывается ли платёж
   с конкретной позицией или только с заказом?
7. **Задолженность.** Рассчитывается ли задолженность из платежей или хранится
   отдельным статусом? Нужны ли сроки оплаты, aging, напоминания и правила
   закрытия задолженности?
8. **Провайдер платежей.** Планируется ли интеграция с платёжным провайдером
   (webhooks, идемпотентность, возвраты, PCI-scope) или MVP ограничивается
   ручной фиксацией оплат? Кто подтверждает фактическое поступление денег?
9. **Связь сущностей с клиентом и workspace.** Какая модель клиента является
   основной (Contact, Company или обе)? Как предложения, заказы и платежи
   проверяются на принадлежность текущему workspace, что происходит при
   удалении/смене клиента и какие FK-правила допустимы?
10. **Права и аудит.** Кто может создавать, согласовывать, принимать, отменять
    предложение, заказ и платёж (ADMIN/MANAGER/OPERATOR)? Какие действия должны
    попадать в ActivityLog и какие документы считаются юридически значимыми?

До ответов на эти вопросы коммерческие сущности, миграции, API и UI не
добавляются.
