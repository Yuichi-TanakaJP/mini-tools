import type { Metadata } from "next";
import Client from "./Client";

export const metadata: Metadata = {
  title: "EDINET identity 1件限定UAT | mini-tools",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <Client />;
}
