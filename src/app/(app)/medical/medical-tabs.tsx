import { LinkTabs } from "@/components/ui/tabs";

export const MEDICAL_TABS = [
  { key: "overview", href: "/medical", label: "Dashboard" },
  { key: "members", href: "/medical/members", label: "Family members" },
  { key: "allergy", href: "/medical/allergies", label: "Allergies" },
  { key: "restriction", href: "/medical/diet", label: "Food restrictions" },
  { key: "condition", href: "/medical/conditions", label: "Conditions" },
  { key: "medication", href: "/medical/medications", label: "Medications" },
  { key: "document", href: "/medical/documents", label: "Documents" },
  { key: "calendar", href: "/medical/calendar", label: "Medical calendar" },
];

export function MedicalTabs({ active }: { active: string }) {
  return <LinkTabs tabs={MEDICAL_TABS} active={active} />;
}

export function MedicalDisclaimer() {
  return (
    <p className="mt-8 rounded-xl bg-sunken px-4 py-3 text-xs text-muted">
      This is a family record-keeping tool, not medical advice. It never diagnoses, recommends treatment or suggests doses. Always follow your physician&apos;s instructions, and call
      emergency services in an emergency.
    </p>
  );
}
