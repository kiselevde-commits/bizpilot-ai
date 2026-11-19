# AGENTS.md — BizPilot AI

Этот файл обязателен для любого AI-агента и разработчика, работающего с репозиторием BizPilot AI.

## 1. Назначение продукта

BizPilot AI — демонстрационная SaaS-платформа управления заявками (Leads), контактами (Contacts), задачами (Tasks) и бизнес-процессами с использованием реального LLM и n8n.

Главный сценарий:

1. Пользователь создаёт заявку.
2. AI анализирует текст заявки.
3. AI определяет категорию, намерение, приоритет и эвристическую оценку `lead_score`.
4. AI извлекает контактные данные только при их наличии в исходном тексте.
5. AI формирует резюме, недостающую информацию, рекомендуемое действие и черновик ответа.
6. Пользователь проверяет и подтверждает применение результата.
7. В CRM создаётся или связывается контакт, при необходимости создаётся задача.
8. Через n8n отправляется уведомление в Telegram.
9. Повторные вызовы не создают дублей.

Это рабочий продукт, а не кликабельный макет. Запрещены фиктивные кнопки, статические AI-ответы в рабочем режиме и имитация интеграций.

## 2. Согласованный стек и точные версии

Прямые зависимости в `package.json` фиксируются без `^` и `~`. `pnpm-lock.yaml` обязателен и коммитится. Docker-образы используют точные tags, не `latest`.

| Компонент               | Версия                | Примечание                                          |
| ----------------------- | --------------------- | --------------------------------------------------- |
| Node.js                 | 24.20.0 LTS (Krypton) | runtime                                             |
| pnpm                    | 9.15.9                | фиксируется через `packageManager` / Corepack       |
| Next.js                 | 15.5.29               | App Router                                          |
| React / React DOM       | 19.1.10               |                                                     |
| TypeScript              | 5.9.3                 | `strict: true`                                      |
| Prisma / @prisma/client | 6.19.3                | PostgreSQL                                          |
| PostgreSQL              | 16.16                 | Docker image `postgres:16.16-alpine`                |
| Auth.js (next-auth)     | 5.0.0-beta.32         | beta; stable v5 не существует                       |
| Zod                     | 3.25.76               |                                                     |
| Tailwind CSS            | 3.4.19                |                                                     |
| bcryptjs                | 3.0.3                 | cost 12                                             |
| ESLint                  | 9.39.5                |                                                     |
| Vitest                  | 5.1.1                 |                                                     |
| Playwright              | 1.65.1                |                                                     |
| n8n                     | 1.123.98              | baseline 1.x; см. риск EOL в `docs/ARCHITECTURE.md` |

Полная таблица версий, источники проверки и риски — в `docs/ARCHITECTURE.md`.

Правила:

- Не менять major-линии стека без явного согласования.
- Не добавлять зависимости без причины.
- Не использовать `latest` в Docker.
- Не обновлять версии «заодно» с другой задачей.
- Auth.js v5 использовать только в точной опубликованной beta-версии; beta-риск фиксируется в документации.

## 3. Архитектура: три слоя

Используются ровно три слоя. Отдельный `domain/` не создаётся.

1. **Presentation** — `app/`, `components/`: страницы, layout, UI-компоненты, клиентские формы.
2. **Application / Services** — `services/`, небольшие чистые модули `lib/`: сценарии использования, orchestration, бизнес-правила, проверки прав и Workspace scope.
3. **Infrastructure** — `lib/database`, `lib/ai`, `lib/integrations`, `lib/security`: Prisma, LLM, n8n, Telegram, HMAC, rate limiting, внешние API.

Правила:

- Бизнес-логика не размещается в React-компонентах.
- Route Handlers тонкие: аутентификация → валидация → service → единый ответ.
- Сервисы не импортируют React и не зависят от UI.
- Инфраструктурные адаптеры изолированы интерфейсами.
- PostgreSQL — источник истины для бизнес-данных.
- AI не имеет прямого доступа к БД.
- Ошибка n8n не ломает CRM.
- Повторный webhook не создаёт дубль.
- Все бизнес-запросы учитывают `workspaceId`.

