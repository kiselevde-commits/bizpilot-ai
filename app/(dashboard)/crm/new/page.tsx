import { ContactForm } from "@/components/contacts/contact-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function ContactsNewPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="New contact"
        title="Новый контакт"
        description="Добавьте клиента в CRM, чтобы связывать его с заявками и задачами."
      />
      <ContactForm mode="create" />
    </div>
  );
}
