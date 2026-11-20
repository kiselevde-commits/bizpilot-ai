import { describe, expect, it } from "vitest";
import { filterExtractedContacts } from "@/lib/ai/contacts";
import type { ExtractedContacts } from "@/lib/ai/schema";

describe("filterExtractedContacts", () => {
  it("оставляет только контакты, реально упомянутые в тексте заявки", () => {
    const source = "Нужна интеграция. Контакт: Иван Иванов, ivan@example.com, +7 999 000-11-22.";

    const extracted: ExtractedContacts = {
      name: "Иван Иванов",
      company: "ООО Ромашка",
      email: "ivan@example.com",
      phone: "+79990001122",
    };

    const result = filterExtractedContacts(source, extracted);

    expect(result.name).toBe("Иван Иванов");
    expect(result.email).toBe("ivan@example.com");
    expect(result.phone).toBe("+79990001122");
    expect(result.company).toBeNull();
  });

  it("отбрасывает выдуманные (hallucinated) контакты", () => {
    const source = "Заявка на автоматизацию процессов без контактов.";

    const extracted: ExtractedContacts = {
      name: "Мария Петрова",
      company: "Бухгалтерия Мель",
      email: "maria@hallucinated.example",
      phone: "+79991112233",
    };

    const result = filterExtractedContacts(source, extracted);

    expect(result.name).toBeNull();
    expect(result.company).toBeNull();
    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
  });

  it("оставляет phone, записанный в другом формате, но с теми же цифрами", () => {
    const source = "Контакт: +7 (999) 000-11-22";

    const result = filterExtractedContacts(source, {
      name: null,
      company: null,
      email: null,
      phone: "+79990001122",
    });

    expect(result.phone).toBe("+79990001122");
  });

  it("отбрасывает phone, цифровая последовательность которого не совпадает с текстом", () => {
    const source = "Контакт: +7 999 000-11-22";

    const result = filterExtractedContacts(source, {
      name: null,
      company: null,
      email: null,
      phone: "+79990001123",
    });

    expect(result.phone).toBeNull();
  });

  it("находит phone, даже если в тексте есть другие числа", () => {
    const source = "Бюджет 300 000 руб., срок 2 недели. Контакт: Иван Иванов, +7 999 000-11-22.";

    const result = filterExtractedContacts(source, {
      name: "Иван Иванов",
      company: null,
      email: null,
      phone: "+79990001122",
    });

    expect(result.name).toBe("Иван Иванов");
    expect(result.phone).toBe("+79990001122");
  });

  it("обнуляет пустые и null значения", () => {
    const result = filterExtractedContacts("Текст заявки", {
      name: "  ",
      company: null,
      email: "",
      phone: null,
    });

    expect(result.name).toBeNull();
    expect(result.company).toBeNull();
    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
  });

  it("возвращает пустые контакты, если исходный текст пуст", () => {
    const result = filterExtractedContacts("", {
      name: "Иван",
      company: null,
      email: null,
      phone: null,
    });

    expect(result.name).toBeNull();
    expect(result.company).toBeNull();
    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
  });

  it("возвращает пустые контакты, если extracted не передан", () => {
    const result = filterExtractedContacts("Текст заявки", undefined);

    expect(result.name).toBeNull();
    expect(result.company).toBeNull();
    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
  });
});
