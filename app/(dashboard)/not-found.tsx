import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-xl font-semibold">Страница или запись не найдена</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Возможно, запись была удалена или относится к другому рабочему пространству.
      </p>
      <Link href="/dashboard">
        <Button>На дашборд</Button>
      </Link>
    </div>
  );
}
