import { rmSync } from "node:fs";
import { envFilePath } from "./global-setup";

export default function globalTeardown(): void {
  rmSync(envFilePath(), { force: true });
}
