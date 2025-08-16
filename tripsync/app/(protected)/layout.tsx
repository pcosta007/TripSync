// app/(protected)/layout.tsx
import "./protected.css";
import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "TripSync",
  themeColor: "#264864",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TripSync",
  },
};

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}