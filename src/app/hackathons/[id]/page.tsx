import { Suspense } from "react";
import HackathonDetailClient from "./hackathon-detail-client";

export default function HackathonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070709] text-white flex flex-col justify-center items-center">
          <div className="w-10 h-10 rounded-full border-2 border-rose-500 border-t-transparent animate-spin mb-4" />
          <p className="text-xs text-neutral-400">Loading hackathon details...</p>
        </div>
      }
    >
      <HackathonDetailClient params={params} />
    </Suspense>
  );
}
