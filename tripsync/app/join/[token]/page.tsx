// app/join/[token]/page.tsx
import { use } from "react";
import JoinClient from "./JoinClient";

export default function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  // Next 15+ passes params as a Promise — unwrap it:
  const { token } = use(params);
  return <JoinClient token={token} />;
}