import { LeadForm } from "@/components/leads/lead-form";
import { PageHeader } from "@/components/layout/page-header";

export default async function LeadsNewPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Новая заявка"
        description="Создайте новую заявку для обработки"
      />
      <LeadForm mode="create" />
    </div>
  );
}
