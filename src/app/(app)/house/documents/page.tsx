import { redirect } from "next/navigation";

/** Moved to Home Maintenance (one home for these records, no duplicates). */
export default function Moved() {
  redirect("/maintenance/documents");
}
