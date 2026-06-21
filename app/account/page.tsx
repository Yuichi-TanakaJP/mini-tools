import type { Metadata } from "next";
import AccountClient from "./AccountClient";

export const metadata: Metadata = {
  title: "アカウント・同期 | mini-tools",
  description:
    "メールでログインすると、対応ツールのデータを端末間で同期できます（任意）。未ログインなら従来どおり端末内のみで動きます。",
  alternates: {
    canonical: "/account",
  },
};

export default function Page() {
  return <AccountClient />;
}
