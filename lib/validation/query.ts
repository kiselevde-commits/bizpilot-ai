import { z } from "zod";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).default(""),
  sort: z.string().trim().max(100).default("createdAt:desc"),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export type SortDirection = "asc" | "desc";

export type SortSpec<TField extends string> = {
  field: TField;
  direction: SortDirection;
};

export function parseSort<TField extends string>(
  value: string,
  allowedFields: readonly TField[],
  fallback: SortSpec<TField>,
): SortSpec<TField> {
  const parts = value.split(":");

  if (parts.length !== 2) {
    return fallback;
  }

  const field = parts[0];
  const direction = parts[1];

  if (!field || !direction) {
    return fallback;
  }

  if (direction !== "asc" && direction !== "desc") {
    return fallback;
  }

  if (!allowedFields.includes(field as TField)) {
    return fallback;
  }

  return { field: field as TField, direction };
}
