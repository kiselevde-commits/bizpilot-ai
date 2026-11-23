# BizPilot AI — Commercial Core Architecture Proposal

**Версия:** 1.0
**Дата:** 2026-11-22
**Статус:** **proposal, не schema decision.** Ни схема, ни миграции, ни seed, ни
API/UI не изменялись. Все имена сущностей, полей, enum'ов и ограничений —
предложение для обсуждения, а не утверждённая модель.
**Связанный документ:** `docs/COMMERCIAL_CORE_DISCOVERY.md` — решения, которые
должны быть приняты до схемы.

Документ описывает минимально достаточную модель главного коммерческого пути
«клиент → коммерческое предложение → заказ → оплата», согласованную с текущими
слоями: business logic в `services/`, Prisma/БД в `lib/`, presentation в
`app/`/`components/`. Отдельного `domain/` слоя нет и не вводится.

## 1. Границы и принципы

### 1.1. Что предлагается

- Company (опционально) + Contact как клиент.
- Quote + неизменяемые QuoteRevision + QuoteLine.
- QuoteAcceptance как отдельная запись факта принятия.
- Order + OrderLine как снимок принятой редакции.
- PaymentAttempt + append-only PaymentEntry (payments/refunds/chargebacks/
  adjustments).
- Производные balance/aging, audit, workspace isolation, controlled statuses.

### 1.2. Что не предлагается

- двойная бухгалтерия, general ledger, проводки по счетам;
- ledger platform/event sourcing;
- мультивалютность с FX;
- налоговый движок и юридически значимая e-signature;
- PSP/PCI в первой поставке;
- customer portal, публичные customer links и внешнее принятие через URL;
- dunning, subscriptions, склад/исполнение;
- изменение текущей схемы или миграции в рамках этого документа.

### 1.3. Принципы

1. **Workspace — граница доверия.** Идентичность и Workspace берутся из серверной
   сессии; `workspaceId` никогда не принимается из body/query/header.
2. **Каждая коммерческая таблица имеет `workspaceId`.** Даже дочерние строки:
   это защита в глубину и возможность scoped-запросов.
3. **Связи проверяются на принадлежность.** Customer/Contact/Lead/Quote/
   Revision/Order/Payment должны быть в том же Workspace; чужой ID → 404, не
   403, без раскрытия существования.
4. **Деньги — только целые minor units + ISO currency.** Никаких `Float` и
   неявных decimal-преобразований.
5. **Выпущенный документ неизменяем.** Изменение — новая редакция, а не update.
6. **Платёжный журнал append-only.** Суммы не перезаписываются; исправление —
   обратная проводка.
7. **Балансы производные.** `paid`/`balance`/`aging` считаются из журнала и
   заказа, а не хранятся вручную.
8. **Идемпотентность и уникальность.** Конверсия и платежи защищены unique-
   ограничениями, persisted idempotency key и canonical request hash; повтор с
   тем же key/hash не создаёт второй факт, конфликт key/hash — 409.
9. **Транзакции для бизнес-команд.** Внешние вызовы — вне транзакции.
10. **Audit — обязательная часть, а не лог «на потом».**

## 2. Логическая модель

```text
Company 1 ─── * Contact
Company 0..1 ─── * Quote
Contact 0..1 ─── * Quote
Lead 0..1 ─── * Quote                 (источник, не владелец)

Quote 1 ─── * QuoteRevision 1 ─── * QuoteLine
QuoteRevision 1 ─── 0..1 QuoteAcceptance
QuoteRevision 1 ─── 0..1 Order
Order 1 ─── * OrderLine
Order 1 ─── * PaymentAttempt
Order 1 ─── * PaymentEntry

ActivityLog ── ссылается на entityType/entityId без FK
```

`Company` опционален для B2C: коммерческий документ может ссылаться на
`Contact` без Company. Для B2B рекомендуется Company как клиент документа, а
Contact — как контактное лицо. Конкретное правило — открытое решение.

## 3. Сущности (предложение)

### 3.1. Company

| Поле                        | Тип (предложение)     | Примечание                          |
| --------------------------- | --------------------- | ----------------------------------- |
| `id`                        | String uuid           |                                     |
| `workspaceId`               | String                | FK Workspace, not null              |
| `name`                      | String                | отображаемое имя                    |
| `legalName`                 | String?               | юридическое название для документов |
| `taxId`                     | String?               | ИНН/номер; чувствительные данные    |
| `billingAddress`            | String?               | или нормализованные поля адреса     |
| `currency`                  | String? `@db.Char(3)` | валюта по умолчанию; nullable       |
| `status`                    | enum ACTIVE/INACTIVE  | не заменяет удаление                |
| `createdById`/`updatedById` | String                | FK User, not null                   |
| `createdAt`/`updatedAt`     | DateTime              |                                     |

Ограничения: `@@unique([id, workspaceId])` для composite FK; индекс
`(workspaceId, name)`; поиск дублей по `taxId`/`legalName` — сервисный, без
авто-merge. Удаление Company с Quote/Order — запрещено (Restrict).

### 3.2. Contact (расширение)

Добавить `companyId String?` (FK Company, same workspace) и, при необходимости,
`jobTitle?`. Существующее `company String?` не удалять в первой миграции:
использовать для отображения/поиска и миграции, не как источник истины.
Contact остаётся человеком; B2C-клиент может быть Contact без Company.

Ограничения: Contact с Quote/Order не удаляется; `companyId` проверяется на
тот же Workspace; смена компании не переписывает исторические документы
(они хранят snapshot).

### 3.3. Quote

| Поле                        | Тип                                              | Примечание                                   |
| --------------------------- | ------------------------------------------------ | -------------------------------------------- |
| `id`                        | String uuid                                      |                                              |
| `workspaceId`               | String                                           | FK Workspace                                 |
| `number`                    | String                                           | unique per Workspace; например `Q-2026-0001` |
| `companyId`                 | String?                                          | клиент-организация                           |
| `contactId`                 | String?                                          | контактное лицо/клиент B2C                   |
| `leadId`                    | String?                                          | источник, не обязателен                      |
| `status`                    | enum DRAFT/ISSUED/ACCEPTED/DECLINED/EXPIRED/VOID |                                              |
| `currentRevisionId`         | String?                                          | текущая редакция                             |
| `createdById`/`updatedById` | String                                           |                                              |
| `createdAt`/`updatedAt`     | DateTime                                         |                                              |

Правило: хотя бы один из `companyId`/`contactId` задан; оба могут быть заданы
(B2B: Company + contact person). Проверка — сервис/Zod; DB check — опционально.
`Quote` не хранит суммы: суммы принадлежат редакции. `Quote.status` —
производная проекция состояния `currentRevision`, а не независимый workflow
(см. §6.0); клиент не может задавать её. `currentRevisionId` — server-owned и
обязан указывать на редакцию той же Quote/Workspace (см. §4.1.1).

### 3.4. QuoteRevision

