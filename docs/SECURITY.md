# Безопасность BizPilot AI

**Версия:** этап 5 (2026-11-20).  
**Статус:** обязательные механизмы реализованы и проверены (typecheck, lint,
unit, integration, E2E, build, реальный AI smoke, secret scan). Runtime-проверки
**n8n, Telegram, PostgreSQL-роль n8n_dedupe и Docker** остаются **BLOCKED**.
Таблица ниже фиксирует только фактически выполненные проверки.

## 1. Модель безопасности

- PostgreSQL — источник истины для бизнес-данных и outbox.
- Все бизнес-запросы ограничены `workspaceId`, полученным из пользователя,
  загруженного из БД. `workspaceId` из body/query/заголовков не принимается.
- Роль и Workspace перечитываются из БД; JWT не является источником истины для
  прав.
- Cookie-auth mutations проверяют `Origin` (allowed set: `APP_BASE_URL`, реальный
  origin запроса, `Host`/`X-Forwarded-Host`, нормализованные http/https); Auth.js
  использует CSRF-защиту.
- Внешний webhook не использует сессию: только HMAC + timestamp.
- Секреты хранятся только в ENV / n8n Credentials. В Git, клиентский bundle,
  workflow JSON и логи они не попадают.
- Ошибки клиенту безопасны; stack trace, SQL, секреты, prompt и raw provider
  response не раскрываются.
- AI не имеет tools/functions, не выполняет SQL/команды и не инициирует
  внешние действия. Ответ валидируется Zod.
- AI не меняет бизнес-поля Lead до подтверждения пользователем.
- Контакты, извлечённые LLM из текста заявки, проверяются сервером
  (`filterExtractedContacts`): в ответ попадают только значения, реально
  упомянутые в тексте; выдуманные данные не сохраняются и не показываются.

## 2. Аутентификация и роли

- Auth.js v5 `5.0.0-beta.32`, Credentials, JWT-сессии, bcryptjs cost 12.
- Сессия в httpOnly cookie; `secure` в production; `sameSite=lax`.
- `middleware.ts` — первый барьер; Route Handlers и сервисы повторно проверяют
  пользователя, роль и Workspace.
- Матрица: удаление Lead/Contact/Task — ADMIN/MANAGER; automation events/status/
  retry — ADMIN/MANAGER; OPERATOR получает `403 FORBIDDEN` при прямом запросе.
- IDOR: объекты ищутся по `id + workspaceId`; чужая запись → `404`.
- OPERATOR не видит раздел автоматизации в `/settings`; серверный API всё равно
  возвращает 403.

## 3. HMAC и защита webhook

### 3.1. Исходящий BizPilot → n8n

```text
HMAC-SHA256(N8N_WEBHOOK_SECRET, timestamp + "." + rawBody)
```

Заголовки `X-BizPilot-Signature`, `X-BizPilot-Timestamp`,
`X-BizPilot-Event-Id`. Timestamp — Unix seconds, окно ±5 минут. Секрет не
логируется.

### 3.2. Входящий n8n → BizPilot

```text
HMAC-SHA256(N8N_CALLBACK_SECRET, timestamp + "." + rawBody)
```

Заголовки `X-N8N-Signature`, `X-N8N-Timestamp`.

- Подпись проверяется по **исходным байтам** тела до `JSON.parse`; тело не
  пересобирается через `JSON.stringify`.
- `crypto.timingSafeEqual` используется после проверки формата/длины.
- Timestamp проверяется на прошлое и будущее ±5 минут.
- `N8N_CALLBACK_SECRET` обязан отличаться от `N8N_WEBHOOK_SECRET`; при
  совпадении callback считается не настроенным (503).
- Повторный callback идемпотентен по `idempotencyKey`; `DELIVERED` не
  понижается до `FAILED`.
- Workspace берётся из сохранённого `AutomationEvent`; присланный `workspaceId`
  игнорируется.

## 4. Outbox и БД

- Lead + `AutomationEvent(PENDING)` — одна транзакция.
- Захват события — атомарный SQL с `FOR UPDATE SKIP LOCKED`; lease
  `lockedAt`/`lockToken` 5 минут; in-memory lock отсутствует.
- `attempts` увеличивается только при фактическом HTTP-вызове.
- Retry: 1 + 3 (1/5/30 минут), максимум 24 часа; 4xx кроме 429 — терминально.
- `n8n_processed`: основной механизм `INSERT ... ON CONFLICT DO NOTHING
RETURNING`; `FAILED` переотправляется только ручным retry через атомарный
  `UPDATE ... WHERE status='FAILED'`. `CLAIMED` старше 15 минут не
  переотправляется автоматически.
