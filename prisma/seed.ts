import { hashSync } from "bcryptjs";
import type { Role } from "@prisma/client";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

if (!SEED_ADMIN_PASSWORD) {
  throw new Error("SEED_ADMIN_PASSWORD is required and must not be empty");
}

const adminPassword: string = SEED_ADMIN_PASSWORD;
const passwordHash = hashSync(adminPassword, 12);

const WORKSPACE_NAME = "Demo";
const WORKSPACE_SLUG = "demo";
const DEMO_PREFIX = "[DEMO] ";

/** Every seeded Lead/Task title carries the `[DEMO]` marker required by the spec. */
function withDemoPrefix(title: string): string {
  return title.startsWith(DEMO_PREFIX) ? title : `${DEMO_PREFIX}${title}`;
}

/** Titles written by earlier seed versions (without the prefix). */
function withoutDemoPrefix(title: string): string {
  return title.startsWith(DEMO_PREFIX) ? title.slice(DEMO_PREFIX.length) : title;
}

type DemoContact = {
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: string;
};

type DemoLead = {
  title: string;
  message: string;
  source: string | null;
  status: string;
  priority: string;
  category: string | null;
  intent: string | null;
  customerType: string | null;
};

type DemoTask = {
  title: string;
  description: string | null;
  status: string;
  priority: string;
};

const contacts: DemoContact[] = [
  {
    name: "Иван Петров",
    company: "ООО «ТехноПоток»",
    email: "ivan.petrov@technopoto.ru",
    phone: "+7 900 111-22-33",
    status: "ACTIVE",
  },
  {
    name: "Мария Сидорова",
    company: "ИП Сидорова",
    email: "m.sidorova@mail.ru",
    phone: "89004445566",
    status: "ACTIVE",
  },
  { name: "Алексей Кузнецов", company: null, email: null, phone: null, status: "NEW" },
  {
    name: "Елена Волкова",
    company: "ООО «ВолгаТрейд»",
    email: "e.volkova@volgatrade.ru",
    phone: null,
    status: "ACTIVE",
  },
  {
    name: "Дмитрий Орлов",
    company: null,
    email: "d.orlov@example.com",
    phone: "+79007778899",
    status: "INACTIVE",
  },
  {
    name: "Ольга Михайлова",
    company: "ООО «МирКлик»",
    email: "o.mihaylova@mirclick.ru",
    phone: "8-900-123-45-67",
    status: "ACTIVE",
  },
  { name: "Сергей Новиков", company: null, email: null, phone: null, status: "NEW" },
  {
    name: "Анна Фёдорова",
    company: "ИП Фёдорова",
    email: "a.fedorova@bk.ru",
    phone: null,
    status: "ACTIVE",
  },
  {
    name: "Павел Смирнов",
    company: "ООО «СтройДом»",
    email: "p.smirnov@stroydom.ru",
    phone: "+7 900 999-00-11",
    status: "ACTIVE",
  },
  {
    name: "Юлия Лебедева",
    company: null,
    email: "y.lebedeva@gmail.com",
    phone: null,
    status: "NEW",
  },
];