| Поле                    | Тип                                                         | Примечание                                                                        |
| ----------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `id`                    | String uuid                                                 |                                                                                   |
| `workspaceId`           | String                                                      | FK Workspace                                                                      |
| `quoteId`               | String                                                      | FK Quote                                                                          |
| `revisionNumber`        | Int                                                         | unique `(quoteId, revisionNumber)`                                                |
| `status`                | enum DRAFT/ISSUED/ACCEPTED/DECLINED/EXPIRED/SUPERSEDED/VOID |                                                                                   |
| `currency`              | String `@db.Char(3)`                                        | ISO 4217                                                                          |
| `taxMode`               | enum INCLUSIVE/EXCLUSIVE                                    |                                                                                   |
| `subtotalMinor`         | BigInt                                                      | сумма позиций до налога/скидки                                                    |
| `discountMinor`         | BigInt                                                      | 0, если нет                                                                       |
| `taxMinor`              | BigInt                                                      |                                                                                   |
| `totalMinor`            | BigInt                                                      |                                                                                   |
| `validUntil`            | DateTime?                                                   | срок действия                                                                     |
| `customerSnapshot`      | Json                                                        | snapshot legal name/taxId/address/contact на момент выпуска                       |
| `calculationVersion`    | String                                                      | версия алгоритма расчёта; immutable после issue                                   |
| `calculationSnapshot`   | Json                                                        | currency exponent/metadata version + rounding/tax policy; без утверждённых ставок |
| `declinedAt`            | DateTime?                                                   | server time; только для DECLINED                                                  |
| `declineReason`         | String?                                                     | обязательна для DECLINED; без секретов/PII                                        |
| `expiredAt`             | DateTime?                                                   | server time; только для EXPIRED                                                   |
| `voidedAt`              | DateTime?                                                   | server time; только для VOID                                                      |
| `voidReason`            | String?                                                     | обязательна для VOID; без секретов/PII                                            |
| `notes`                 | String?                                                     | внутренние/клиентские — решить                                                    |
| `issuedAt`/`issuedById` | DateTime?/String?                                           |                                                                                   |
| `supersededById`        | String?                                                     | successor revision; same Quote/Workspace                                          |
| `supersededAt`          | DateTime?                                                   | server time; только для SUPERSEDED                                                |
| `createdAt`/`updatedAt` | DateTime                                                    |                                                                                   |

`DRAFT` можно менять. После выпуска **содержимое** редакции — строки, суммы,
`customerSnapshot`, `calculationVersion`/`calculationSnapshot` — immutable:
обычный edit/update запрещён, изменение содержимого создаёт новую редакцию.
`ISSUED`/`ACCEPTED`/`DECLINED`/`EXPIRED`/`SUPERSEDED`/`VOID` — read-only именно
для содержимого, а не для lifecycle-поля `status`: переходы статуса выполняются
только контролируемыми серверными командами с reason/timestamp/ActivityLog, не
generic PATCH. `supersededById`/`supersededAt` выставляются командой создания
новой редакции. `ACCEPTED`/`DECLINED`/`EXPIRED`/`SUPERSEDED`/`VOID` — terminal:
обратных переходов нет, принятая редакция остаётся terminal и не редактируется.
`DECLINED`/`VOID` требуют reason + timestamp; `EXPIRED` — server time при
переходе; `SUPERSEDED` — server time/audit, отдельная reason не обязательна,
если политика не утвердит иное. `customerSnapshot` фиксирует реквизиты на момент выпуска, чтобы
последующее изменение Company не меняло исторический документ.
`calculationVersion`/`calculationSnapshot` фиксируют версию метода расчёта,
currency exponent/metadata, округление и налоговую политику на момент выпуска;
изменение алгоритма не переинтерпретирует старые редакции (см. §5.2).
`totalMinor = subtotalMinor - discountMinor + taxMinor` (для EXCLUSIVE); для
INCLUSIVE формула должна быть явно определена и покрыта тестами. Точные
ставки/юрисдикции/exponent здесь не утверждаются — это открытое решение и
approval gate.

### 3.5. QuoteLine

| Поле                | Тип           | Примечание                  |
| ------------------- | ------------- | --------------------------- |
| `id`                | String uuid   |                             |
| `workspaceId`       | String        | FK Workspace                |
| `revisionId`        | String        | FK QuoteRevision            |
| `position`          | Int           | порядок                     |
| `description`       | String        |                             |
| `quantity`          | Decimal(12,3) | точность — открытое решение |
| `unitPriceMinor`    | BigInt        | цена за единицу             |
| `discountMinor`     | BigInt        | скидка на позицию           |
| `taxRateBps`        | Int           | 0..10000; 0, если нет       |
| `lineSubtotalMinor` | BigInt        |                             |
| `lineTaxMinor`      | BigInt        |                             |
| `lineTotalMinor`    | BigInt        |                             |

Строки принадлежат редакции; после выпуска неизменяемы. Удаление строк
допустимо только в DRAFT. Для issued-редакции — только новая редакция.

### 3.6. QuoteAcceptance

| Поле           | Тип                                    | Примечание                                   |
| -------------- | -------------------------------------- | -------------------------------------------- |
| `id`           | String uuid                            |                                              |
| `workspaceId`  | String                                 | FK Workspace                                 |
| `quoteId`      | String                                 | FK Quote                                     |
| `revisionId`   | String                                 | FK QuoteRevision, unique                     |
| `acceptedAt`   | DateTime                               | серверное время                              |
| `acceptedById` | String                                 | MVP: внутренний User; actor/recorder — §3.13 |
| `method`       | enum MANUAL/EMAIL/DOCUMENT/E_SIGNATURE |                                              |
| `evidenceRef`  | String?                                | ссылка/идентификатор документа               |
| `documentHash` | String?                                | SHA-256, если есть файл                      |
| `note`         | String?                                | без секретов/PII сверх необходимого          |
| `createdAt`    | DateTime                               |                                              |

Одна запись на редакцию (`@@unique([revisionId])`). `quoteId` — server-owned и
должен совпадать с `revision.quoteId`/Workspace (см. §4.1.1), а не задаваться
клиентом. Immutable: нет update/delete API; исправление — новая редакция/новый
факт, а не перезапись. Acceptance возможен только для `ISSUED` и не истёкшей
редакции; для `DRAFT`/`SUPERSEDED`/`DECLINED`/`EXPIRED`/`VOID` — запрещён.
Юридический смысл — открытое решение; `E_SIGNATURE` не следует использовать,
пока нет юридически проверенного провайдера.

**MVP и actor.** В MVP внешний customer link/portal и принятие через публичную
URL не входят: факт фиксирует внутренний аутентифицированный пользователь.
Поле `acceptedById` в таблице выше перегружено (кто совершил и кто записал);
до schema decision его нужно развести по §3.13. Для будущего внешнего/PSP
актора не навязывать User FK и не считать `acceptedById` внешним клиентом.

### 3.7. Order

| Поле                                                    | Тип                                                  | Примечание                                                  |
| ------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| `id`                                                    | String uuid                                          |                                                             |
| `workspaceId`                                           | String                                               | FK Workspace                                                |
| `number`                                                | String                                               | unique per Workspace; `O-2026-0001`                         |
| `companyId`/`contactId`                                 | String?                                              | snapshot клиента также хранится                             |
| `quoteId`/`quoteRevisionId`                             | String?                                              | source; `quoteRevisionId` unique where not null             |
| `idempotencyKey`                                        | String?                                              | unique per Workspace where not null; required для конверсии |
| `requestHash`                                           | String?                                              | SHA-256 canonical request; required вместе с key            |
| `calculationVersion`/`calculationSnapshot`              | String/Json                                          | копия из revision на момент конверсии                       |
| `status`                                                | enum DRAFT/CONFIRMED/IN_PROGRESS/FULFILLED/CANCELLED |                                                             |
| `currency`                                              | String `@db.Char(3)`                                 | должна совпадать с revision                                 |
| `subtotalMinor`/`discountMinor`/`taxMinor`/`totalMinor` | BigInt                                               | snapshot                                                    |
| `customerSnapshot`                                      | Json                                                 | snapshot на момент конверсии                                |
| `orderedAt`/`confirmedAt`/`cancelledAt`                 | DateTime?                                            |                                                             |
| `dueDate`                                               | DateTime?                                            | для aging                                                   |
| `cancelReason`                                          | String?                                              |                                                             |
| `createdById`/`updatedById`                             | String                                               |                                                             |
| `createdAt`/`updatedAt`                                 | DateTime                                             |                                                             |

`quoteRevisionId` unique (где not null) — не более одного Order на принятую
редакцию. `Order` не пересчитывает цены из текущей Quote: он использует
snapshot revision. Хотя бы один из `companyId`/`contactId` обязателен;
`customerSnapshot` фиксирует клиента на момент конверсии. Ручной Order без
Quote — только если пользователь разрешит; в MVP рекомендуется не смешивать.
`Order.quoteId` — server-owned и должен совпадать с `quoteRevision.quoteId`/
Workspace (см. §4.1.1).

