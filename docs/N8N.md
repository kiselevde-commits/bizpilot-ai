# n8n, Telegram и автоматизация BizPilot AI

**Статус:** код, миграции и тесты автоматизации реализованы.  
**Runtime-проверка реального n8n + Telegram: BLOCKED** — в окружении разработки нет
настроенного n8n, Telegram-бота и credentials. Workflow в
`n8n/workflows/lead_created_notification.json` является **draft для импорта**, а не
подтверждённым экспортом работающего workflow.

**Этап 5 (2026-11-20):** JSON workflow статически валидируется unit-тестом
(`tests/unit/n8n-workflow-draft.test.ts`), секреты в нём отсутствуют; импорт,
активация и реальная доставка не выполнялись. Docker Compose с профилем
`automation` локально не запускался (Docker отсутствует).

Документ описывает outbox, HMAC, дедупликацию, retry, настройку n8n/Telegram,
диагностику и ограничения.

## 1. Поток доставки

```text
POST /api/leads
  └─ Prisma transaction
       ├─ Lead
       ├─ ActivityLog(lead.created)
       └─ AutomationEvent(PENDING, idempotencyKey=lead.created:<leadId>)
            │
            ├─ best-effort dispatcher после commit
            ├─ lazy dispatcher: Dashboard, /settings, /api/automation/*
            ▼
       PostgreSQL lease: lockedAt + lockToken (5 минут)
            │
            ▼
       POST N8N_WEBHOOK_URL
       HMAC(N8N_WEBHOOK_SECRET, timestamp + "." + rawBody)
            │
            ▼
       n8n workflow lead_created_notification
            ├─ проверка HMAC/timestamp
            ├─ INSERT ... ON CONFLICT DO NOTHING RETURNING в n8n_processed
            ├─ Telegram sendMessage
            ├─ UPDATE n8n_processed → SENT/FAILED
            └─ POST /api/webhooks/n8n
                 HMAC(N8N_CALLBACK_SECRET, timestamp + "." + rawBody)
                      │
                      ▼
                 AutomationEvent → DELIVERED / FAILED
```

CRM работает при выключенном n8n: события остаются `PENDING` (или `RETRYING`),
интеграция отображается как `NOT_CONFIGURED`, ошибка видна в журнале.

## 2. Outbox и dispatcher

- `Lead` и `AutomationEvent(PENDING)` создаются в одной Prisma-транзакции.
- `idempotencyKey = lead.created:<leadId>`; при retry ключ не меняется.
- Payload: `title`, `priority`, `category`, `summary`, `url`. Текст заявки, email,
  телефон и другие контактные данные в payload не попадают.
- Dispatcher за один вызов обрабатывает не более 10 событий.
- Захват события — атомарный SQL с `FOR UPDATE SKIP LOCKED` и lease:
  `lockedAt`, `lockToken`, lease 5 минут. In-memory lock не используется.
- После аварийного завершения процесса lease истекает, и событие снова доступно
  другому dispatcher.
- `attempts` увеличивается только при фактическом HTTP-вызове n8n.
- Событие старше 24 часов переводится в `FAILED` без HTTP-вызова.
- `SENT` означает «n8n принял запрос», а не «Telegram доставил». `DELIVERED`
  выставляется только по подписанному callback.

Особенность SQL: колонки Prisma `DateTime` — `timestamp(3)` без timezone, поэтому
dispatcher сравнивает их с параметром через `AT TIME ZONE 'UTC'`. Без этого
сравнение зависит от timezone PostgreSQL-сессии и lease может считаться
истёкшим раньше времени. Это проверено integration-тестом на реальном PostgreSQL.

## 3. HMAC

### 3.1. BizPilot → n8n

```text
signature = HMAC-SHA256(N8N_WEBHOOK_SECRET, timestamp + "." + rawBody)
```

Заголовки:

- `X-BizPilot-Signature` — lowercase hex;
- `X-BizPilot-Timestamp` — Unix epoch seconds;
- `X-BizPilot-Event-Id` — `idempotencyKey`.

n8n проверяет подпись constant-time и timestamp ±5 минут **до** записи в
`n8n_processed` и отправки в Telegram.

