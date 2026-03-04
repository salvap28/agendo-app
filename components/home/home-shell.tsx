export function HomeShell() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-6 px-6 py-16 sm:px-10">
      <p className="text-sm font-medium text-muted-foreground">
        Agendo 0.2 • Productivity Suite
      </p>
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
        Planifica tu dia con foco y una experiencia premium.
      </h1>
      <p className="max-w-2xl text-lg text-muted-foreground">
        Base inicial lista para construir Home con Next.js App Router, Tailwind
        v4 y shadcn/ui.
      </p>
      <div className="inline-flex w-fit rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">
        Setup compilando y listo para componentes
      </div>
    </main>
  );
}
