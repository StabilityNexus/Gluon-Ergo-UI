/**
 * @file 404.tsx
 * @description Custom 404 page for static export.
 * Next.js static export writes this to out/404.html and out/404/index.html
 * and GitHub Pages serves it for any unmatched path.
 * @module pages
 */
import Link from "next/link";
import { SEO } from "@/lib/components/layout/SEO";

export default function NotFound() {
  return (
    <>
      <SEO title="Page Not Found | Gluon" description="The page you are looking for does not exist." noPageUrl />
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="text-muted-foreground">Page not found.</p>
        <Link href="/" className="underline underline-offset-4">
          Go home
        </Link>
      </main>
    </>
  );
}
