import Link from "next/link";
import { SERVICE_NAME } from "@/lib/constants";

export function AppHeader() {
  return (
    <header className="mb-3">
      <Link href="/" className="text-lg font-extrabold tracking-tight text-primary">
        {SERVICE_NAME}
      </Link>
    </header>
  );
}
