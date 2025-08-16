"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { getInviteForEvent, joinEventWithToken } from "@/lib/events";

type Status = "checking-auth" | "loading-invite" | "joining" | "done" | "error";

export default function JoinClient({ token }: { token: string }) {
  const search = useSearchParams();
  const eventId = search.get("e"); // we added ?e=EVENT_ID to the link

  const [status, setStatus] = useState<Status>("checking-auth");
  const [message, setMessage] = useState("");
  const [inviteInfo, setInviteInfo] = useState<
    | null
    | { eventId: string; role: "editor" | "viewer"; status: "pending" | "accepted" | "expired" }
  >(null);

  useEffect(() => {
    const off = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        const next = encodeURIComponent(`/join/${token}${eventId ? `?e=${eventId}` : ""}`);
        window.location.href = `/login?next=${next}`;
        return;
      }

      if (!eventId) {
        setStatus("error");
        setMessage("Invite link is missing the event id.");
        return;
      }

      try {
        setStatus("loading-invite");
        const found = await getInviteForEvent(eventId, token);
        if (!found) {
          setStatus("error");
          setMessage("This invite link is invalid or has been deleted.");
          return;
        }
        setInviteInfo(found);
        if (found.status !== "pending") {
          setStatus("error");
          setMessage(`This invite is ${found.status}.`);
          return;
        }

        setStatus("joining");
        const res = await joinEventWithToken({ eventId, token, uid: u.uid });
        setStatus("done");
        window.location.href = `/events/${res.eventId}`;
      } catch (e: any) {
        const code = e?.code ? `(${e.code}) ` : "";
        setMessage(`${code}${e?.message || "Could not join with this invite."}`);
        setStatus("error");
      }
    });
    return () => off();
  }, [token, eventId]);

  return (
    <main className="mx-auto max-w-[402px] min-h-[100dvh] bg-[#fafafa] p-4">
      <header className="sticky top-0 z-10 bg-white border-b border-[#e2e8f0] -m-4 mb-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[#264864] font-semibold">FitList</span>
          <span className="text-sm text-[#64748b]">Join</span>
        </div>
      </header>

      {status === "checking-auth" && (
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-4">Checking your session…</div>
      )}

      {status === "loading-invite" && (
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-4">Validating your invite…</div>
      )}

      {status === "joining" && (
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-4">
          Joining event…
          {inviteInfo && (
            <div className="text-xs text-[#64748b] mt-1">
              Event: <code>{inviteInfo.eventId}</code> • Role: <code>{inviteInfo.role}</code>
            </div>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-4">
          <div className="font-semibold mb-1">Invite problem</div>
          <div className="text-sm text-[#64748b] whitespace-pre-wrap">{message}</div>
          {inviteInfo && (
            <div className="text-xs text-[#94a3b8] mt-2">
              Invite details — eventId: <code>{inviteInfo.eventId}</code>, role:{" "}
              <code>{inviteInfo.role}</code>, status: <code>{inviteInfo.status}</code>
            </div>
          )}
        </div>
      )}
    </main>
  );
}