// app/(protected)/events/[eventId]/activities/[activityId]/page.tsx
import type { Metadata } from "next";
import ActivityClient from "./ActivityClient";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage({
  params,
}: {
  params: { eventId: string; activityId: string };
}) {
  const { eventId, activityId } = params;

  return (
    <ActivityClient eventId={eventId} activityId={activityId} />
  );
}