const leads: DemoLead[] = [
  {
    title: "[DEMO] Автоматизация отчётов в 1С",
    message:
      "Нужен отчёт по продажам каждую пятницу, отправка в Telegram, интеграция с 1С:Бухгалтерия.",
    source: "сайт",
    status: "NEW",
    priority: "HIGH",
    category: "business_automation",
    intent: "request",
    customerType: "b2b",
  },
  {
    title: "[DEMO] Чат-бот для техподдержки",
    message:
      "Клиенты пишут в WhatsApp, бот должен отвечать на типовые вопросы и передавать сложные кейсы оператору.",
    source: "whatsapp",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    category: "ai_bot",
    intent: "request",
    customerType: "b2c",
  },
  {
    title: "[DEMO] CRM для агентства недвижимости",
    message: "Нужен учёт объектов, сделок и клиентов с уведомлениями о сделках.",
    source: "рекомендация",
    status: "QUALIFIED",
    priority: "MEDIUM",
    category: "crm_integration",
    intent: "request",
    customerType: "b2b",
  },
  {
    title: "[DEMO] Документооборот с подписями",
    message: "Электронная подпись, хранение договоров, уведомления об истечении срока.",
    source: "email",
    status: "WAITING",
    priority: "LOW",
    category: "document_flow",
    intent: "question",
    customerType: "b2g",
  },
  {
    title: "[DEMO] Веб-приложение для заказов",
    message: "Каталог товаров, корзина, оплате, уведомления о статусе заказа.",
    source: "сайт",
    status: "CONVERTED",
    priority: "URGENT",
    category: "web_app",
    intent: "request",
    customerType: "b2c",
  },
  {
    title: "[DEMO] Реклама и маркетинг",
    message: "Требуется аудит рекламных кампаний и рекомендации по оптимизации бюджета.",
    source: "реклама",
    status: "REJECTED",
    priority: "LOW",
    category: "other",
    intent: "info",
    customerType: "b2b",
  },
  {
    title: "Интеграция с телефонией",
    message: "Звонки должны записываться и создавать карточки клиента автоматически.",
    source: "телефон",
    status: "NEW",
    priority: "HIGH",
    category: "business_automation",
    intent: "request",
    customerType: "unknown",
  },
  {
    title: "Заявка на обучение",
    message: "Нужен тренинг по использованию CRM для сотрудников отдела продаж.",
    source: "email",
    status: "NEW",
    priority: "MEDIUM",
    category: "other",
    intent: "question",
    customerType: "b2b",
  },
  {
    title: "Улучшение скорости сайта",
    message: "Страницы загружаются медленно, нужна оптимизация и аудит производительности.",
    source: "сайт",
    status: "IN_PROGRESS",
    priority: "HIGH",
    category: "web_app",
    intent: "complaint",
    customerType: "unknown",
  },
  {
    title: "Мобильное приложение для курьеров",
    message: "Маршруты, статусы заказов, подтверждение доставки.",
    source: "рекомендация",
    status: "NEW",
    priority: "MEDIUM",
    category: "web_app",
    intent: "request",
    customerType: "b2c",
  },
  {
    title: "Аналитика продаж",
    message: "Дашборд по выручке, сравнение периодов, экспорт в Excel.",
    source: "email",
    status: "QUALIFIED",
    priority: "LOW",
    category: "business_automation",
    intent: "request",
    customerType: "b2b",
  },
  {
    title: "Обратная связь по продукту",
    message: "Клиенты жалуются на интерфейс личного кабинета, нужны улучшения UX.",
    source: "сайт",
    status: "WAITING",
    priority: "MEDIUM",
    category: "other",
    intent: "complaint",
    customerType: "b2c",
  },
  {
    title: "Интеграция с маркетплейсами",
    message: "Выгрузка товаров и приём заказов с маркетплейсов в одну систему.",
    source: "реклама",
    status: "NEW",
    priority: "HIGH",
    category: "crm_integration",
    intent: "request",
    customerType: "unknown",
  },
  {
    title: "Резервное копирование",
    message: "Автоматические бэкапы базы и файлов, проверка целостности еженедельно.",
    source: "email",
    status: "NEW",
    priority: "LOW",
    category: "document_flow",
    intent: "info",
    customerType: "b2g",
  },
  {
    title: "Консультация по ИТ",
    message: "Нужна оценка текущей инфраструктуры и рекомендации по развитию.",
    source: "сайт",
    status: "NEW",
    priority: "MEDIUM",
    category: "other",
    intent: "question",
    customerType: "b2b",
  },
  {
    title: "Обновление CMS",
    message: "Текущая версия устарела, нужен план обновления без простоя.",
    source: "email",
    status: "IN_PROGRESS",
    priority: "URGENT",
    category: "web_app",
    intent: "request",
    customerType: "b2c",
  },
  {
    title: "Интеграция с почтой",
    message: "Почтовые уведомления о статусах и синхронизация почтовых ящиков.",
    source: "сайт",
    status: "NEW",
    priority: "MEDIUM",
    category: "business_automation",
    intent: "request",
    customerType: "unknown",
  },
  {
    title: "Лояльность клиентов",
    message: "Бонусная программа и персональные предложения.",
    source: "рекомендация",
    status: "NEW",
    priority: "LOW",
    category: "crm_integration",
    intent: "info",
    customerType: "b2c",
  },
  {
    title: "Обновление документации",
    message: "Актуальная документация по API и инструкции для пользователей.",
    source: "email",
    status: "NEW",
    priority: "LOW",
    category: "document_flow",
    intent: "question",
    customerType: "b2b",
  },
  {
    title: "Технический аудит",
    message: "Полный аудит безопасности и производительности текущих систем.",
    source: "сайт",
    status: "NEW",
    priority: "HIGH",
    category: "other",
    intent: "request",
    customerType: "unknown",
  },
];

