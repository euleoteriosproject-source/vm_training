import Link from "next/link";
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-10 block text-center text-2xl font-bold">
          <span className="text-accent">VM</span>
          <br />
          <span className="text-sm font-medium uppercase tracking-[.3em] text-muted">
            Training
          </span>
        </Link>
        {children}
      </div>
    </main>
  );
}
