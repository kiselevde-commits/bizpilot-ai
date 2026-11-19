import "server-only";
import { getContact } from "@/services/contact.service";
import { requireUser } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/contacts/contact-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function ContactsEditPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const user = await requireUser();

  const contact = await getContact(user, id);

  if (!contact) {
    notFound();
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Редактировать контакт"
        description={contact.name}
        actions={
          <div className="flex items-center gap-2">
            <a
              href={`/crm/${contact.id}`}
              className="text-sm text-primary hover:underline"
            >
              Назад к контакту
            </a>
          </div>
        }
      />
      <ContactForm
        mode="edit"
        contactId={contact.id}
        initialData={{
          name: contact.name,
          company: contact.company,
          email: contact.email,
          phone: contact.phone,
          notes: contact.notes,
          status: contact.status,
        }}
      />
    </div>
  );
}
