"use client";
import React from "react";

type Props = {
  header: React.ReactNode;
  list: React.ReactNode;
  footer?: React.ReactNode;
};

export default function MobileLayout({ header, list, footer }: Props) {
  return (
    <div>
      <div>{header}</div>
      <div>{list}</div>
      {footer && <div>{footer}</div>}
    </div>
  );
}
  