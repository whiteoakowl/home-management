import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/ui/display";
import { ButtonLink } from "@/components/ui/button";

/** Missing (or not-for-you) help topic or article. */
export default function HelpNotFound() {
  return (
    <div className="mx-auto w-full max-w-xl">
      <EmptyState
        icon={<FileQuestion />}
        title="We couldn't find that help article"
        description="It may have moved, or it's about a section that isn't turned on for you."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/help">Search help</ButtonLink>
            <Link href="/feedback" className="inline-flex h-11 items-center px-3 text-[15px] font-medium text-primary-700 hover:underline">
              Contact support
            </Link>
          </div>
        }
      />
    </div>
  );
}