const tasks: DemoTask[] = [
  {
    title: "Позвонить клиенту по заявке на отчёт",
    description: "Уточнить детали интеграции с 1С.",
    status: "TODO",
    priority: "HIGH",
  },
  {
    title: "Подготовить презентацию для агентства",
    description: "Слайды по CRM и сделкам.",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
  },
  {
    title: "Настроить вебхуки Telegram",
    description: "Проверить доставку уведомлений.",
    status: "TODO",
    priority: "MEDIUM",
  },
  {
    title: "Сделать бэкап базы",
    description: "Проверить целостность после копирования.",
    status: "DONE",
    priority: "LOW",
  },
  {
    title: "Аудит скорости сайта",
    description: "Измерить Core Web Vitals.",
    status: "IN_PROGRESS",
    priority: "HIGH",
  },
  {
    title: "Отправить коммерческое предложение",
    description: "По заявке на маркетинг.",
    status: "CANCELLED",
    priority: "LOW",
  },
  {
    title: "Обновить документацию API",
    description: "Добавить примеры запросов.",
    status: "TODO",
    priority: "MEDIUM",
  },
  {
    title: "Связаться с маркетплейсом",
    description: "Уточнить условия выгрузки.",
    status: "TODO",
    priority: "HIGH",
  },
  {
    title: "Проверить почтовые уведомления",
    description: "Тестовая отправка на 5 ящиков.",
    status: "DONE",
    priority: "MEDIUM",
  },
  {
    title: "Обновление CMS",
    description: "Подготовить план обновления.",
    status: "IN_PROGRESS",
    priority: "URGENT",
  },
  {
    title: "Тренинг по CRM",
    description: "Запись сессии и материалы.",
    status: "TODO",
    priority: "LOW",
  },
  {
    title: "Аудит безопасности",
    description: "Проверка уязвимостей.",
    status: "TODO",
    priority: "HIGH",
  },
  {
    title: "Бонусная программа",
    description: "Разработка условий лояльности.",
    status: "TODO",
    priority: "LOW",
  },
  {
    title: "Поддержка клиента",
    description: "Передать сложный кейс оператору.",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
  },
  {
    title: "Резервное копирование файлов",
    description: "Проверка папки вложений.",
    status: "DONE",
    priority: "LOW",
  },
];