### 3.2. n8n → BizPilot

```text
signature = HMAC-SHA256(N8N_CALLBACK_SECRET, timestamp + "." + rawBody)
```

Заголовки:

- `X-N8N-Signature`;
- `X-N8N-Timestamp`.

BizPilot читает исходные байты тела, проверяет timestamp ±5 минут и подпись
constant-time, и только затем парсит JSON. Тело нельзя пересобирать через
`JSON.stringify` до проверки подписи.

`N8N_CALLBACK_SECRET` обязан отличаться от `N8N_WEBHOOK_SECRET`. Если значения
совпадают, callback считается не настроенным (503), а статус показывает
`callbackConfigured=false`.

Payload callback:

```json
{
  "idempotencyKey": "lead.created:<leadId>",
  "status": "delivered",
  "externalEventId": "<n8n execution id>",
  "error": null
}
```

`status`: `delivered` или `failed`. Поле `workspaceId` не передаётся и не
принимается как источник истины: workspace берётся из найденного
`AutomationEvent`.

## 4. n8n_processed и дедупликация

Таблица создаётся SQL-миграцией
`prisma/migrations/20261119000100_n8n_processed/migration.sql`:

```sql
CREATE TABLE n8n_processed (
  idempotency_key text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('CLAIMED', 'SENT', 'FAILED')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL,
  external_event_id text NULL,
  last_error text NULL
);
```

Основной механизм:

```sql
INSERT INTO n8n_processed (idempotency_key, status, claimed_at)
VALUES ($1, 'CLAIMED', now())
ON CONFLICT (idempotency_key) DO NOTHING
RETURNING idempotency_key;
```

`SELECT-then-INSERT` не используется.

### 4.1. Поведение при повторном событии

| Состояние строки          | Действие n8n                                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `SENT`                    | Telegram повторно не отправляется; callback `delivered` отправляется снова (восстановление потерянного callback). |
| `CLAIMED` моложе 15 минут | Считается обработкой в полёте; повторно не отправляется.                                                          |
| `CLAIMED` старше 15 минут | Ручная сверка. Автоматическая переотправка запрещена.                                                             |
| `FAILED`                  | Атомарный reclaim только строки `FAILED` и повторная отправка (ручной retry).                                     |

Reclaim `FAILED` — осознанное уточнение ТЗ 24.12: основной путь остаётся
`DO NOTHING`, а `UPDATE ... WHERE status='FAILED'` выполняется только после
конфликта и только для окончательно неуспешной строки. Это позволяет ручному
retry использовать тот же `idempotencyKey`, не создавая новый Lead или событие.
Конкурентные reclaim-запросы безопасны: `UPDATE` с условием `status='FAILED'`
выигрывает только один.

## 5. Retry

| Попытка     | Условие          | Задержка | `attempts` после вызова |
| ----------- | ---------------- | -------- | ----------------------- |
| 1 (initial) | сразу            | —        | 1                       |
| 2           | network/5xx/429  | 1 мин    | 2                       |
| 3           | network/5xx/429  | 5 мин    | 3                       |
| 4           | network/5xx/429  | 30 мин   | 4                       |
| —           | после 4-й ошибки | —        | `FAILED`                |

- HTTP 429: задержка = `max(расписание, Retry-After)`.
- Постоянные 4xx кроме 429: сразу `FAILED`.
- 5xx, timeout, network: retry.
- Максимальный возраст события: 24 часа с `createdAt`; после — `FAILED`.
- Ручной retry: ADMIN/MANAGER, только `FAILED`, только до 24 часов, тот же
  event и тот же `idempotencyKey`. `attempts` сбрасывается в 0, статус
  `RETRYING`, после чего dispatcher пытается отправить событие снова.

## 6. Настройка Docker

### 6.1. Запуск

```bash
cp .env.docker.example .env.docker
# заполните секреты; не коммитьте .env.docker

docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker --profile automation up -d
```

Профиль `automation` запускает:

1. `n8n-db-init` — идемпотентно создаёт роли/БД и выдаёт минимальные права;
2. `n8n` — `n8nio/n8n:1.123.98` с PostgreSQL backend.

