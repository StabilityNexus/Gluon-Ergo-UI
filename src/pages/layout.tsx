import React from "react";

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 flex gap-6 xl:gap-8">
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