#### 3.7.1. Идемпотентность конверсии (предложение, не schema decision)

Нужен persisted idempotency key + canonical request hash; одного
`quoteRevisionId unique` недостаточно: повтор с тем же ключом должен вернуть
тот же Order, а конфликтный payload — 409.

Варианты хранения:

- **A.** Поля `Order.idempotencyKey` + `Order.requestHash`, unique
  `(workspaceId, idempotencyKey)`; плюс unique `quoteRevisionId`. Проще для
  одной команды.
- **B (рекомендация для расширения).** Отдельная scoped `IdempotencyRecord`:
  `workspaceId`, `scope` (`quote.convert`), `key`, `requestHash`,
  `resultEntityType`, `resultEntityId`, `createdAt`; unique
  `(workspaceId, scope, key)`. Создаётся в той же транзакции, что Order, и
  может переиспользоваться для платежей/webhook без смешивания с бизнес-полями
  Order.

Правила:

- key обязателен, opaque, с серверной валидацией длины/символов; не логируется
  и не является authorization.
- canonical request: stable JSON с сортированными ключами/UTF-8, только
  server-meaningful поля (`quoteId`, `revisionId`, `dueDate`, другие persisted
  options; отсутствие optional-поля кодируется как `null`; без key,
  `workspaceId` и клиентских totals). Hash SHA-256 считает сервер; клиентский
  hash игнорируется.
- тот же key + тот же hash → вернуть **сохранённый** Order (idempotent replay),
  без второго Order/ActivityLog.
- тот же key + другой hash → 409 `IDEMPOTENCY_KEY_REUSED`.
- другой key для уже использованной accepted revision → 409
  `QUOTE_ALREADY_CONVERTED` (рекомендация). Возврат существующего Order вместо
  409 — только по явно утверждённой продуктовой политике.
- Order + OrderLine + idempotency record + ActivityLog + номер — одна
  транзакция; unique constraints — последний барьер при гонке. При rollback
  idempotency record не остаётся «успешным». Отдельного долгоживущего
  `IN_PROGRESS` нет: record фиксируется только успешным commit; найденный
  незавершённый/битый record → 409/500, второй Order не создаётся.
- Если record найден, а связанный Order отсутствует — invariant error, не
  создавать новый Order по этому record.
- конкурентный unique violation → re-read record/Order и применить правила
  выше; не создавать дубль.
- TTL/retention idempotency keys — открытое решение; не меньше срока жизни
  заказа, точная политика требует approval.
- Ручной Order без Quote (если разрешён отдельно) не обязан иметь key/hash;
  для конверсии accepted revision key/hash обязательны.

### 3.8. OrderLine

Снимок позиций: `orderId`, `workspaceId`, `position`, `description`,
`quantity`, `unitPriceMinor`, `discountMinor`, `taxRateBps`, `lineSubtotalMinor`,
`lineTaxMinor`, `lineTotalMinor`, `sourceQuoteLineId?`. После `CONFIRMED`
неизменяемы; изменения — только через отмену/новый заказ (или отдельную
amendment-модель, которая в MVP не предлагается).

### 3.9. PaymentAttempt

Попытка оплаты/операция провайдера, ещё не обязательно проведённая в баланс.

| Поле                        | Тип                                     | Примечание                   |
| --------------------------- | --------------------------------------- | ---------------------------- |
| `id`                        | String uuid                             |                              |
| `workspaceId`               | String                                  | FK Workspace                 |
| `orderId`                   | String                                  | FK Order                     |
| `provider`                  | String                                  | `manual`, `mock`, future PSP |
| `providerPaymentId`         | String?                                 | внешний ID                   |
| `idempotencyKey`            | String                                  | scoped; hash/result — §9.1.2 |
| `status`                    | enum PENDING/SUCCEEDED/FAILED/ABANDONED |                              |
| `amountMinor`               | BigInt                                  | > 0                          |
| `currency`                  | String `@db.Char(3)`                    | = order currency             |
| `requestedAt`/`completedAt` | DateTime?                               |                              |
| `errorCode`/`errorMessage`  | String?                                 | безопасный текст             |
| `createdAt`/`updatedAt`     | DateTime                                |                              |

Attempt не влияет на balance, пока не `SUCCEEDED` и не создана PaymentEntry.
Для ручной оплаты attempt может создаваться и сразу успешно завершаться в одной
транзакции.

### 3.10. PaymentEntry (append-only ledger)

| Поле                | Тип                                       | Примечание                               |
| ------------------- | ----------------------------------------- | ---------------------------------------- |
| `id`                | String uuid                               |                                          |
| `workspaceId`       | String                                    | FK Workspace                             |
| `orderId`           | String                                    | FK Order                                 |
| `attemptId`         | String?                                   | FK PaymentAttempt                        |
| `type`              | enum PAYMENT/REFUND/CHARGEBACK/ADJUSTMENT |                                          |
| `amountMinor`       | BigInt                                    | всегда > 0; знак определяется type       |
| `currency`          | String `@db.Char(3)`                      | = order currency                         |
| `occurredAt`        | DateTime                                  | фактическая дата операции                |
| `recordedById`      | String                                    | MVP: внутренний User; см. §3.13          |
| `idempotencyKey`    | String                                    | scoped; hash/result — §9.1.2             |
| `reversalOfId`      | String?                                   | REFUND/CHARGEBACK → source PAYMENT; §9.1 |
| `providerReference` | String?                                   | ID провайдера                            |
| `reason`            | String?                                   | для refund/adjustment/chargeback         |
| `createdAt`         | DateTime                                  |                                          |

Immutable: нет update/delete API. `REFUND`/`CHARGEBACK`/`ADJUSTMENT` — отдельные
записи, не изменение исходного PAYMENT. Сумма `REFUND`/`CHARGEBACK` не может
превышать captured минус все предыдущие `REFUND`/`CHARGEBACK` по тому же source
PAYMENT; проверка и вставка — под lock в одной транзакции (см. §9.1.1).
`amountMinor` хранится положительным, чтобы не путать знак и тип. В MVP
`recordedById` — внутренний User, который записал факт; для будущих
PSP/системных событий actor может быть внешним/системным, и User FK не
навязывается (см. §3.13). `occurredAt` — когда операция произошла, `createdAt` —
когда запись создана; это разные факты.

### 3.11. DocumentCounter

`id`, `workspaceId`, `docType` (QUOTE/ORDER), `year`, `nextNumber`, unique
`(workspaceId, docType, year)`. Номер выделяется атомарно в транзакции
(`UPDATE ... RETURNING`/upsert), а не `MAX+1` без блокировки.

### 3.12. ActivityLog

Расширить allow-list `entityType`: `company`, `quote`, `quote_revision`,
`order`, `payment`, `acceptance`. `entityId` — ID сущности; `action` —
например `quote.issued`, `quote.accepted`, `order.created`,
`payment.recorded`, `payment.refunded`; `metadata` — минимальные ID/статусы/
суммы, без PII/секретов/free-text. Financial source of truth — immutable
QuoteAcceptance/PaymentEntry, ActivityLog — вторичный audit trail.

### 3.13. Actor, recorder, source и внешний доступ (сквозное правило)

**Внешний customer link/portal не входит в MVP.** В MVP нет публичной URL-ссылки
для принятия Quote; факт принятия фиксирует внутренний аутентифицированный
пользователь. Это предложенная модель, а не утверждённая коммерческая политика:
`COMMERCIAL_CORE_DISCOVERY.md` §3.10 фиксирует варианты, но не выбирает внешний
доступ.

`QuoteAcceptance.acceptedById` и `PaymentEntry.recordedById` в таблицах выше
ссылаются на User. Этого недостаточно, если позже появится внешнее принятие или
PSP webhook: нужно различать **кто совершил действие** и **кто его записал**.
До schema decision предлагается:

