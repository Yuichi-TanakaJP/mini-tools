import type { Metadata } from "next";
import ResetPasswordClient from "./ResetPasswordClient";

export const metadata: Metadata = {
  title: "新しいパスワードを設定 | mini-tools",
  description: "パスワードリセットメールのリンクから、新しいパスワードを設定します。",
  robots: { index: false, follow: false },
  alternates: {
    canonical: "/account/reset-password",
  },
};

export default function Page() {
  return <ResetPasswordClient />;
}
