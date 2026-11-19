# Безопасность BizPilot AI

**Версия:** этап 4 (2026-11-19).  
**Статус:** обязательные механизмы реализованы; часть runtime-проверок
(**n8n, Telegram, PostgreSQL-роль n8n_dedupe, Docker**) остаётся **BLOCKED**.
Таблица ниже фиксирует только фактически выполненные проверки.

## 1. Модель безопасности

- PostgreSQL — источник истины для бизнес-данных и outbox.
- Все бизнес-запросы ограничены `workspaceId`, полученным из пользователя,
  загруженного из БД. `workspaceId` из body/query/заголовков не принимается.
- Роль и Workspace перечитываются из БД; JWT не является источником истины для
  прав.
- Cookie-auth mutations проверяют `Origin`; Auth.js использует CSRF-защиту.
- Внешний webhook не использует сессию: только HMAC + timestamp.
- Секреты хранятся только в ENV / n8n Credentials. В Git, клиентский bundle,
  workflow JSON и логи они не попадают.
- Ошибки клиенту безопасны; stack trace, SQL, секреты, prompt и raw provider
  response не раскрываются.
- AI не имеет tools/functions, не выполняет SQL/команды и не инициирует
  внешние действия. Ответ валидируется Zod.
- AI не меняет бизнес-поля Lead до подтверждения пользователем.

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

## 8. Результаты проверок

| Проверка                         | Метод                            | Результат   | Замечания                                                         |
| -------------------------------- | -------------------------------- | ----------- | ----------------------------------------------------------------- |
| Typecheck                        | `pnpm typecheck`                 | PASS        | 0 ошибок                                                          |
| Lint                             | `pnpm lint`                      | PASS        | 0 errors, 1 warning `postcss.config.mjs`                          |
| Unit                             | `pnpm test:unit`                 | PASS        | см. `docs/IMPLEMENTATION_PLAN.md`                                 |
| Integration                      | `pnpm test:integration`          | PASS        | реальный PostgreSQL; outbox claim/lease и `n8n_processed`         |
| HMAC: valid/invalid              | unit `tests/unit/hmac.test.ts`   | PASS        | raw body, wrong secret, malformed signature                       |
| Timestamp: valid/expired/future  | unit `tests/unit/hmac.test.ts`   | PASS        | ±5 минут, boundaries                                              |
| Raw body integrity               | unit HMAC + route test           | PASS        | изменение тела → 401                                              |
| Replay/duplicate callback        | unit service + route + API smoke | PASS        | duplicate без повторного Telegram                                 |
| Идемпотентность `n8n_processed`  | real PostgreSQL integration      | PASS        | 4 конкурентных INSERT → ровно 1                                   |
| Конкурентный захват outbox       | real PostgreSQL integration      | PASS        | `FOR UPDATE SKIP LOCKED`, без дублей                              |
| Lease и истечение lease          | real PostgreSQL integration      | PASS        | активный lease не захватывается, просроченный — захватывается     |
| Retry 1/5/30 минут               | unit                             | PASS        | 60s/300s/1800s                                                    |
| Ограничение 24 часа              | unit + real DB                   | PASS        | без HTTP-вызова → FAILED                                          |
| HTTP 429/4xx/5xx                 | unit dispatcher                  | PASS        | 429 Retry-After, 4xx terminal, 5xx retry                          |
| Права ADMIN/MANAGER/OPERATOR     | unit + API smoke + UI smoke      | PASS        | OPERATOR 403 и скрытый раздел                                     |
| CLAIMED старше 15 минут          | unit + real DB + status          | PASS        | staleClaims; auto-resend запрещён                                 |
| Ошибка Telegram/callback failed  | unit + API smoke                 | PASS        | событие FAILED, безопасный текст                                  |
| Callback secret = webhook secret | unit config                      | PASS        | отклоняется (callback не настроен)                                |
| Body limit webhook               | unit route                       | PASS        | 413 `PAYLOAD_TOO_LARGE`                                           |
| Origin на retry                  | API smoke/UI smoke               | PASS        | без Origin → 403 (общий guard)                                    |
| Секреты в workflow JSON          | ручной grep                      | PASS        | токенов/паролей/HMAC нет                                          |
| `.env` не в Git                  | `git ls-files`                   | PASS        | отслеживаются только `.env.example`, `.env.docker.example`        |
| `pnpm audit --prod`              | audit                            | **FAIL**    | 6 advisories в транзитивных зависимостях; см. раздел 9            |
| PostgreSQL-роль `n8n_dedupe`     | Docker/psql runtime              | **BLOCKED** | SQL подготовлен; Docker/суперпользователь локально не запускались |
| Реальный n8n + Telegram          | manual E2E                       | **BLOCKED** | нет n8n/Telegram credentials                                      |
| Docker Compose                   | `docker compose up`              | **BLOCKED** | Docker не установлен                                              |

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

## 9. `pnpm audit --prod` (фактический результат)

Команда завершилась с exit code 1: **2 moderate, 4 high**.

| Пакет                         | Путь                                       | Advisory                                                                           | Оценка                                                                                                  |
| ----------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| postcss ≤8.5.11/8.5.17/8.5.22 | `next@15.5.29 > postcss@8.4.31`            | GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849, GHSA-qx2v-qp2m-jg93, GHSA-fxqj-rqcc-2cmp | bundled зависимость Next; приложение не обрабатывает пользовательский CSS/source maps                   |
| deepmerge-ts <8.0.0           | `@prisma/client > prisma > @prisma/config` | GHSA-ggr8-5vv4-36mx                                                                | CLI/config path, не request path                                                                        |
| zod <4.6.6                    | `zod@3.25.76`                              | GHSA-mrhx-c7xc-m3w5                                                                | Zod 3 зафиксирован ТЗ; входы ограничены body limit и `.max()`; обновление до Zod 4 требует согласования |

Обновление версий вне baseline не выполнялось: это требует отдельного
согласования (AGENTS.md §2). Риски зафиксированы, а не скрыты.

## 10. Что осталось проверить (BLOCKED)

1. Создать роли `n8n_app`/`n8n_dedupe` в реальном PostgreSQL и проверить
   `has_table_privilege`.
2. Импортировать draft workflow в n8n 1.123.98, настроить credentials и
   выполнить реальный Telegram E2E.
3. Проверить `pnpm audit` после согласованного обновления зависимостей.
4. Полный security review CRUD/AI endpoints (вне stage 4) с реальными
   integration-тестами.

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