- `recordedById` — внутренний User, создавший запись; в MVP required.
- `actorType` — enum `INTERNAL_USER`/`EXTERNAL_PARTY`/`SYSTEM`: кто совершил
  действие.
- `actorUserId` — FK User только для `INTERNAL_USER`; nullable.
- `actorExternalRef` — opaque-ссылка на внешнего актора (portal identity/PSP
  customer); не FK User; PII минимизировать.
- `source`/`method` — канал и доказательство (MANUAL/EMAIL/DOCUMENT/
  E_SIGNATURE; future PSP_WEBHOOK/EXTERNAL_LINK).
- `occurredAt`/`createdAt` — когда действие произошло / когда запись создана.
- provider event ID / idempotency key — для PSP/webhook; unique where
  applicable.

Правила:

- MVP: acceptance/payment recording — только внутренний User; `recordedById`
  обязателен; `actorType = INTERNAL_USER`, `actorUserId = recordedById`, если
  продукт не решит иначе.
- Future external: `actorType = EXTERNAL_PARTY`/`SYSTEM`, `actorExternalRef`
  или provider reference вместо User FK; не подставлять фиктивного User и не
  считать `acceptedById` внешним клиентом.
- PSP webhook: actor/source/idempotency (`provider`, event ID) — серверные;
  `recordedById` может отсутствовать или быть system actor только по явному
  решению; не навязывать User FK.
- Если выбран внешний link/portal — отдельный дизайн: token hash, expiry,
  revoke, rate-limit, replay, PII, acceptance actor/source. Нельзя
  переиспользовать `acceptedById` как внешнего актора.

Открытые решения: нужен ли system user / nullable actor; допустимо ли внешнее
доказательство без внутреннего подтверждения; юридический смысл; хранение
external ref/PII; выбор A/B/C в discovery §3.10. До ответов внешний доступ не
реализуется.

## 4. Tenant scoping и linked-entity validation

### 4.1. Модель изоляции

- `workspaceId` not null на всех коммерческих таблицах.
- `@@unique([id, workspaceId])` на родителях, чтобы можно было использовать
  composite FK `(parentId, workspaceId) -> (id, workspaceId)`. Если конкретная
  Prisma-версия не позволяет такую связь, остаётся composite unique + серверная
  проверка; это не отменяет `workspaceId`.
- Все чтения: `where: { id, workspaceId }`; списки — `where: { workspaceId }`.
- Все to-one связи на чтении фильтруются по Workspace; чужая/битая → `null`;
  to-many → отфильтрованный массив.
- Никаких `findMany()` без limit на бизнес-таблицах.

### 4.1.1. Критичные инварианты связей

`workspaceId` на обеих сторонах необходим, но недостаточен: он не запрещает
связать, например, acceptance с revision другого Quote того же Workspace.
Предлагаются явные инварианты; все identity-поля — server-owned, не из body.

| Инвариант                    | Проверка                                                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| QuoteAcceptance ↔ Revision   | `acceptance.quoteId = revision.quoteId`; `acceptance.workspaceId = revision.workspaceId`; revision принадлежит этой Quote; `@@unique([revisionId])` |
| Order ↔ QuoteRevision        | `order.quoteId = quoteRevision.quoteId`; workspace совпадает; `quoteRevisionId` unique; Order не может ссылаться на revision другого Quote          |
| Quote.currentRevisionId      | `revision.quoteId = quote.id`; workspace совпадает; не self/cross-quote; обновляется атомарно вместе с новой редакцией                              |
| QuoteRevision.supersededById | target revision той же Quote/Workspace; target ≠ self; только successor; без циклов; старый status = `SUPERSEDED`, `supersededAt` set               |
| PaymentEntry ↔ Attempt       | если `attemptId` задан: `attempt.orderId = entry.orderId`; workspace совпадает; currency/amount checks                                              |
| PaymentEntry.reversalOfId    | REFUND/CHARGEBACK → source PAYMENT в том же Order/Workspace/currency; не self; cumulative cap/lock — §9.1.1                                         |

Enforcement: composite FK — только если Prisma/БД реально поддерживает и это
отдельно одобрено: например, unique `(id, quoteId, workspaceId)` на
`QuoteRevision`, `(id, orderId, workspaceId)` на `PaymentAttempt` и
соответствующие composite-ссылки. Если composite FK не принят или невозможен —
service checks в той же транзакции + integration tests. Не заявлять
DB-enforced, пока нет миграции/тестов. Одного `workspaceId` недостаточно.

### 4.2. Проверки при записи

| Связь                        | Проверка                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| Quote.companyId              | Company существует и `workspaceId` совпадает                                             |
| Quote.contactId              | Contact существует и `workspaceId` совпадает; `companyId` Contact, если задан, совпадает |
| Quote.leadId                 | Lead существует и `workspaceId` совпадает; иначе 404                                     |
| Quote.currentRevisionId      | Revision той же Quote/Workspace; server-owned                                            |
| QuoteRevision.quoteId        | Quote принадлежит Workspace                                                              |
| QuoteRevision.supersededById | Revision той же Quote/Workspace; не self; без циклов                                     |
| QuoteLine.revisionId         | Revision принадлежит Workspace и находится в DRAFT                                       |
| QuoteAcceptance.quoteId      | = `revision.quoteId`; Workspace совпадает; server-derived                                |
| QuoteAcceptance.revisionId   | Revision ISSUED, не истекла, принадлежит Workspace                                       |
| Order.quoteId                | = `quoteRevision.quoteId`; Workspace совпадает; required при `quoteRevisionId`           |
| Order.quoteRevisionId        | Revision ACCEPTED, принадлежит Workspace, ещё не сконвертирована                         |
| Order.companyId/contactId    | принадлежат Workspace; snapshot сохраняется                                              |
| OrderLine.orderId            | Order принадлежит Workspace                                                              |
| PaymentAttempt/Entry.orderId | Order принадлежит Workspace; currency совпадает                                          |
| PaymentEntry.attemptId       | Attempt того же Order/Workspace; currency/amount checks                                  |
| PaymentEntry.recordedById    | MVP: User принадлежит Workspace; future actor — см. §3.13                                |

Несуществующий и чужой ID дают одинаковый 404. Клиент не может задать
`workspaceId`, `createdById`, `status`, totals, `paid`, `acceptedAt`,
`acceptedById`, `currentRevisionId`, `supersededById`, identity-связи
`quoteId`/`quoteRevisionId`/`attemptId` или `requestHash`.

## 5. Деньги, количество, налоги, округление

### 5.1. Предложение по типам

- `amountMinor`: `BigInt` (не `Float`, не `number`), хранит целые minor units.
- `currency`: `String @db.Char(3)`, ISO 4217.
- **Minor-unit exponent не равен автоматически 2.** `amountMinor`
  интерпретируется через currency metadata (exponent + version); конкретные
  валюты/exponent не утверждаются. MVP: либо approved supported-currency list,
  либо воспроизводимая metadata policy/version, сохраняемая в
  `calculationSnapshot`; без этого расчёт блокируется.
- `quantity`: `Decimal(12,3)` — если бизнес допускает дробное количество;
  иначе `Int`. Это **открытое решение**, не факт.
- `taxRateBps`: `Int` 0..10000 (базисные пункты), без плавающих ставок.
- `taxMode`: enum `INCLUSIVE`/`EXCLUSIVE`.
- API: `BigInt` сериализуется в строку (JSON не поддерживает BigInt), чтобы не
  терять точность; Zod принимает строку/целое и валидирует диапазон.

### 5.2. Правила

- Одна валюта на QuoteRevision/Order; PaymentEntry/Attempt должны совпадать с
  валютой Order. Мультивалютность/FX — не MVP.
- `subtotalMinor = Σ lineSubtotalMinor`; `taxMinor = Σ lineTaxMinor`;
  `totalMinor` вычисляется по явной формуле для выбранного tax mode.