## 4. Структура каталогов

Создавать каталоги по мере реализации, без пустых папок «для схемы».

```text
app/
  (auth)/login/
  (dashboard)/
    dashboard/
    leads/
    crm/
    tasks/
    ai-assistant/
    settings/
  api/
    auth/
    leads/
    contacts/
    tasks/
    ai/
    automation/
    webhooks/
components/
  ui/
  layout/
  dashboard/
  leads/
  contacts/
  tasks/
  ai/
lib/
  ai/
  auth/
  database/
  integrations/
  security/
  utils/
  validation/
services/
prisma/
  schema.prisma
  migrations/
  seed.ts
n8n/workflows/
scripts/
tests/
  unit/
  integration/
  e2e/
docs/
```

## 5. TypeScript

- `strict: true`, `noUncheckedIndexedAccess`, `noImplicitOverride`.
- Не использовать `any`. Для неизвестных данных — `unknown` + Zod.
- Не использовать `@ts-ignore`; при крайней необходимости `@ts-expect-error` с объяснением.
- Все внешние границы (HTTP body/query/params, AI response, webhook payload) валидируются Zod.
- Server-only модули помечаются `import "server-only"`; секреты и Prisma не попадают в клиентский bundle.
- Публичные функции сервисов имеют явные типы аргументов и результата.
- Enum-значения не дублировать произвольно: runtime-константы в `lib/constants.ts`, Prisma enum и Zod schema должны совпадать; соответствие проверяется тестом.

## 6. Prisma и миграции

- Схема: `prisma/schema.prisma`.
- Изменения только через Prisma migrations; `prisma db push` в production запрещён.
- `prisma migrate deploy` применяет миграции в Docker/CI.
- Seed: `prisma/seed.ts`, запуск через `prisma db seed`. Все три demo-пользователя используют один `SEED_ADMIN_PASSWORD`; пароль не публикуется.
- Пароль seed-пользователей берётся только из `SEED_ADMIN_PASSWORD`; при отсутствии/пустом значении seed завершается ошибкой. Дефолтный пароль запрещён.
- Для бизнес-сущностей обязательны `workspaceId`, `createdById`, `updatedById` (кроме случаев, явно описанных в схеме).
- Удаление: hard delete по правилам раздела 24.7 ТЗ. Cascade только `Lead → AIAnalysis`. `Task.leadId` при удалении Lead становится `NULL`. Contact с связанными Lead/Task удалять нельзя (409 `ENTITY_IN_USE`). ActivityLog не удаляется и не имеет FK на удаляемую сущность.
- Не добавлять циклическую связь `latestAnalysisId`; последний анализ — `AIAnalysis` с сортировкой `createdAt DESC`, limit 1.
- Индексы обязательны согласно `docs/ARCHITECTURE.md`.
- Нормализованные email/phone хранятся в отдельных полях Contact и индексируются вместе с `workspaceId`.
- Таблица `n8n_processed` создаётся SQL-миграцией, а не Prisma-моделью.

## 7. API и единый формат ошибок

Успех:

```json
{ "success": true, "data": {}, "error": null }
```

Ошибка:

```json
{
  "success": false,
  "data": null,
  "error": { "code": "VALIDATION_ERROR", "message": "Invalid request" }
}
```

Правила:

- Все входные данные валидируются Zod.
- Для бизнес-endpoints обязательны auth, role check и Workspace scope.
- `workspaceId` никогда не берётся из тела/query/заголовков клиента; только из проверенной сессии и БД.
- Списки: `page=1`, `limit=20` (1–100), `search`, `status`, `priority` (Leads/Tasks), `sort=createdAt:desc`.
- Сортировка — только allow-list полей и направлений; пользовательская строка не передаётся в Prisma `orderBy`.
- Ответ списка: `items` + `pagination: { page, limit, total, totalPages }`.
- Ошибки не раскрывают stack trace, SQL, секреты, prompt и raw provider response.
- HTTP-коды: 400 validation, 401 auth, 403 role, 404 not found, 409 conflict/entity in use/duplicate, 413 body too large, 429 rate limit, 500 internal, 502/504 AI provider.
- Коды ошибок: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `ENTITY_IN_USE`, `DUPLICATE_CONTACT`, `PAYLOAD_TOO_LARGE`, `RATE_LIMITED`, `AI_NOT_CONFIGURED`, `AI_PROVIDER_ERROR`, `AI_TIMEOUT`, `AI_INVALID_RESPONSE`, `INVALID_SIGNATURE`, `STALE_TIMESTAMP`, `INTERNAL_ERROR`.
- `POST /api/webhooks/lead-created` отсутствует и не документируется как доступный.
- `POST /api/webhooks/n8n` защищён отдельным HMAC callback-секретом, timestamp и replay window ±5 минут.
- Для cookie-authenticated mutations проверяется `Origin` на сервере; SameSite и CSRF Auth.js учитываются.
- Лимиты body: `/api/leads` и `/api/ai/*` — 256 KB; остальные бизнес-endpoints и webhook — 64 KB. Проверять `Content-Length` и фактическое число прочитанных байт до JSON.parse; при превышении 413.

## 8. Авторизация и роли

- Auth.js v5, Credentials Provider, JWT sessions.
- Пользователи хранятся в PostgreSQL; проверка пароля через `bcryptjs.compare`.
- Credentials Provider не создаёт пользователей через Prisma Adapter. Пользователи создаются seed-ом.
- Cookie: `httpOnly`, `secure` в production, корректный `sameSite`.
- `middleware.ts` — первый барьер: страницы без сессии → redirect `/login`; API без сессии → 401. Исключения: `/api/auth/*`, `/api/webhooks/*` (собственная HMAC-аутентификация), `/api/ai/health`.
- Middleware не заменяет серверную авторизацию. Каждый Route Handler и service повторно получает пользователя из БД, проверяет роль и Workspace.
- JWT не является источником истины для роли: сервис читает актуального пользователя из БД.
- IDOR protection: любой объект ищется с `id + workspaceId`; чужая запись → 404.
- Скрытие кнопок не является защитой.

Матрица прав:

| Действие                                   | ADMIN |     MANAGER | OPERATOR |
| ------------------------------------------ | ----: | ----------: | -------: |
| Dashboard                                  |    да |          да |       да |
| Leads: просмотр/создание/редактирование    |    да |          да |       да |
| Leads: удаление                            |    да |          да |      нет |
| Contacts: просмотр/создание/редактирование |    да |          да |       да |
| Contacts: удаление                         |    да |          да |      нет |
| Tasks: просмотр/создание/редактирование    |    да |          да |       да |
| Tasks: удаление                            |    да |          да |      нет |
| AI-анализ                                  |    да |          да |       да |
| Управление пользователями                  |    да |         нет |      нет |
| Управление интеграциями                    |    да |         нет |      нет |
| Настройки приложения                       |    да | ограниченно |      нет |
| Журнал automation events                   |    да |          да |      нет |
| Retry automation event                     |    да |          да |      нет |

Settings в MVP: read-only profile, read-only automation status, read-only integrations status, logout. Формы изменения ENV/токенов/секретов не создавать.

## 9. Workspace scope

- MVP фактически single-tenant, но `Workspace` существует с seed-записью.
- Все бизнес-сущности имеют `workspaceId` и FK на Workspace.
- `workspaceId` для запроса берётся из пользователя, загруженного из БД.
- Проверка связей: Lead.contactId, Task.contactId, Task.leadId, assignedToId должны принадлежать тому же Workspace.
- Дубли контактов проверяются только внутри Workspace.
- Юнит/интеграционные тесты обязаны проверять, что пользователь Workspace A не видит и не меняет данные Workspace B.

## 10. AI adapter и валидация

