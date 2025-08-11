// app/join/[token]/page.tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
// You’ll write this helper next:
import { acceptInviteByToken } from "@/lib/invites";

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { token } = params;

  // This is a Server Component; for simple flow we can render a thin client wrapper instead:
  // But here's a pragmatic server→client bridge using a redirect step:
  return (
    <div className="mx-auto max-w-[402px] p-4 min-h-[100dvh] bg-[#fafafa]">
      <h1 className="text-base font-semibold mb-2">Joining…</h1>
      <JoinClient token={token} />
    </div>
  );
}

// Client bit to handle auth state then call accept
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

function JoinClient({ token }: { token: string }) {
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(`/join/${token}`)}`);
        return;
      }
      try {
        const eventId = await acceptInviteByToken(token, user.uid);
        router.replace(`/events/${eventId}`);
      } catch (e) {
        console.error(e);
        router.replace(`/`);
      }
    });
    return () => unsub();
  }, [router, token]);

  return (
    <p className="text-sm text-[#64748b]">
      If nothing happens, you may need to log in…
    </p>
  );
}