- Округление — только к minor unit, explicit method (рекомендация: half-up на
  позицию, затем сумма; альтернатива — округление итога). Метод фиксируется в
  документации и unit-тестах.
- Версия расчёта: `calculationVersion` + `calculationSnapshot` (currency
  exponent/metadata version, rounding method/scope, tax mode/policy,
  jurisdiction reference — если approved) фиксируются в immutable
  QuoteRevision при выпуске и копируются в Order. Изменение алгоритма не
  переинтерпретирует старые документы; новая версия применяется только к новым
  редакциям. Ставки/юрисдикции/exponent здесь не утверждаются — нужен approval
  gate (бухгалтер/юрист).
- Currency exponent: до выпуска exponent берётся из approved currency list
  или воспроизводимой metadata policy/version; implicit 2 знака запрещён.
  Неизвестная/неподдерживаемая валюта → отказ, а не догадка. Версия metadata
  сохраняется в `calculationSnapshot` и не пересчитывается задним числом.
- Скидки: рекомендация — скидка на позицию; скидка на итог — только если
  пользователь явно разрешит, чтобы не смешивать базы налога.
- Никаких жёстко зашитых ставок НДС/юрисдикций. `taxRateBps` и tax mode —
  данные, а не константы кода.
- Валидация: суммы ≥ 0, количество > 0, tax rate в диапазоне, currency ровно 3
  буквы, итог не отрицательный (если отрицательные credit-строки не разрешены).

### 5.3. Открытые решения

Точность quantity, округление на позицию/итог, tax inclusive/exclusive,
юрисдикция/ставки, одна валюта vs несколько, скидки на позицию/итог, формат
отображения, состав `calculationSnapshot`, currency exponent и источник
currency metadata (approved list vs policy/version), кто утверждает изменение
`calculationVersion`. Конкретные валюты/exponent/ставки не считаются
утверждёнными до отдельного approval.

## 6. Immutable revisions и acceptance

### 6.0. Authority: revision vs aggregate

Ниже — предложение; до approval статусы, переходы и поля reason/timestamp не
считаются утверждёнными.

- `QuoteRevision.status` — источник истины для состояния конкретной редакции и
  права на accept/convert.
- **Immutability split:** содержимое (lines, customerSnapshot, money,
  calculationSnapshot) immutable после issue; lifecycle-поля (`status`,
  `supersededById`, reason/timestamps) меняются только контролируемыми
  серверными командами с audit, не generic edit. `ACCEPTED` — terminal.
- `Quote.status` — производная проекция `currentRevision` для списков/фильтров,
  а не независимый workflow. Сервер обновляет её в той же транзакции; клиент не
  задаёт. При расхождении aggregate/revision — invariant violation: команда
  блокируется, а не «исправляет» статус на лету.
- Наборы: revision — `DRAFT`/`ISSUED`/`ACCEPTED`/`DECLINED`/`EXPIRED`/
  `SUPERSEDED`/`VOID`; quote — `DRAFT`/`ISSUED`/`ACCEPTED`/`DECLINED`/
  `EXPIRED`/`VOID` (без `SUPERSEDED`). Mapping: revision `DRAFT`/`ISSUED`/
  `ACCEPTED`/`DECLINED`/`EXPIRED`/`VOID` → одноимённый `Quote.status`;
  `SUPERSEDED` не становится текущим, `currentRevisionId` не должен указывать
  на superseded.
- Terminal: `ACCEPTED`/`DECLINED`/`EXPIRED`/`SUPERSEDED`/`VOID`. Обратных
  переходов нет; дальнейшие действия (новая редакция/новый факт) — только по
  явно утверждённой политике. `DRAFT` редактируется; `ISSUED` → `ACCEPTED`/
  `DECLINED`/`EXPIRED`/`VOID` или заменяется новой редакцией.
- `accept`: только `ISSUED`, не истёкшая на server time, не void/declined/
  superseded.
- `convert`: только `ACCEPTED`; `DRAFT`/`ISSUED`/`DECLINED`/`EXPIRED`/`VOID`/
  `SUPERSEDED` запрещены. После `ACCEPTED` срок не меняет статус на `EXPIRED`.
- Reason/timestamps: `declinedAt` + `declineReason`, `voidedAt` + `voidReason`,
  `expiredAt`, `supersededAt`; server time. Reason обязательна для declined/void,
  безопасный текст без секретов/PII; expired — системное следствие `validUntil`;
  superseded — audit новой редакции. Копии
  reason на Quote не хранятся; источник — revision/audit.
- Открытые продуктовые решения: создание новой редакции после
  `DECLINED`/`EXPIRED`/`VOID`; точный триггер/grace period/timezone для
  `EXPIRED`; можно ли отозвать acceptance. До ответов эти переходы не
  реализуются.

### 6.1. Жизненный цикл

```text
QuoteRevision:
DRAFT ──issue──> ISSUED ──accept──> ACCEPTED
                    ├──decline──> DECLINED
                    ├──expire───> EXPIRED
                    ├──void─────> VOID
                    └──new revision──> old SUPERSEDED; new DRAFT

Quote.status = projection of currentRevision
(без SUPERSEDED; независимых переходов нет)
```

- В `DRAFT` можно менять шапку/строки; каждая правка — в транзакции.
- `issue`: проверка полноты, фиксация `customerSnapshot`/`calculationSnapshot`,
  расчёт totals, присвоение номера, перевод в `ISSUED`, ActivityLog. После
  commit содержимое read-only; lifecycle — только команды.
- Новая редакция: только из `ISSUED`; создать `QuoteRevision` (DRAFT), старую
  пометить `SUPERSEDED`, выставить `supersededById`/`supersededAt` в одной
  транзакции; содержимое старой не меняется. После
  `ACCEPTED`/`DECLINED`/`EXPIRED`/`VOID` — открытое решение, по умолчанию
  запрещено.
- `accept`: только `ISSUED`, не истекшая, не void/declined/superseded;
  создать `QuoteAcceptance`, перевести revision/quote в `ACCEPTED`,
  ActivityLog — одна транзакция. `ACCEPTED` terminal: content/status не
  меняются.
- `decline`/`expire`/`void`: контролируемая серверная команда меняет только
  lifecycle status + reason/timestamp + ActivityLog; не удалять и не делать
  generic edit. `expire` — только при `validUntil != null` и наступлении срока;
  точная политика (job/manual, timezone) — открытое решение.
- Конверсия в Order — только из `ACCEPTED` (см. §7); expired/declined/void/
  superseded не конвертируются.
- Принятая редакция не редактируется; Order ссылается на неё.

### 6.2. Enforcement

- В сервисах: команды `issueQuoteRevision`, `acceptQuoteRevision`,
  `declineQuoteRevision`, `expireQuoteRevision`, `voidQuoteRevision`,
  `createQuoteRevision`; никаких generic PATCH статуса/сумм.
- В Prisma: условные update `where: { id, workspaceId, status: "DRAFT" }` (и
  аналогично для `ISSUED`); проверка количества обновлённых строк; обновление
  `Quote.status`-проекции в той же транзакции.
- DB check/trigger для запрета update issued-строк — опционально позже; если
  добавлять, он должен различать immutable content-колонки и разрешённые
  lifecycle-status переходы (или оставаться service-level). В MVP достаточно
  сервисного слоя + отсутствия generic API. Не выдавать это за DB-enforced
  immutability.
- Audit: `quote.issued`, `quote.revision_created`, `quote.accepted`,
  `quote.declined`, `quote.expired`, `quote.voided` с revision ID; reason — без
  PII/секретов.

## 7. Order conversion

### 7.1. Команда

`POST /api/quotes/:id/convert-to-order` (предложение; путь может измениться).

Вход: `revisionId` (или текущая accepted revision), `Idempotency-Key` (header;
body — fallback, выбрать один способ), опционально `dueDate`/notes. Key и
canonical request hash **persisted** (см. §3.7.1); notes входят в hash только
если proposal добавит persisted-поле Order. Клиент не передаёт
суммы/строки/клиента/`workspaceId`/`requestHash`.

