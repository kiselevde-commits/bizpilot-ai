import "server-only";
import { getContact } from "@/services/contact.service";
import { requireUser } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Edit contact"
        title="Редактировать контакт"
        description={contact.name}
        actions={
          <Link
            href={`/crm/${contact.id}`}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Назад к контакту
          </Link>
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
