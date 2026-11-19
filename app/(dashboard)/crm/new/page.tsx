import { ContactForm } from "@/components/contacts/contact-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function ContactsNewPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Новый контакт"
        description="Добавьте новый контакт в CRM"
      />
      <ContactForm mode="create" />
    </div>
  );
}