### 7.2. Алгоритм (одна транзакция)

1. Загрузить Quote + Revision scoped к Workspace.
2. Проверить `Revision.status = ACCEPTED` и `Quote.status = ACCEPTED`
   (aggregate = projection); отклонить `DRAFT`/`ISSUED`/`DECLINED`/`EXPIRED`/
   `VOID`/`SUPERSEDED`. Проверить, что редакция не истекла до принятия.
3. Вычислить canonical request hash на сервере и проверить persisted
   idempotency record:
   - тот же key + тот же hash + завершённая запись → вернуть сохранённый Order
     без второго Order/ActivityLog;
   - тот же key + другой hash → 409 `IDEMPOTENCY_KEY_REUSED`.
4. Проверить отсутствие Order по `quoteRevisionId`. Если Order уже есть, а key
   другой/записи нет → 409 `QUOTE_ALREADY_CONVERTED` (рекомендация); возврат
   существующего Order — только по явно утверждённой политике.
5. Проверить/пересчитать суммы из snapshot; не доверять клиентским totals;
   скопировать `calculationVersion`/`calculationSnapshot`.
6. Выделить Order number атомарно (`DocumentCounter`).
7. Создать Order + OrderLines + idempotency record + ActivityLog
   `order.created` в одной транзакции.
8. Commit; вернуть Order.

Unique `quoteRevisionId` и unique idempotency key — последний барьер от дубля
при гонке; при unique violation перечитать record/Order и применить правила
шагов 3–4, не создавать дубль. Внешние вызовы (уведомления/PSP) — после commit,
через outbox/async, не внутри транзакции.

### 7.3. Правила

- Один accepted revision → не более одного Order. Частичные/несколько Order —
  не MVP, отдельное решение.
- Ручной Order без Quote — только по явному разрешению; тогда нужен другой
  источник snapshot и audit.
- Повтор с тем же key/hash идемпотентен: тот же Order, без второго заказа.
  Тот же key с другим payload → 409; другой key для уже сконвертированной
  revision → 409 (или существующий Order только по утверждённой политике).
- Все записи конверсии (Order/Lines, idempotency, ActivityLog, номер) атомарны;
  частично созданный Order/idempotency record недопустим.

## 8. Order status и controlled changes

### 8.1. Предлагаемые статусы

`DRAFT` → `CONFIRMED` → `IN_PROGRESS` → `FULFILLED`; `CANCELLED` — из
`DRAFT`/`CONFIRMED`/`IN_PROGRESS` по правилам. `FULFILLED` не отменяется без
отдельного решения/возврата.

### 8.2. Правила переходов

| Переход                                 | Кто           | Условие                              |
| --------------------------------------- | ------------- | ------------------------------------ |
| DRAFT → CONFIRMED                       | ADMIN/MANAGER | суммы/клиент валидны, нет дубля      |
| CONFIRMED → IN_PROGRESS                 | ADMIN/MANAGER | подтверждённый заказ                 |
| IN_PROGRESS → FULFILLED                 | ADMIN/MANAGER | исполнение подтверждено              |
| DRAFT/CONFIRMED/IN_PROGRESS → CANCELLED | ADMIN/MANAGER | причина; при оплате — refund/решение |
| любой → тот же                          | идемпотентно  | без duplicate ActivityLog            |

- Отдельный `paymentStatus` не хранится как ручное поле: он производный
  (`UNPAID`/`PARTIAL`/`PAID`/`OVERPAID`/`REFUNDED`).
- Никакого `PATCH { status: "..." }` без allow-list; сервис проверяет переход,
  роль, Workspace, оплату и пишет ActivityLog.
- `Order`/`OrderLine` после `CONFIRMED` не редактируются in-place. Изменение
  условий — отмена/новый заказ (amendment-модель — позже).

## 9. Payment ledger, balances, aging

### 9.1. Модель

- `PaymentAttempt` — попытки (ручные/PSP), статус, ошибки, idempotency.
- `PaymentEntry` — только проведённые факты: PAYMENT/REFUND/CHARGEBACK/
  ADJUSTMENT; immutable; `amountMinor > 0`; знак по типу.
- `PaymentEntry.reversalOfId` — REFUND/CHARGEBACK ссылается на source PAYMENT
  entry; исходная запись не меняется (см. §9.1.1).
- `PaymentEntry.idempotencyKey` — scoped key + canonical request hash; unique
  в scope; тот же key/hash не создаёт вторую проводку, конфликт — 409
  (см. §9.1.2).
- `PaymentAttempt.providerPaymentId`/webhook event ID — unique где применимо;
  actor/source для PSP — см. §3.13.

#### 9.1.1. Refund/chargeback integrity (предложение)

- `REFUND`/`CHARGEBACK` для захваченного платежа обязан ссылаться на исходный
  `PAYMENT` ledger entry (`reversalOfId`; альтернативное
  `sourcePaymentEntryId` — только если отдельно одобрено) в том же
  Order/Workspace/currency. Чужой Order/Workspace/currency или не-PAYMENT
  target → отказ (404/409), запись не создаётся.
- Лимит возврата считается по **сумме всех предыдущих** `REFUND`/`CHARGEBACK`,
  привязанных к этому `PAYMENT`, а не только по текущей операции:
  `available = sourcePayment.amountMinor - Σ previous REFUND/CHARGEBACK`.
  Новая сумма больше `available` → 409 `REFUND_EXCEEDS_CAPTURED`.
- В одной транзакции: `SELECT ... FOR UPDATE` исходного `PAYMENT` (или Order,
  если политика разрешает order-level), затем пересчёт `available` и вставка
  entry. Это serialize-ит concurrent refund/chargeback и не даёт over-refund;
  unique/idempotency key — последний барьер. Блокировка только Order без
  source payment допустима только для явно одобренной order-level политики.
- Возврат на уровне Order без конкретного capture — **не** MVP-default. Если
  продукт его разрешит, нужна явная бизнес-политика approval: source reference,
  блокируемая сущность, расчёт лимита и audit. Не выводить это из суммы Order
  автоматически.
- Unit: cumulative cap по source PAYMENT; отказ при чужом Order/Workspace/
  currency; отказ при target не-PAYMENT; order-level policy — отдельно.
- Integration: два конкурентных refund/chargeback не превышают capture;
  повтор с тем же idempotency key не создаёт вторую проводку; cross-order/
  cross-workspace попытки отклоняются.

#### 9.1.2. Payment idempotency и canonical hash (предложение)

Контракт распространяется на manual payment, refund/chargeback и будущие PSP
webhooks. Нужен persisted scoped key + **server-generated** canonical request
hash + устойчивая ссылка на результат.

- Рекомендуемая форма — generalized `IdempotencyRecord`: `workspaceId`,
  `scope` (`payment.create`/`payment.refund`/`payment.webhook:<provider>`),
  `key`, `requestHash`, `resultEntityType` (`PaymentAttempt`/`PaymentEntry`),
  `resultEntityId`, `createdAt`; unique `(workspaceId, scope, key)`. Узкая
  альтернатива — `requestHash` рядом с key на PaymentAttempt/PaymentEntry, но
  generalized record лучше покрывает manual + PSP.
- Canonical hash: stable JSON с сортированными ключами/UTF-8; hash считает
  сервер, клиентский hash игнорируется. В canonical входят только
  server-meaningful persisted поля:
  - create: `orderId`, `amountMinor`, `currency`, дата/метод/ссылку в той
    форме, в которой они сохраняются;
  - refund/chargeback: `sourcePaymentEntryId`, `type`, `amountMinor`,
    `currency`, reason/reference и дату;
  - webhook: `provider`, `providerEventId`, server-resolved
    order/attempt reference, amount/currency/status.