async function main() {
  await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    update: {},
    create: { name: WORKSPACE_NAME, slug: WORKSPACE_SLUG },
  });

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { slug: WORKSPACE_SLUG },
  });

  const userDefs = [
    ["ADMIN", "Администратор Системы", "admin@demo.local"] as const,
    ["MANAGER", "Менеджер Проектов", "manager@demo.local"] as const,
    ["OPERATOR", "Оператор Отдела", "operator@demo.local"] as const,
  ];

  const users: Array<{ id: string; role: Role; email: string }> = [];
  for (const [role, name, email] of userDefs) {
    const roleEnum = role as Role;
    const user = await prisma.user.upsert({
      where: { workspaceId_email: { workspaceId: workspace.id, email } },
      update: { passwordHash, name, role: roleEnum },
      create: { name, email, passwordHash, role: roleEnum, workspaceId: workspace.id },
    });
    users.push({ id: user.id, role: roleEnum, email });
  }

  const [admin, manager, operator] = users;
  const creatorByIndex = (i: number) => (i % 3 === 0 ? admin : i % 3 === 1 ? manager : operator)!;
  const assigneeByIndex = (i: number) => (i % 3 === 0 ? admin : i % 3 === 1 ? manager : operator)!;

  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i]!;
    const creator = creatorByIndex(i);
    const existing = await prisma.contact.findFirst({
      where: { workspaceId: workspace.id, name: c.name },
      select: { id: true },
    });

    if (existing) {
      continue;
    }

    await prisma.contact.create({
      data: {
        name: c.name,
        company: c.company,
        email: c.email,
        phone: c.phone,
        status: c.status as import("@prisma/client").ContactStatus,
        workspaceId: workspace.id,
        createdById: creator.id,
        updatedById: creator.id,
      },
    });
  }

  const createdContacts = await prisma.contact.findMany({
    where: { workspaceId: workspace.id },
    take: 5,
    orderBy: { createdAt: "asc" },
  });

  for (let i = 0; i < leads.length; i++) {
    const l = leads[i]!;
    const creator = creatorByIndex(i);
    const contactId = i < createdContacts.length ? createdContacts[i]!.id : undefined;
    const title = withDemoPrefix(l.title);
    const existing = await prisma.lead.findFirst({
      where: { workspaceId: workspace.id, title: { in: [title, withoutDemoPrefix(title)] } },
      select: { id: true, title: true },
    });

    if (existing) {
      // Upgrade rows created by earlier seed versions without the `[DEMO]` prefix.
      if (existing.title !== title) {
        await prisma.lead.update({ where: { id: existing.id }, data: { title } });
      }
      continue;
    }

    await prisma.lead.create({
      data: {
        title,
        message: l.message,
        source: l.source,
        status: l.status as import("@prisma/client").LeadStatus,
        priority: l.priority as import("@prisma/client").Priority,
        category: l.category as import("@prisma/client").LeadCategory | null,
        intent: l.intent as import("@prisma/client").LeadIntent | null,
        customerType: l.customerType as import("@prisma/client").CustomerType | null,
        contactId,
        assignedToId: assigneeByIndex(i)!.id,
        workspaceId: workspace.id,
        createdById: creator.id,
        updatedById: creator.id,
      },
    });
  }

  const createdLeads = await prisma.lead.findMany({
    where: { workspaceId: workspace.id },
    take: tasks.length,
    orderBy: { createdAt: "asc" },
  });

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i]!;
    const creator = creatorByIndex(i);
    const leadId = i < createdLeads.length ? createdLeads[i]!.id : undefined;
    const title = withDemoPrefix(t.title);
    const existing = await prisma.task.findFirst({
      where: { workspaceId: workspace.id, title: { in: [title, withoutDemoPrefix(title)] } },
      select: { id: true, title: true },
    });

    if (existing) {
      if (existing.title !== title) {
        await prisma.task.update({ where: { id: existing.id }, data: { title } });
      }
      continue;
    }

    await prisma.task.create({
      data: {
        title,
        description: t.description,
        status: t.status as import("@prisma/client").TaskStatus,
        priority: t.priority as import("@prisma/client").Priority,
        leadId,
        assignedToId: assigneeByIndex(i)!.id,
        workspaceId: workspace.id,
        createdById: creator.id,
        updatedById: creator.id,
      },
    });
  }

  for (const type of ["n8n", "telegram"] as const) {
    await prisma.integration.upsert({
      where: { workspaceId_type: { workspaceId: workspace.id, type } },
      update: {},
      create: {
        workspaceId: workspace.id,
        type,
        name: type === "n8n" ? "n8n Automation" : "Telegram Bot",
        status: "NOT_CONFIGURED",
      },
    });
  }

  console.log("Seed completed: workspace, 3 users, contacts, leads, tasks, integrations");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
