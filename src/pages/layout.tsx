import React from "react";

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex mt-8 mb-8 px-2 gap-6 xl:gap-8">
      <main className="min-w-0 flex-1 w-full">{children}</main>
    </div>
  );
}