- Тот же `workspaceId` + `scope` + key + тот же hash → replay того же
  persisted outcome (тот же Attempt/Entry; без второй проводки/ActivityLog).
- Тот же key + другой hash → 409 `IDEMPOTENCY_KEY_REUSED`; новый outcome не
  создаётся.
- PSP webhook: `providerEventId`/provider event key unique для provider;
  повторная доставка — 2xx без side effect; новый key для уже использованного
  event ID не создаёт второй платёж (409/alert по политике).
- Atomic: idempotency record + Attempt/Entry + ActivityLog — одна транзакция;
  record фиксируется только успешным commit, rollback не оставляет
  «успешный» record; долгоживущего `IN_PROGRESS` нет. Unique constraints —
  последний барьер; при unique violation перечитать record/result и применить
  правила выше.
- Expiry/retention idempotency records — открытое решение и approval; не меньше
  срока хранения финансовых записей. Key не является authorization и не
  логируется.
- Это proposal, не schema decision.

### 9.2. Производные значения

```text
paidMinor = Σ PAYMENT - Σ REFUND - Σ CHARGEBACK + Σ ADJUSTMENT
balanceMinor = order.totalMinor - paidMinor
```

- `OVERPAID`, если `paidMinor > totalMinor`; показывать явно, не «исправлять»
  перезаписью.
- `REFUND`/`CHARGEBACK` не могут превышать `captured - Σ предыдущих
REFUND/CHARGEBACK` по тому же source PAYMENT; проверка и вставка — под
  lock исходного PAYMENT/Order в одной транзакции (см. §9.1.1). `CHARGEBACK`
  уменьшает баланс; `ADJUSTMENT` — только положительная корректировка с
  причиной и правом; отрицательная корректировка оформляется как
  `REFUND`/`CHARGEBACK` или reversal.
- `aging`: по `dueDate`/`orderedAt` и `balanceMinor`; buckets 0–30/31–60/61–90/
  90+; часовой пояс и база — открытое решение.
- Считать SQL-агрегатами scoped к Workspace/Order; без N+1. Кэш/материализация —
  только позже, с rebuild-правилом.

### 9.3. Ручные платежи

- Форма: сумма, валюта (только order currency), дата, метод, ссылка/комментарий.
- Создаёт `PaymentAttempt(SUCCEEDED)` + `PaymentEntry(PAYMENT)` в одной
  транзакции; либо сразу `PaymentEntry`, если attempt не нужен. Рекомендация —
  attempt для единообразия.
- Нельзя вручную менять `paid`/`balance`/`total`; только новые проводки.
- Refund/chargeback — отдельные команды с причиной и правом.

## 10. Provider webhook: verification и idempotency

Если PSP будет добавлен (отдельное решение), использовать существующий паттерн
n8n, но с провайдерским контрактом:

1. Прочитать raw body с лимитом; не парсить до проверки подписи.
2. Проверить подпись провайдера constant-time; timestamp/окно — по правилам
   провайдера; секрет только в ENV/секрет-хранилище.
3. Zod-валидация payload; неизвестные поля не доверять.
4. Идемпотентность: unique `(provider, providerEventId)` и/или scoped
   idempotency key + canonical hash (§9.1.2); повторный webhook — 2xx без side
   effect, другой payload/event ID конфликт → 409/alert, не менять баланс.
5. Найти Order по **серверно сохранённой** связи (metadata/attempt), не по
   `workspaceId`/`orderId` из тела без проверки.
6. Сверить amount/currency/order; расхождение — reject + alert, не менять
   баланс.
7. В одной транзакции: вставить PaymentEntry (если успех), обновить
   PaymentAttempt, ActivityLog. Внешние вызовы — после commit.
8. 2xx возвращать только после durable commit; иначе провайдер повторит.
9. Rate limit, body limit, логирование без секретов/PII.
10. Replay/повторная доставка не создаёт второй платёж; `REFUND`/chargeback —
    отдельные события.

## 11. Атомарные границы транзакций

| Команда                      | В одной транзакции                                                                | Вне транзакции                 |
| ---------------------------- | --------------------------------------------------------------------------------- | ------------------------------ |
| Создать/изменить draft Quote | Quote/Revision/Lines + ActivityLog                                                | —                              |
| Выпустить редакцию           | проверка DRAFT, номер, totals, snapshot, status, ActivityLog                      | уведомления                    |
| Принять Quote                | lock/check revision, acceptance, status, ActivityLog                              | email/PDF                      |
| Конвертировать в Order       | idempotency record/hash, check accepted, unique, номер, Order/Lines, ActivityLog  | уведомления/outbox             |
| Записать Payment             | idempotency record/hash, check order/currency/balance, Attempt/Entry, ActivityLog | PSP call — до/после, не внутри |
| Webhook PSP                  | provider event/idempotency record/hash, Entry/Attempt, ActivityLog                | ответ провайдеру после commit  |
| Refund/chargeback            | lock source PAYMENT/Order, cumulative cap, Entry, ActivityLog                     | провайдерский вызов            |
| Смена статуса Order          | allow-list, роль, ActivityLog                                                     | уведомления                    |

Правила: короткие транзакции; никаких сетевых вызовов внутри; при ошибке —
rollback; уникальные ограничения — последний барьер; `SELECT ... FOR UPDATE`/
условные update для гонок.

## 12. Audit

- `ActivityLog` для каждого commercial action: actor из сессии, entityType/
  entityId, action, metadata (IDs/статусы/суммы), timestamp.
- Immutable `QuoteAcceptance` и `PaymentEntry` — юридически/финансово значимые
  записи; не перезаписываются.
- Нет API update/delete для acceptance/payment entries; сервисы не предлагают
  таких методов.
- Metadata не содержит секретов, полного текста, лишних PII; суммы можно, если
  это нужно для audit.
- Просмотр audit — по ролям; финансовый audit — ограниченный круг.
- DB-триггер/revoke update/delete — опционально позже; в MVP — сервисный
  контроль + отсутствие endpoints. Не заявлять DB-enforced append-only, пока
  этого нет.

## 13. Удаление, retention, FK

| Сущность        | Правило (предложение)                                                     |
| --------------- | ------------------------------------------------------------------------- |
| Company         | Restrict, если есть Quote/Order; архивирование вместо удаления            |
| Contact         | Restrict, если есть Quote/Order/Lead/Task; 409 `ENTITY_IN_USE`            |
| Quote           | не удалять; void/decline/expire                                           |
| QuoteRevision   | не удалять; DRAFT-строки можно удалять только в draft-команде             |
| QuoteAcceptance | не удалять; immutable                                                     |
| Order           | не удалять; cancel/void по правилам                                       |
| OrderLine       | Restrict; draft-строки удаляются явной draft-командой, не через FK-каскад |
| PaymentAttempt  | не удалять; архив/статус                                                  |
| PaymentEntry    | не удалять; reversal entry                                                |
| ActivityLog     | не удалять; retention по политике                                         |

- Workspace/User deletion в MVP не реализуется; для будущего — SetNull/Restrict
  с сохранением actor snapshot.
- Retention финансовых документов/audit — юридическое решение; по умолчанию не
  удалять автоматически.
- PII/реквизиты минимизировать; файлы/доказательства — отдельное защищённое
  хранилище, не публичный bucket.

## 14. Слои, API, UI

### 14.1. Services (business logic)

Предлагаемые модули:

- `services/company.service.ts` — Company/Contact link, scoped CRUD, dedupe.
- `services/quote.service.ts` — draft, issue, revision, accept/decline/void.
- `services/order.service.ts` — convert, status transitions, derived payment
  status.
- `services/payment.service.ts` — manual entry, refund/chargeback, balances/
  aging, reconciliation helpers.
- `services/commercial-audit` — не отдельный слой, а функции внутри сервисов +
  `activity.service`.

Route Handlers — только транспорт: Origin/rate limit/body limit/Zod/auth/role/
service/envelope. Никаких Prisma-запросов и бизнес-правил в UI/Route Handler.