`n8n-db-init` выполняется после `migrate`, поэтому таблица `n8n_processed` уже
существует. Базовый `docker compose up` не требует n8n-секретов.

### 6.2. Переменные приложения

| Переменная                               | Назначение                                                          |
| ---------------------------------------- | ------------------------------------------------------------------- |
| `N8N_WEBHOOK_URL`                        | URL webhook n8n. В Compose: `http://n8n:5678/webhook/lead-created`. |
| `N8N_WEBHOOK_SECRET`                     | Исходящая HMAC-подпись.                                             |
| `N8N_CALLBACK_SECRET`                    | Входящая HMAC-подпись; должен отличаться от webhook secret.         |
| `N8N_TIMEOUT_MS`                         | Таймаут исходящего HTTP, по умолчанию 10000.                        |
| `APP_BASE_URL`                           | Публичный URL приложения для ссылки в Telegram.                     |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Только для отображения состояния; отправляет n8n.                   |

`TELEGRAM_BOT_TOKEN` в ENV приложения не используется для отправки. Если он не
задан, статус Telegram становится `ACTIVE` после первого успешного callback
(Integration), а до этого показывается «нет подтверждения». Токен для отправки
хранится в n8n Credential.

Секреты можно сгенерировать (не выводите их в Git/чат):

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Сгенерируйте отдельно `N8N_WEBHOOK_SECRET`, `N8N_CALLBACK_SECRET` и
`N8N_ENCRYPTION_KEY`; webhook/callback секреты должны различаться.

### 6.3. Переменные n8n

| Переменная                                  | Назначение                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `N8N_WEBHOOK_SECRET`, `N8N_CALLBACK_SECRET` | Те же значения, что у приложения.                                                          |
| `BIZPILOT_BASE_URL`                         | URL приложения **из контейнера n8n**: `http://app:3000` в Compose или публичный HTTPS.     |
| `TELEGRAM_CHAT_ID`                          | Chat ID получателя.                                                                        |
| `NODE_FUNCTION_ALLOW_BUILTIN=crypto`        | Разрешает `require('crypto')` в Code node.                                                 |
| `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`        | Разрешает `$env` в Code node.                                                              |
| `N8N_ENCRYPTION_KEY`                        | Шифрование credentials n8n; хранить постоянно.                                             |
| `N8N_BASIC_AUTH_*`                          | Совместимость с baseline; в n8n 1.x UI может использовать owner-account вместо basic auth. |

Секреты не хранятся в `n8n/workflows/*.json`.

### 6.4. PostgreSQL-роли

`docker/n8n/init-db.sql` создаёт:

- `n8n_app` — владелец отдельной БД `n8n`, без доступа к CRM-БД;
- `n8n_dedupe` — LOGIN, `CONNECT` к CRM-БД, `USAGE` на `public` и только
  `SELECT/INSERT/UPDATE` на `n8n_processed`.

Обе роли создаются с `NOSUPERUSER NOCREATEDB NOCREATEROLE`. `n8n_dedupe` не
получает прав на `User`, `Lead`, `Contact`, `Task` и другие таблицы CRM.

Проверка прав:

```sql
SELECT
  has_table_privilege('n8n_dedupe', 'n8n_processed', 'SELECT') AS can_select,
  has_table_privilege('n8n_dedupe', 'n8n_processed', 'INSERT') AS can_insert,
  has_table_privilege('n8n_dedupe', 'n8n_processed', 'UPDATE') AS can_update,
  has_table_privilege('n8n_dedupe', 'n8n_processed', 'DELETE') AS can_delete,
  has_table_privilege('n8n_dedupe', '"User"', 'SELECT') AS can_read_users;
```

Ожидаемо: `true, true, true, false, false`.

Локальная установка без Docker (от суперпользователя PostgreSQL):

```bash
psql -U postgres -d bizpilot \
  -v app_db=bizpilot \
  -v n8n_db=n8n \
  -v n8n_user=n8n_app \
  -v n8n_password='<пароль>' \
  -v dedupe_user=n8n_dedupe \
  -v dedupe_password='<пароль>' \
  -f docker/n8n/init-db.sql
```