- SQL injection: Prisma/параметризованные запросы; raw SQL только tagged
  template; пользовательские строки не конкатенируются в SQL.
- Особенность: Prisma `DateTime` — `timestamp(3)` без timezone; dispatcher
  использует `AT TIME ZONE 'UTC'`, чтобы lease не зависел от timezone сессии.

## 5. Rate limiting и лимиты body

| Группа                   |      Лимит | Ключ    |
| ------------------------ | ---------: | ------- |
| Auth                     | 5 / 15 мин | IP      |
| AI                       |   10 / час | user id |
| CRUD                     |  100 / мин | user id |
| Automation events/status |  100 / мин | user id |
| Automation retry         |   30 / мин | user id |
| n8n webhook              | 1000 / мин | IP      |

- In-memory Map + TTL; сбрасывается при рестарте; один процесс.
- `429` + `Retry-After`.
- Body limits: 256 KB для Leads/AI, 64 KB для остальных и webhook; проверяется
  `Content-Length` и фактическое число байт; `413`.
- IP из `x-forwarded-for`/`x-real-ip`; безопасно только за доверенным proxy.

## 6. Секреты и утечки

- `.env` в `.gitignore`; отслеживаются только `.env.example` и
  `.env.docker.example` с `CHANGE_ME`/пустыми значениями.
- AI-ключ используется только в серверном `fetch`.
- Telegram bot token — только n8n Credential (или защищённый ENV n8n).
- PostgreSQL `n8n_dedupe` — отдельная роль без superuser и без доступа к CRM.
- `n8n/workflows/lead_created_notification.json` не содержит токенов,
  паролей и HMAC-секретов; используются `$env` и placeholder credentials.
- Ошибки n8n/Telegram санитизируются: URL, `bot<token>`, `Bearer`,
  `postgres://` заменяются на `[REDACTED]`/`[URL]`.
- Логи не содержат полный текст заявки, prompt, raw AI response, email/phone,
  токены и HMAC-секреты.

## 7. PostgreSQL-роли n8n

`docker/n8n/init-db.sql` создаёт:

- `n8n_app` — владелец отдельной БД `n8n`; `NOSUPERUSER NOCREATEDB
NOCREATEROLE`; доступ к CRM-БД отозван.
- `n8n_dedupe` — LOGIN, `CONNECT` к CRM-БД, `USAGE` на `public`, только
  `SELECT/INSERT/UPDATE` на `n8n_processed`; без `DELETE` и без прав на таблицы
  CRM.

Проверка прав (после создания роли):

```sql
SELECT
  has_table_privilege('n8n_dedupe', 'n8n_processed', 'SELECT') AS can_select,
  has_table_privilege('n8n_dedupe', 'n8n_processed', 'INSERT') AS can_insert,
  has_table_privilege('n8n_dedupe', 'n8n_processed', 'UPDATE') AS can_update,
  has_table_privilege('n8n_dedupe', 'n8n_processed', 'DELETE') AS can_delete,
  has_table_privilege('n8n_dedupe', '"User"', 'SELECT') AS can_read_users;
```

Ожидаемо: `true, true, true, false, false`.

## 8. Результаты проверок (2026-11-20)

