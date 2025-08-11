// app/(protected)/events/[eventId]/page.tsx
import type { Metadata } from "next";
import { use } from "react";
import EventOverviewClient from "./EventOverviewClient";

export const metadata: Metadata = { title: "Event" };

export default function EventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  return <EventOverviewClient eventId={eventId} />;
}