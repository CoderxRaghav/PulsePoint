import { Suspense } from "react";
import { TeamDetails } from "@/components/teams/team-details";

interface TeamPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}

export default function TeamPage(props: TeamPageProps) {
  return (
    <Suspense fallback={<div role="status" className="min-h-screen bg-space-black px-4 py-16 text-center text-sm text-warm-white-muted">Loading team…</div>}>
      <TeamPageContent {...props} />
    </Suspense>
  );
}

async function TeamPageContent({
  params,
  searchParams,
}: TeamPageProps) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  return <TeamDetails teamId={id} created={search.created === "1"} />;
}