| Проверка                     | Команда/метод                                                | Результат              | Замечания                                                                                     | Статус  |
| ---------------------------- | ------------------------------------------------------------ | ---------------------- | --------------------------------------------------------------------------------------------- | ------- |
| Typecheck                    | `pnpm typecheck`                                             | 0 ошибок               | strict + noUncheckedIndexedAccess                                                             | PASS    |
| Lint                         | `pnpm lint`                                                  | 0 ошибок, 1 warning    | warning в `postcss.config.mjs` (pre-existing)                                                 | PASS    |
| Unit                         | `pnpm test:unit`                                             | 222 теста / 21 файл    | включая AI schema/prompt/contacts, HMAC, roles, origin, rate limit, Workspace-связи            | PASS    |
| Integration                  | `pnpm test:integration`                                      | 24 теста / 4 файла     | реальный PostgreSQL; два повторных прогона подряд                                             | PASS    |
| E2E                          | `pnpm test:e2e`                                              | 8 сценариев            | auth, CRM, AI (mock), responsive UI; Chromium                                                 | PASS    |
| Production build             | `pnpm build`                                                 | успешно                | 35 routes                                                                                     | PASS    |
| Реальный AI smoke            | `pnpm test:ai`                                               | HTTP 200, Zod PASS     | Yandex AI Studio; `extractedContacts` сверены с текстом                                      | PASS    |
| `pnpm audit --prod`          | `pnpm audit --prod`                                          | 2 high                 | `zod@3.25.76`, `deepmerge-ts@7.1.5`; см. раздел 9                                             | FAIL    |
| Secret scan (исходники + вся Git-история) | `gitleaks detect --source . --redact`; `gitleaks detect --no-git` | 0 находок              | gitleaks 8.30.1; 31 коммит + рабочее дерево (кроме `.env`/deps)                              | PASS    |
| `.gitignore` и env examples  | `git ls-files`, `git check-ignore`                           | `.env` не отслеживается | в Git только `.env.example` и `.env.docker.example` с `CHANGE_ME`                            | PASS    |
| IDOR/BOLA и Workspace scope  | `tests/integration/workspace-isolation.integration.test.ts`  | 5 тестов               | A не читает/не перечисляет/не меняет/не удаляет записи B; API использует `requireUser`        | PASS    |
| Workspace-связи Lead/Task    | `tests/unit/lead-task-workspace-relations.test.ts`           | 23 теста               | `contactId`/`leadId`/`assignedToId`: чужой или несуществующий → 404; `null` очищает; отказ без ActivityLog/Outbox | PASS    |
| Read-time Workspace isolation | `tests/integration/workspace-read-isolation.integration.test.ts` | 12 тестов              | real PostgreSQL в изолированной схеме: чужие Contact/User/Lead/Task не попадают в list/get и HTTP JSON; свои записи доступны | PASS (isolated) |
| Удаление Lead с legacy Task  | тот же integration-файл                                      | 3 теста                | чужой Task → 409 без частичных изменений; свой Task отвязывается (`leadId=NULL`); FK `ON DELETE SET NULL` учтён; HTTP 409 envelope | PASS (isolated) |
| Исторический аудит связей    | `pnpm exec tsx scripts/audit-workspace-relations.ts`         | только counts          | инструмент проверен на временной схеме; на dev/seed и целевой БД не запускался; cross-workspace → exit 2 | PASS (tool) / NOT RUN (target) |
| SQL injection                | статический поиск + integration                              | нет unsafe-вызовов     | нет `$queryRawUnsafe`/`$executeRawUnsafe`; raw SQL только tagged template                      | PASS    |
| XSS                          | статический поиск                                            | нет опасных sink       | нет `dangerouslySetInnerHTML`/`innerHTML`; React экранирует; CSP не настроен                  | PASS    |
| CSRF и Same-Origin           | unit `origin.test.ts`, E2E mutations                         | отклоняет чужой/пустой Origin | Auth.js CSRF + `assertSameOrigin` на cookie-auth mutations                              | PASS    |
| Authentication bypass        | E2E: `/leads` → `/login`, `GET /api/leads` → 401             | 401/redirect           | middleware + повторная проверка в Route Handler/сервисе                                      | PASS    |
| Role bypass                  | unit `roles.test.ts`, E2E OPERATOR                           | 403                    | OPERATOR DELETE lead → 403, automation events → 403, раздел скрыт                             | PASS    |
| Rate-limit bypass            | unit `api-guards.test.ts`                                    | блокирует сверх лимита | 429 + Retry-After; in-memory на процесс                                                       | PASS    |
| HMAC и replay                | unit HMAC/route + PostgreSQL integration                     | PASS                   | raw bytes, ±5 мин, constant-time, `n8n_processed` dedupe; реальный n8n не проверен           | PASS    |
| Утечки секретов в ошибках/логах | code review + E2E console                                   | чисто                  | логируют id/name/attempt, без prompt, raw response, email/phone, URL и токенов                 | PASS    |
| Docker Compose runtime       | `docker compose ... up`                                      | не выполнялся          | Docker отсутствует локально; CI job `docker` добавлен, но ещё не запускался                    | BLOCKED |
| PostgreSQL-роль `n8n_dedupe` | Docker/psql runtime                                          | не выполнялась         | SQL подготовлен; нужен Docker/superuser                                                       | BLOCKED |
| Реальный n8n + Telegram      | manual E2E                                                   | не выполнялся          | нет n8n/Telegram credentials; workflow — draft                                                | BLOCKED |

### 8.1. API smoke (локальный PostgreSQL)

Проверено фактически:

1. login ADMIN;
2. создание заявки → `AutomationEvent(PENDING)`, `attempts=0`, n8n не настроен;
3. `GET /api/automation/status` → counts, `configured=false`;
4. подписанный callback `delivered` → событие `DELIVERED`;
5. повторный callback → `duplicate=true`;
6. неверная подпись → `401 INVALID_SIGNATURE`;
7. callback `failed` → событие `FAILED`;
8. ручной retry ADMIN → `RETRYING`;
9. OPERATOR → `403`;
10. cleanup.

### 8.2. UI smoke (Playwright)

Проверено фактически:

- `/settings` рендерит профиль, n8n/Telegram, политику доставки, журнал;
- FAILED-событие видно с ошибкой;
- кнопка «Повторить» вызывает API, показывает toast, строка становится
  `Ожидает повтора`;
- OPERATOR видит «Автоматизация недоступна» и не видит журнал.

### 8.3. Границы гарантий мини-этапа 0.2

- Write-path проверки (0.1) не позволяют создавать новые cross-workspace связи.
- Read-path проверки (0.2) возвращают `null`/пустые массивы для уже существующих некорректных связей и не раскрывают чужие поля.
- Исторические строки автоматически не исправляются и не удаляются. Аудит `scripts/audit-workspace-relations.ts` только считает связи; запуск на dev/seed/целевой БД требует отдельного разрешения.
- `deleteLead` не полагается только на FK: при legacy Task другого Workspace удаление отклоняется с общим 409 до любых изменений.
- Полная Workspace isolation не считается подтверждённой до аудита целевой БД и устранения найденных cross-workspace строк.
- Integration-файл запускать только с `DATABASE_URL`, указывающим на изолированную БД/схему:
  `DATABASE_URL=<isolated> pnpm exec vitest run tests/integration/workspace-read-isolation.integration.test.ts`.
- Read-only аудит: `DATABASE_URL=<target> pnpm exec tsx scripts/audit-workspace-relations.ts`.
- Windows PowerShell (bash-синтаксис `VAR=value command` не работает):
  ```powershell
  $env:DATABASE_URL = "postgresql://<user>:<password>@<host>:5432/<target>?schema=public"
  pnpm exec tsx scripts/audit-workspace-relations.ts
  Remove-Item Env:DATABASE_URL
  ```
  Для integration-файла — та же схема с `pnpm exec vitest run tests/integration/workspace-read-isolation.integration.test.ts`.

## 9. `pnpm audit --prod` (фактический результат)

Команда завершилась с exit code 1: **2 high, 0 critical, 0 moderate**.

Совместимые исправления (patch/minor) применены через `pnpm.overrides` в
`package.json`:

| Пакет   | Было   | Стало  | Причина                                   |
| ------- | ------ | ------ | ----------------------------------------- |
| effect  | 3.21.0 | 3.22.1 | ReDoS в `Schema.TemplateLiteral` (GHSA-7589-6fvf-x4pw), patch в 3.22.1 |
| postcss | 8.4.31 | 8.5.33 | 4 advisory (XSS/sourceMappingURL), исправлены в 8.5.x |

После overrides build, `prisma generate`, unit/integration и E2E проверены
повторно.

Оставшиеся advisories:

| Пакет        | Путь                                       | Advisory                                      | Оценка                                                                                                  |
| ------------ | ------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| zod 3.25.76  | `zod@3.25.76`                              | GHSA-mrhx-c7xc-m3w5                           | Patched только `>=4.6.6` (major). Zod 3 зафиксирован baseline; входы ограничены body limit и `.max()`, произвольные regex из пользовательских данных не компилируются. Обновление до Zod 4 требует согласования. |
| deepmerge-ts | `@prisma/client > prisma > @prisma/config` | GHSA-ggr8-5vv4-36mx                           | Patched только `>=8.0.0` (major). Используется Prisma CLI/config при generate/migrate, не в request path. |

`effect` и `postcss` больше не появляются в audit. Оставшиеся два риска
зафиксированы, а не скрыты; major-обновления без согласования не выполнялись.


## 10. Что осталось проверить (BLOCKED)

1. Создать роли `n8n_app`/`n8n_dedupe` в реальном PostgreSQL и проверить
   `has_table_privilege` (нужен Docker/superuser).
2. Импортировать draft workflow в n8n 1.123.98, настроить credentials и
   выполнить реальный Telegram E2E.
3. Запустить CI job `docker` (Compose config/build/up + health) на GitHub
   Actions: локально Docker отсутствует, workflow ещё не выполнялся.
4. После согласования major-обновлений `zod` 4 и `deepmerge-ts` 8 повторить
   `pnpm audit --prod` и регрессионные тесты.


## 11. Ротация секретов и инциденты

- При компрометации `N8N_WEBHOOK_SECRET` или `N8N_CALLBACK_SECRET`:
  1. сгенерировать новые значения (≥32 байта);
  2. обновить ENV приложения и n8n;
  3. перезапустить app и n8n;
  4. старые подписи перестанут приниматься.
- Секреты должны различаться; совпадение отклоняется.
- Telegram bot token перевыпускается через `@BotFather`; обновить n8n
  Credential.
- Пароль `SEED_ADMIN_PASSWORD` не публиковать; при утечке сменить и выполнить
  seed.
- HMAC-секреты и токены не вставлять в issue, чат, workflow JSON или Git.