Пароли в командной строке попадают в history; для локальной разработки
предпочтителен Docker-профиль. После создания роли примените миграции
(`pnpm prisma migrate deploy`) — миграция
`20261119000200_n8n_processed_grants` выдаст права, если роль существует.

## 7. Telegram

1. Создайте бота через `@BotFather` и получите токен.
2. Добавьте бота в нужный чат/канал; получите `chat_id`.
3. В n8n создайте credential типа **Telegram API** с именем
   `BizPilot Telegram` и токеном.
4. В Compose задайте `TELEGRAM_CHAT_ID`; токен в n8n credential, не в workflow.
5. Сообщение содержит только:
   - название заявки;
   - приоритет;
   - категорию;
   - краткое резюме (если AI-анализ уже применён и событие ещё не отправлено);
   - ссылку на заявку при наличии `APP_BASE_URL`.

Текст заявки, email, телефон и другие персональные данные не отправляются.
Сообщение отправляется как plain text (без `parse_mode`), чтобы исключить
HTML-инъекции из данных заявки.

## 8. Импорт workflow

Файл: `n8n/workflows/lead_created_notification.json`. Это **DRAFT**.

1. Откройте n8n UI.
2. Создайте Postgres credential `BizPilot n8n dedupe`:
   host `postgres`, port `5432`, database `bizpilot`, user `n8n_dedupe`,
   password из `N8N_DEDUPE_DB_PASSWORD`.
3. Создайте Telegram credential `BizPilot Telegram`.
4. Импортируйте workflow.
5. В Postgres-нодах выберите credential `BizPilot n8n dedupe`.
6. В Telegram-ноде выберите credential `BizPilot Telegram`.
7. Проверьте env: `N8N_WEBHOOK_SECRET`, `N8N_CALLBACK_SECRET`,
   `BIZPILOT_BASE_URL`, `TELEGRAM_CHAT_ID`.
8. Активируйте workflow. Production URL:
   `http://<n8n>/webhook/lead-created`.

Порядок узлов:

1. Webhook (raw body).
2. Code: проверка HMAC и timestamp.
3. Postgres: атомарный `CLAIMED` / `DO NOTHING`.
4. Ветка дубликата: `SENT` → повторный callback; `CLAIMED < 15 мин` → duplicate;
   `CLAIMED >= 15 мин` → manual reconciliation; `FAILED` → атомарный reclaim.
5. Telegram: sendMessage.
6. Postgres: `SENT`/`FAILED`.
7. Code: подписанный callback в BizPilot.
8. Error output Telegram → `FAILED` + callback `failed`.

Workflow не сохраняет execution data с payload (`saveDataSuccessExecution=none`,
`saveDataErrorExecution=none`), чтобы не накапливать персональные данные.

## 9. API и UI диагностики

- `GET /api/automation/events` — журнал (ADMIN/MANAGER), пагинация.
- `GET /api/automation/status` — состояние n8n/Telegram, counts, stale claims.
- `POST /api/automation/events/:id/retry` — ручной retry (ADMIN/MANAGER).
- `/settings` — профиль, статус интеграций, журнал, ошибки, кнопка «Повторить».

`GET /api/automation/status` возвращает `staleClaims` — строки `n8n_processed` в
статусе `CLAIMED` старше 15 минут. Они требуют ручной сверки.

## 10. Диагностика CLAIMED

Проверить строку:

```sql
SELECT idempotency_key, status, claimed_at, processed_at,
       external_event_id, last_error
FROM n8n_processed
WHERE idempotency_key = 'lead.created:<leadId>';
```

Если Telegram-сообщение **точно доставлено**, а callback потерян:

```sql
UPDATE n8n_processed
SET status = 'SENT', processed_at = now(), last_error = NULL
WHERE idempotency_key = 'lead.created:<leadId>'
  AND status = 'CLAIMED';
```

Затем отправьте подписанный callback вручную:

```bash
pnpm test:webhook -- \
  --idempotency-key "lead.created:<leadId>" \
  --status delivered
```

Если сообщение **не доставлено** и повтор безопасен:

```sql
UPDATE n8n_processed
SET status = 'FAILED',
    processed_at = now(),
    last_error = 'manual reconciliation: safe to retry'
WHERE idempotency_key = 'lead.created:<leadId>'
  AND status = 'CLAIMED';
```