- Универсальный OpenAI-compatible adapter; по умолчанию OpenRouter.
- ENV: `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_TIMEOUT_MS=60000`.
- Адаптер вызывает `${AI_BASE_URL}/chat/completions` через серверный `fetch`; API-ключ никогда не попадает на клиент.
- Пользовательский текст обрамляется `<<<USER_INPUT>>>` и `<<<END_USER_INPUT>>>`; маркеры внутри текста нейтрализуются.
- System prompt явно объявляет содержимое между маркерами недоверенными данными.
- Модель не получает tools/functions, не выполняет SQL/команды и не инициирует внешние действия.
- Ответ валидируется Zod: enum, диапазоны 0–100, длины `summary ≤ 300`, `draft_reply ≤ 800`.
- Один retry только при невалидном JSON. Максимум 60 секунд на весь запрос включая retry; `AbortController` реально прерывает HTTP.
- Максимум 4000 output tokens.
- При повторной ошибке — понятная ошибка пользователю; история успешных и неуспешных попыток сохраняется в `AIAnalysis`.
- Не сохранять полный prompt и raw response; хранить `promptHash` SHA-256, provider, model, status, resultJson, tokens, durationMs, errorMessage.
- AI не меняет бизнес-поля Lead, включая `status`, до подтверждения пользователем. `ANALYZING` — допустимый статус для ручного использования/UI, но analyze endpoint его не записывает. Применение результата — отдельный endpoint и транзакция с ActivityLog.
- `AI_PROVIDER=mock` допустим только в тестах/E2E и только при `ALLOW_MOCK_AI=true`; в production mock запрещён.
- Реальный LLM проверяется отдельно `scripts/test-ai.ts`, не в CI.

## 11. n8n, HMAC и идемпотентность

- n8n — необязательная интеграция; CRM работает при выключенном n8n.
- Создание Lead и `AutomationEvent(PENDING)` — одна Prisma-транзакция.
- После commit — best-effort fire-and-forget dispatcher; надёжность обеспечивает PostgreSQL outbox, а не Promise.
- Lazy dispatcher вызывается на Dashboard, Settings/Automation и automation API; максимум 10 событий за запрос.
- Захват события — атомарный DB lease: `lockedAt` + `lockToken`, lease 5 минут; in-memory lock запрещён.
- `idempotencyKey` создаётся BizPilot до первой отправки и не меняется при retry.
- Исходящая подпись: `HMAC-SHA256(N8N_WEBHOOK_SECRET, timestamp + "." + rawBody)`, заголовки `X-BizPilot-Signature`, `X-BizPilot-Timestamp`, `X-BizPilot-Event-Id`.
- Callback: `HMAC-SHA256(N8N_CALLBACK_SECRET, timestamp + "." + rawBody)`, заголовки `X-N8N-Signature`, `X-N8N-Timestamp`; constant-time compare; окно ±5 минут.
- n8n dedupe: PostgreSQL `n8n_processed`, атомарный `INSERT ... ON CONFLICT DO NOTHING RETURNING`; без SELECT-then-INSERT.
- n8n использует отдельную роль только с SELECT/INSERT/UPDATE на `n8n_processed`; доступ к пользователям, лидам, контактам и паролям запрещён.
- Retry: 1 первоначальная + максимум 3 автоматические попытки; задержки 1 мин, 5 мин, 30 мин; максимум 24 часа с `createdAt`; после — FAILED.
- `attempts` увеличивается только при фактическом HTTP-вызове n8n. Постоянные 4xx (кроме 429) → FAILED. 429 учитывает `Retry-After`.
- Статусы: `PENDING → SENT → DELIVERED`, `SENT → FAILED`, `FAILED → RETRYING → SENT/FAILED`. `SENT` = n8n принял запрос, `DELIVERED` = Telegram подтверждён callback.
- Ручной retry: ADMIN/MANAGER, только FAILED, до 24 часов, то же событие и тот же ключ.
- `CLAIMED` в `n8n_processed` старше 15 минут не переотправлять автоматически; показывать для ручной сверки.
- Telegram — только уведомления; приём сообщений ботом вне MVP.

## 12. Безопасность и секреты

