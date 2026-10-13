import { redirect } from "next/navigation";
import Studio from "@/components/studio";
import { authorized } from "@/lib/session";

export const dynamic = "force-dynamic";
export default async function Page() {
  if (!(await authorized())) redirect("/login");
  return <Studio />;
}
