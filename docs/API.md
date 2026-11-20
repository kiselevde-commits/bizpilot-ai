# API BizPilot AI

**Версия:** этап 5 (2026-11-20).  
**Base URL:** `APP_BASE_URL` (локально `http://localhost:3000`).

## 1. Общие правила

### 1.1. Envelope

Успех:

```json
{ "success": true, "data": {}, "error": null }
```

Ошибка:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Некорректный запрос",
    "details": []
  }
}
```

`details` необязателен. Stack trace, SQL, секреты, prompt и raw AI response не
возвращаются.

### 1.2. Аутентификация

- Бизнес-endpoints используют сессию Auth.js (httpOnly cookie).
- Пользователь и его роль/`workspaceId` повторно загружаются из PostgreSQL.
- `workspaceId` никогда не принимается из body/query/headers.
- Cookie-authenticated mutations требуют корректный `Origin`.
- `POST /api/webhooks/n8n` не использует сессию: только HMAC + timestamp.

### 1.3. Роли

| Действие                                          |     ADMIN |   MANAGER | OPERATOR |
| ------------------------------------------------- | --------: | --------: | -------: |
| Leads/Contacts/Tasks: чтение, создание, изменение |        да |        да |       да |
| Leads/Contacts/Tasks: удаление                    |        да |        да |      нет |
| AI-анализ                                         |        да |        да |       да |
| Automation events/status/retry                    |        да |        да |      нет |
| Настройки интеграций                              | read-only | read-only |      нет |

### 1.4. Пагинация и сортировка

Query: `page=1`, `limit=20` (1–100), `search`, `status`, `priority`, `sort`.

`sort` — только allow-list `field:direction`; неизвестное значение заменяется
безопасным default. Ответ списка:

```json
{
  "items": [],
  "pagination": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
}
```

Allow-list:

- Leads: `createdAt`, `updatedAt`, `title`, `status`, `priority`, `leadScore`.
- Contacts: `createdAt`, `updatedAt`, `name`, `company`, `status`.
- Tasks: `createdAt`, `updatedAt`, `title`, `status`, `priority`, `dueDate`.
- Automation events: `createdAt`, `updatedAt`, `status`, `attempts`.

### 1.5. Лимиты body

| Группа                     |  Лимит |
| -------------------------- | -----: |
| `/api/leads`, `/api/ai/*`  | 256 KB |
| Остальные бизнес-endpoints |  64 KB |
| `/api/webhooks/n8n`        |  64 KB |

Проверяется `Content-Length` и фактическое число прочитанных байт. Превышение —
`413 PAYLOAD_TOO_LARGE`. JSON endpoints требуют
`Content-Type: application/json`.

### 1.6. Rate limits

| Группа                   |      Лимит | Ключ    |
| ------------------------ | ---------: | ------- |
| Auth                     | 5 / 15 мин | IP      |
| AI                       |   10 / час | user id |
| CRUD                     |  100 / мин | user id |
| Automation events/status |  100 / мин | user id |
| Automation retry         |   30 / мин | user id |
| n8n webhook              | 1000 / мин | IP      |

Ответ `429 RATE_LIMITED` содержит `Retry-After`.

## 2. Аутентификация Auth.js

| Метод    | Path             | Назначение                               |
| -------- | ---------------- | ---------------------------------------- |
| GET/POST | `/api/auth/*`    | Auth.js (csrf, signin, signout, session) |
| GET      | `/api/ai/health` | Публичный healthcheck                    |

`GET /api/ai/health` → `{ "status": "ok", "configured": true }`. Не раскрывает provider/model/секреты.

## 3. Leads

| Метод  | Path             | Роли          | Описание                  |
| ------ | ---------------- | ------------- | ------------------------- |
| GET    | `/api/leads`     | все           | Список                    |
| POST   | `/api/leads`     | все           | Создание + outbox-событие |
| GET    | `/api/leads/:id` | все           | Карточка                  |
| PATCH  | `/api/leads/:id` | все           | Изменение                 |
| DELETE | `/api/leads/:id` | ADMIN/MANAGER | Удаление                  |

Query `GET /api/leads`: `page`, `limit`, `search`, `status`, `priority`,
`assignedToId`, `contactId`, `sort`.

Создание:

```json
{
  "title": "Нужна автоматизация продаж",
  "message": "Текст заявки",
  "source": "website",
  "priority": "HIGH",
  "category": "business_automation",
  "contactId": null,
  "assignedToId": null
}
```

Создание в одной транзакции создаёт `Lead`, `ActivityLog` и
`AutomationEvent(PENDING)` с `idempotencyKey=lead.created:<leadId>`. После commit
запускается best-effort dispatcher.

`contactId` и `assignedToId` проверяются до записи: связанные Contact/User
должны принадлежать текущему Workspace. Несуществующий или чужой ID даёт
`404 NOT_FOUND` без раскрытия существования записи. При `PATCH` отсутствующее
поле не меняет связь, явный `null` очищает её.

`DELETE`:

- `AIAnalysis` удаляется каскадом;
- `Task.leadId` становится `NULL`;
- `Contact` не удаляется;
- `AutomationEvent` не имеет FK на Lead и сохраняется для аудита/доставки.

## 4. Contacts

| Метод            | Path                | Роли                       |
| ---------------- | ------------------- | -------------------------- |
| GET/POST         | `/api/contacts`     | все                        |
| GET/PATCH/DELETE | `/api/contacts/:id` | все / delete ADMIN/MANAGER |

Query: `page`, `limit`, `search`, `status`, `sort`.

Создание/изменение: `name` (обязательно), `company`, `email`, `phone`, `notes`,
`status`, `force`.

Дубли проверяются внутри Workspace по нормализованным email/phone. При
совпадении — `409 DUPLICATE_CONTACT` с кандидатами; повтор с `force=true`
разрешён только после явного решения пользователя. Удаление связанного
контакта — `409 ENTITY_IN_USE`.

## 5. Tasks

| Метод            | Path             | Роли                       |
| ---------------- | ---------------- | -------------------------- |
| GET/POST         | `/api/tasks`     | все                        |
| GET/PATCH/DELETE | `/api/tasks/:id` | все / delete ADMIN/MANAGER |

Query: `page`, `limit`, `search`, `status`, `priority`, `assignedToId`,
`leadId`, `contactId`, `overdue`, `sort`.

Поля: `title` (обязательно), `description`, `status`, `priority`, `dueDate`,
`assignedToId`, `leadId`, `contactId`.

`leadId`, `contactId` и `assignedToId` проверяются до записи и должны
принадлежать текущему Workspace; несуществующий или чужой ID даёт
`404 NOT_FOUND`. При `PATCH` отсутствующее поле не меняет связь, явный `null`
очищает её.

## 6. AI

| Метод | Path                            | Роли   | Описание                      |
| ----- | ------------------------------- | ------ | ----------------------------- |
| POST  | `/api/ai/analyze`               | все    | Реальный AI-анализ            |
| POST  | `/api/leads/:id/apply-analysis` | все    | Применить результат           |
| POST  | `/api/ai/generate-reply`        | все    | Черновик ответа, без отправки |
| GET   | `/api/ai/history`               | все    | История попыток               |
| GET   | `/api/ai/health`                | public | Healthcheck                   |

### 6.1. Analyze

```json
{ "text": "Текст заявки", "leadId": "uuid" }
```

Ответ содержит `analysis` (summary, leadScore, category, intent, priority,
scoreBreakdown, justification, factors, recommendations, risks, missingInfo,
extractedContacts), `provider`, `model`, `tokensInput`, `tokensOutput`,
`durationMs`. `extractedContacts` — контактные данные (name/company/email/phone,
nullable), оставшиеся после серверной проверки `filterExtractedContacts` по
тексту заявки; не упомянутые LLM значения обнуляются. Lead не изменяется.

### 6.2. Apply analysis

```json
{
  "summary": "Краткое резюме",
  "leadScore": 75,
  "category": "business_automation",
  "intent": "request",
  "customerType": "b2b",
  "priority": "HIGH"
}
```

В одной транзакции обновляются поля Lead и создаётся `ActivityLog`. Если
`AutomationEvent` ещё `PENDING`/`RETRYING` и не захвачен dispatcher, payload
события обновляется (summary/category/priority). Уже отправленное событие не
изменяется.

### 6.3. Generate reply

```json
{ "text": "Текст заявки", "leadId": "uuid" }
```

Возвращает `draftReply` (≤800) и метрики. Сообщение не отправляется и не
сохраняется.

### 6.4. History

`GET /api/ai/history?leadId=<uuid>&page=1&limit=20`. Workspace scope, сортировка
`createdAt DESC`. Не возвращает raw prompt/response.

## 7. Automation

### 7.1. `GET /api/automation/events`

ADMIN/MANAGER. Query: `page`, `limit`, `status`, `sort`.

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "eventType": "lead.created",
        "entityId": "lead-uuid",
        "payload": {
          "title": "Название",
          "priority": "HIGH",
          "category": "business_automation",
          "summary": null,
          "url": "https://crm.example.com/leads/lead-uuid"
        },
        "status": "PENDING",
        "idempotencyKey": "lead.created:lead-uuid",
        "externalEventId": null,
        "attempts": 0,
        "lastError": null,
        "nextRetryAt": null,
        "lockedAt": null,
        "createdAt": "2026-11-19T12:00:00.000Z",
        "updatedAt": "2026-11-19T12:00:00.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
  },
  "error": null
}
```

`lockToken` не возвращается. Запрос также запускает lazy dispatcher (max 10).

### 7.2. `GET /api/automation/status`

ADMIN/MANAGER.

```json
{
  "success": true,
  "data": {
    "n8n": {
      "configured": true,
      "callbackConfigured": true,
      "integrationStatus": "ACTIVE",
      "lastCheckedAt": "2026-11-19T12:00:00.000Z"
    },
    "telegram": {
      "configured": true,
      "integrationStatus": "ACTIVE",
      "lastCheckedAt": "2026-11-19T12:00:00.000Z"
    },
    "counts": {
      "PENDING": 0,
      "SENT": 0,
      "DELIVERED": 1,
      "RETRYING": 0,
      "FAILED": 0
    },
    "total": 1,
    "lastEventAt": "2026-11-19T12:00:00.000Z",
    "staleClaims": [
      {
        "idempotencyKey": "lead.created:uuid",
        "claimedAt": "2026-11-19T11:40:00.000Z",
        "externalEventId": null,
        "lastError": "timeout"
      }
    ],
    "policy": {
      "maxBatch": 10,
      "leaseMinutes": 5,
      "staleClaimMinutes": 15,
      "maxAutomaticAttempts": 4,
      "maxAgeHours": 24
    }
  },
  "error": null
}
```

`staleClaims` — строки `n8n_processed` в `CLAIMED` старше 15 минут. Они требуют
ручной сверки; автоматическая переотправка отключена.

### 7.3. `POST /api/automation/events/:id/retry`

ADMIN/MANAGER. Требуется `Origin`. Тело не требуется.

Условия:

- событие принадлежит Workspace пользователя;
- статус `FAILED`;
- возраст < 24 часов.

Действие:

- тот же `AutomationEvent` и тот же `idempotencyKey`;
- `attempts=0`, `status=RETRYING`, `nextRetryAt=now`;
- создаётся `ActivityLog(automation.retry_requested)`;
- dispatcher пытается отправить событие сразу.

Ответ:

```json
{
  "success": true,
  "data": {
    "event": { "id": "uuid", "status": "RETRYING" },
    "dispatched": true
  },
  "error": null
}
```

Ошибки: `404 NOT_FOUND`, `409 CONFLICT` (не FAILED, истекли 24 часа,
конкурентное изменение), `403 FORBIDDEN`.

## 8. Webhook n8n

### 8.1. `POST /api/webhooks/n8n`

Аутентификация: HMAC, без cookie. Лимит body 64 KB, rate limit 1000/мин/IP.

Заголовки:

```
X-N8N-Signature: <lowercase hex HMAC-SHA256>
X-N8N-Timestamp: <unix seconds>
Content-Type: application/json
```

Подпись:

```text
HMAC-SHA256(N8N_CALLBACK_SECRET, timestamp + "." + rawBody)
```

Проверки:

1. `N8N_CALLBACK_SECRET` настроен и отличается от `N8N_WEBHOOK_SECRET`.
2. Timestamp в пределах ±5 минут (прошлое и будущее).
3. HMAC по исходным байтам raw body, constant-time.
4. Zod-валидация payload.
5. Поиск события по `idempotencyKey` с `FOR UPDATE`.
6. Workspace берётся только из сохранённого события.

Payload:

```json
{
  "idempotencyKey": "lead.created:<leadId>",
  "status": "delivered",
  "externalEventId": "n8n-execution-id",
  "error": null
}
```

`status`: `delivered` | `failed` (регистр нормализуется). Дополнительные поля,
включая `workspaceId`, игнорируются.

Переходы:

- `PENDING`/`SENT`/`RETRYING` → `DELIVERED` или `FAILED`;
- `FAILED` → `DELIVERED` (ручной retry);
- `DELIVERED` → `FAILED` запрещён (no downgrade);
- повтор с тем же целевым статусом → `duplicate=true` без изменений.

Ответ:

```json
{
  "success": true,
  "data": {
    "received": true,
    "eventId": "uuid",
    "status": "DELIVERED",
    "duplicate": false
  },
  "error": null
}
```

Ошибки:

| HTTP | code                | Причина                             |
| ---: | ------------------- | ----------------------------------- |
|  400 | `VALIDATION_ERROR`  | не JSON / невалидный payload        |
|  401 | `INVALID_SIGNATURE` | нет заголовков или неверная подпись |
|  401 | `STALE_TIMESTAMP`   | timestamp вне ±5 минут              |
|  404 | `NOT_FOUND`         | событие с таким ключом не найдено   |
|  413 | `PAYLOAD_TOO_LARGE` | тело > 64 KB                        |
|  429 | `RATE_LIMITED`      | > 1000 запросов/мин/IP              |
|  503 | `INTERNAL_ERROR`    | callback secret не настроен         |

`POST /api/webhooks/lead-created` не существует.

## 9. Коды ошибок

`VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403),
`NOT_FOUND` (404), `CONFLICT` (409), `ENTITY_IN_USE` (409),
`DUPLICATE_CONTACT` (409), `PAYLOAD_TOO_LARGE` (413), `RATE_LIMITED` (429),
`AI_NOT_CONFIGURED` (503), `AI_PROVIDER_ERROR` (502), `AI_TIMEOUT` (504),
`AI_INVALID_RESPONSE` (502), `INVALID_SIGNATURE` (401),
`STALE_TIMESTAMP` (401), `INTERNAL_ERROR` (500/503).

## 10. Примеры

### 10.1. Создание заявки

```bash
curl -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -H "Cookie: authjs.session-token=<session>" \
  -d '{
    "title": "Нужна автоматизация",
    "message": "Просим настроить обработку заявок",
    "priority": "HIGH",
    "category": "business_automation"
  }'
```

### 10.2. Ручной callback

```bash
pnpm test:webhook -- \
  --idempotency-key "lead.created:<leadId>" \
  --status delivered
```

Скрипт читает `APP_BASE_URL` и `N8N_CALLBACK_SECRET`, подписывает тело и не
печатает секрет.

### 10.3. Журнал автоматизации

```bash
curl "http://localhost:3000/api/automation/events?status=FAILED&page=1&limit=20" \
  -H "Cookie: authjs.session-token=<session>"
```