### 14.2. API conventions

- Единый envelope `{ success, data, error }`.
- Zod на body/query/params; суммы — строки/целые, не float.
- 404 для чужого/несуществующего; 409 для конфликтов (already converted,
  duplicate acceptance, idempotency key reuse, insufficient balance); 403 для
  роли.
- Idempotency-Key для конверсии/платежей: persisted scoped key + canonical
  request hash (§3.7.1, §9.1.2); тот же key/hash возвращает тот же результат,
  конфликт — 409; payload/ключ не логируются.
- Rate limit/body limit/Origin для mutations; webhook — подпись/timestamp.
- Никаких клиентских `workspaceId`, totals, `paid`, `status` bypass.

### 14.3. UI

- Customer 360: Company/Contact, Quotes, Orders, Balance, timeline.
- Quote builder: lines, quantity, price, discount, tax, totals breakdown;
  draft save; issue confirmation; revision history; accepted state.
- Acceptance dialog: method/evidence/warning; permission-aware.
- Order detail: source revision, snapshot, status, payment ledger, derived
  balance/aging; convert button disabled after conversion.
- Payment dialog: amount/date/method/reference; refund/chargeback with reason.
- Finance dashboard: cards + aging + filters; definitions; empty/error/
  permission states.
- Responsive: tables → cards; mobile actions; no dead buttons; no fake paid.

## 15. MVP scope и deferred

### 15.1. Рекомендуемый MVP

- Company (optional) + Contact link.
- Quote/Revision/Line; draft/issue/revision; acceptance record with evidence;
  explicit revision/aggregate status authority.
- Order from accepted revision; one-to-one; controlled statuses; persisted
  idempotency key + canonical request hash.
- Manual PaymentAttempt/PaymentEntry; refund/chargeback entries; derived balance/
  aging; scoped idempotency key + canonical hash.
- Single currency per document (workspace default); explicit tax mode/rate;
  documented rounding; approved currency exponent/metadata; `calculationVersion`/
  snapshot copied to Order.
- ActivityLog + immutable acceptance/payment records.
- Roles: явная матрица; separation of duties для acceptance/refund (детали —
  решение).
- Tests: unit money/tax/status, integration isolation/immutability/idempotency/
  ledger, E2E main path.

### 15.2. Deferred (не предлагать в первой поставке)

- multi-currency/FX;
- PSP/PCI/webhooks (кроме подготовки ledger);
- налоговый движок/ЭДО/инвойсинг по юрисдикциям;
- двойная бухгалтерия/general ledger;
- credit notes, dunning, subscriptions, partial/blanket orders;
- customer portal/e-signature;
- публичные customer links и внешнее принятие через URL (отдельный дизайн
  token/expiry/revoke/replay/PII);
- PDF/branding, если пользователь не подтвердит необходимость;
- BI/warehouse/экспорт в бухгалтерию.

## 16. Этапы реализации и approval gates

| Этап               | Содержание                                                                                                                                                                         | Gate                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 0. Decisions       | ответы на discovery §4: customer, acceptance, currency/exponent metadata, tax/calculation version, payments, roles, retention, status authority, actor model, external link/portal | **явное approval пользователя**  |
| 1. Schema proposal | финальные entities/fields/enums/constraints, migration plan, data migration `Contact.company`                                                                                      | **approval до изменения schema** |
| 2. Company/Contact | Company, `Contact.companyId`, scoped services, tests                                                                                                                               | review + approval                |
| 3. Quote/revisions | draft/issue/revision, money/tax/rounding, currency exponent, calculation snapshot, tests                                                                                           | review + approval                |
| 4. Acceptance      | acceptance record, actor/recorder, immutability, audit, permissions, tests                                                                                                         | security review                  |
| 5. Order           | persisted idempotency key/hash, conversion uniqueness, statuses, tests                                                                                                             | review + approval                |
| 6. Payments        | attempts/entries, manual/refund/chargeback, payment idempotency/hash, derived balance/aging, tests                                                                                 | security/finance review          |
| 7. UI/E2E/docs     | customer 360, builder, order/payment UI, E2E, docs                                                                                                                                 | acceptance plan update           |
| 8. PSP (optional)  | provider choice, webhook, reconciliation, PCI scope                                                                                                                                | **separate approval**            |

Правила gates:

- schema/migrations/seed не менять без явного approval;
- каждый этап — отдельный минимальный дифф, тесты на изменённое поведение;
- integration/E2E только на изолированной test-БД;
- не переносить исторические PASS на новую ревизию;
- при сомнении в юридике/налогах/деньгах — остановиться и эскалировать.

## 17. Тестовая стратегия

- **Unit:** money math, tax inclusive/exclusive, rounding, quantity, currency
  exponent/metadata policy, quote/revision status authority and terminal
  transitions, decline/expire/void reasons, permissions, Zod, idempotency
  key+hash (quote conversion and payment create/refund/webhook scopes),
  actor/recorder separation, cumulative refund/chargeback cap and source
  linkage, balance formula.
- **Integration (PostgreSQL, isolated):** workspace isolation для всех
  commercial entities; linked-entity validation; cross-parent invariants
  (acceptance quote/revision, order quote/revision, payment attempt/order,
  payment reversal/source PAYMENT, `currentRevisionId`/`supersededById`);
  composite FK (если приняты); immutable revision; acceptance uniqueness;
  conversion uniqueness/idempotency (same key/hash, different hash, different
  key); payment ledger/refund/overpayment/chargeback; payment create/refund/
  webhook idempotency (same key/hash replay, conflict 409, provider event unique);
  concurrent refunds under row lock without over-refund; cross-order/currency
  refund rejection; calculation snapshot/currency exponent copy and
  immutability; derived balance/aging; webhook replay; deletion restrictions;
  audit records.
- **E2E:** Company/Contact → Quote draft → issue → accept → convert → manual
  payment → balance; role denial; mobile; no fake states.
- **Security:** IDOR/BOLA, cross-workspace links, client-supplied totals/status,
  role bypass, replay, secret/PII leakage.
- **Acceptance:** расширить `docs/PHASE_1_ACCEPTANCE_PLAN.md` или создать
  отдельный Phase 2 plan; не смешивать с текущей приёмкой.

## 18. Риски и открытые вопросы

1. Юридический смысл acceptance не определён — блокирует acceptance/audit.
2. Налоги/валюта/округление не определены — блокируют money-модель.
3. Company vs Contact не решён — блокирует FK/UI.
4. Manual vs PSP не решён — влияет на attempts/webhooks/PCI.
5. Роли/approval thresholds не решены — риск инсайдерских операций.
6. Retention/legal hold не решены — риск удаления значимых данных.
7. Partial orders/refunds/chargebacks могут усложнить баланс.
8. Производительность derived balance/aging при росте данных.
9. Prisma composite FK/check constraints могут потребовать SQL-миграции.
10. PDF/e-sign/portal могут потребовать внешних зависимостей и approval.
11. Canonical request hash, scope и retention idempotency keys (конверсия/
    платежи/webhook) не утверждены — риск ложных replay/409.
12. Actor/source для внешнего/PSP события не решён — риск смешения клиента и
    внутреннего пользователя.
13. Authority статусов Quote/Revision, terminal transitions и триггер expiry
    требуют продуктового/юридического решения.
14. `calculationVersion`/`calculationSnapshot` и налоговая политика требуют
    approval бухгалтера/юриста; иначе исторические суммы будут
    интерпретироваться неверно.
15. Currency exponent/metadata source (approved list vs policy/version) не
    утверждены; implicit 2 знака может исказить minor units и историю.

## 19. Явное подтверждение статуса

Этот документ — **предложение**, а не schema decision и не разрешение на
реализацию. Никакие Prisma-модели, миграции, seed, API, UI или тесты в рамках
подготовки документа не изменялись. До approval gates коммерческие сущности не
добавляются. Следующий шаг — ответы на открытые решения и утверждение
schema/migration plan.
