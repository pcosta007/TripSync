// app/(protected)/events/[eventId]/activities/[activityId]/page.tsx
import { use } from "react";
import type { Metadata } from "next";
import ActivityClient from "./ActivityClient";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage({
  params,
}: {
  params: Promise<{ eventId: string; activityId: string }>;
}) {
  // Unwrap the promised route params (Next.js App Router)
  const { eventId, activityId } = use(params);

  return <ActivityClient eventId={eventId} activityId={activityId} />;
}