- Секреты только в ENV / credentials; не в коде, Git, клиентском bundle, логах, workflow JSON.
- `.env` в `.gitignore`; `.env.example` без значений секретов.
- Пароли — bcryptjs cost 12; не логировать.
- Rate limiting in-memory Map + TTL: auth 5/15 мин/IP; AI 10/час/user; CRUD 100/мин/user; webhook 1000/мин/IP. 429 + `Retry-After`.
- Ограничение одного процесса: счётчики сбрасываются при рестарте и не синхронизируются между экземплярами.
- Ошибки клиенту — безопасные; внутренние детали только в серверные логи с redaction.
- Не логировать полные сообщения заявок, prompt, raw AI response, email/phone и токены.
- Prisma и параметризованные запросы; raw SQL только с параметрами.
- CSRF/Origin для cookie-auth mutations; webhook — HMAC + timestamp.
- Зависимости проверяются `pnpm audit --prod`; секреты — secret scanner, не обычный grep.
- Известные ограничения MVP: single-tenant, in-memory rate limit, JWT без revocation, hard delete, mock в части integration-тестов, Telegram E2E вручную, один n8n workflow.

## 13. Тестирование

- Unit (Vitest): Zod schemas, AI JSON validation, lead scoring, priority rules, status transitions, task rules, role checks, idempotency key, normalize email/phone, sort allow-list, HMAC, body limit.
- Integration: CRUD + Prisma с тестовой PostgreSQL; AI adapter (valid, invalid JSON, timeout, provider error); n8n webhook (HMAC, idempotency, replay, retry, errors).
- E2E (Playwright): login + create lead; AI analysis с mock adapter. Реальный LLM в CI не запускать.
- `scripts/test-ai.ts` — ручной smoke test реального provider; результат фиксируется в `docs/IMPLEMENTATION_PLAN.md`.
- Telegram — ручной тест с credentials; в CI `test.skip` с пояснением.
- Mocks допустимы, но не заменяют реальный smoke test.
- Не отмечать тест/сборку успешными, если они не запускались.

## 14. Команды

Команды появляются по мере этапов; после этапа 1 обязательны:

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm typecheck
pnpm test
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm test:ai
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
pnpm format
pnpm format:check
```

Docker:

```bash
docker compose up -d --build
docker compose --profile automation up -d
```

## 15. Обязательно перед завершением задачи

- Изучить существующий код и не ломать его.
- Обновить `docs/IMPLEMENTATION_PLAN.md` (статус, проверки, следующий шаг).
- Обновить `docs/ARCHITECTURE.md` при изменении архитектуры/API/схемы.
- Запустить релевантные проверки: typecheck, lint, unit, integration, build (что применимо).
- Проверить Workspace scope и права для новых endpoint/сервисов.
- Проверить отсутствие секретов в изменениях.
- В отчёте указать только фактически выполненные проверки и их результаты.

## 16. ВСЕГДА

- Перед изменением изучать соответствующий существующий код.
- Следовать принятой архитектуре и соглашениям.
- Валидировать все входящие данные.
- Проверять права пользователя на сервере.
- Учитывать `workspaceId` при запросах бизнес-данных.
- Писать тесты для новой бизнес-логики.
- Обновлять документацию при изменении API или архитектуры.
- Запускать релевантные проверки после значимых изменений.
- Сохранять прогресс в `docs/IMPLEMENTATION_PLAN.md`.
- В отчёте указывать только реально выполненные проверки.

## 17. НИКОГДА

- Не переписывать весь проект ради локального исправления.
- Не менять стек без согласования.
- Не добавлять зависимости без причины.
- Не помещать секреты в код или клиент.
- Не обходить серверную авторизацию.
- Не доверять AI-ответу без схемной валидации.
- Не отправлять клиентские сообщения автоматически.
- Не заявлять о прохождении тестов без запуска.
- Не удалять существующую функциональность без согласования.
- Не создавать фиктивные кнопки и имитацию интеграций.
- Не подменять реальный AI статическими ответами в рабочем приложении.
- Не использовать `latest` в Docker.
- Не добавлять `domain/` и четвёртый слой.
- Не добавлять `POST /api/webhooks/lead-created`.

## 18. Документация

Обязательные документы MVP:

- `README.md`
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/API.md`
- `docs/SECURITY.md`
- `docs/DEPLOYMENT.md`
- `docs/N8N.md`

Документация — часть приёмки, а не задача «если останется время».