После этого нажмите «Повторить» в `/settings`. Workflow атомарно переведёт
`FAILED` в `CLAIMED` и отправит Telegram один раз.

**Не удаляйте строку `n8n_processed` вслепую**: это может привести к повторной
отправке Telegram. `CLAIMED` не переотправляется автоматически.

Если событие BizPilot в `SENT`, а callback не пришёл:

1. Проверьте execution n8n и строку `n8n_processed`.
2. Если Telegram доставлен — отправьте `delivered` через `pnpm test:webhook`.
3. Если Telegram не доставлен — переведите строку в `FAILED` (SQL выше) и
   используйте ручной retry. Событие BizPilot в `SENT` нельзя перевести в
   `FAILED` через UI; для этого нужна ручная сверка.

## 11. Ручные проверки

```bash
# 1. Подписанный callback по существующему событию
pnpm test:webhook -- --idempotency-key "lead.created:<leadId>" --status delivered

# 2. Повторный callback должен вернуть duplicate=true
pnpm test:webhook -- --idempotency-key "lead.created:<leadId>" --status delivered

# 3. Неверный секрет должен вернуть 401 INVALID_SIGNATURE
N8N_CALLBACK_SECRET=wrong pnpm test:webhook -- \
  --idempotency-key "lead.created:<leadId>" --status delivered
```

Полный сценарий:

1. Создайте заявку в UI.
2. Убедитесь, что в `/settings` появилось событие `PENDING`/`SENT`.
3. Проверьте Telegram.
4. Убедитесь, что событие стало `DELIVERED`.
5. Повторите webhook вручную — duplicate не создаёт второе сообщение.
6. Остановите n8n, создайте заявку: CRM работает, событие остаётся `PENDING`/
   `RETRYING`, ошибка видна в журнале.
7. Запустите n8n снова и откройте Dashboard/Settings — lazy dispatcher отправит
   событие.

## 12. Фактический статус проверок

| Проверка                                                                                                   | Результат                                          |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| HMAC sign/verify, raw body, timestamp ±5 мин                                                               | PASS (unit)                                        |
| Callback route: valid/invalid signature, stale/future, duplicate, invalid JSON                             | PASS (unit)                                        |
| Retry 1/5/30 мин, 24 ч, 429/4xx/5xx, attempts                                                              | PASS (unit)                                        |
| Outbox claim/lease/concurrency на реальном PostgreSQL                                                      | PASS (integration)                                 |
| `n8n_processed` atomic insert/concurrent dedupe/CLAIMED/FAILED reclaim                                     | PASS (integration, реальный PostgreSQL)            |
| API smoke: create lead → PENDING → signed callback → DELIVERED → duplicate → FAILED → retry → OPERATOR 403 | PASS (локальный PostgreSQL)                        |
| UI smoke: `/settings`, журнал, кнопка retry, OPERATOR permission state                                     | PASS (Playwright, локальный dev server)            |
| Реальный n8n + Telegram                                                                                    | **BLOCKED**: нет n8n/Telegram credentials и Docker |
| Импорт draft workflow в n8n                                                                                | **BLOCKED**: нет установленного n8n                |

## 13. Ограничения

- Нет математического exactly-once для Telegram API. Есть at-most-once bias:
  падение после отправки Telegram до записи `SENT` оставляет `CLAIMED` и требует
  ручной сверки.
- `SENT` без callback может «зависнуть»; автоматического reconciliation нет —
  только ручная сверка.
- Outbox — eventual delivery: без трафика приложения события ждут lazy
  dispatcher.
- n8n 1.x EOL 2026-12-31; baseline зафиксирован по ТЗ.
- Telegram — только уведомления; приём сообщений ботом вне MVP.
- Один workflow `lead_created_notification`.
- UI n8n в Compose слушает `127.0.0.1:5678`; для внешнего доступа нужен
  reverse proxy с HTTPS и надёжной аутентификацией.
- В n8n 1.x basic-auth env может игнорироваться при включённом owner-account;
  настройте владельца n8n и не публикуйте UI в интернет без защиты.
