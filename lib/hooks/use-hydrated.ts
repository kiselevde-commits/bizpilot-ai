"use client";

import { useEffect, useState } from "react";
/**
 * Returns `false` on the server and during the first client render, then
 * `true` once the component has been hydrated.
 *
 * Forms use it to keep their submit button disabled until React is attached.
 * Without this guard a click that lands before hydration falls through to the
 * browser's native form submission: `GET <current-url>?<all-field-values>`,
 * which sends passwords, emails and phone numbers into the URL, browser
 * history and server access logs, and silently does nothing useful.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}
