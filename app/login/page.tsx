import { LoginForm } from "./LoginForm";

export default async function LoginPage(
    props: { searchParams: Promise<{ error?: string }> }
) {
    const searchParams = await props.searchParams;

    return (
        <div
            className="relative flex min-h-[100dvh] flex-col items-center justify-center p-6"
            style={{ background: "#020205" }}
        >
            {/* ── Deep gradient background ── */}
            <div
                className="pointer-events-none fixed inset-0 z-0"
                aria-hidden="true"
                style={{
                    background:
                        "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(124,58,237,0.18) 0%, transparent 70%)",
                }}
            />
            {/* ── Subtle noise/grain overlay ── */}
            <div
                className="pointer-events-none fixed inset-0 z-0 opacity-[0.025]"
                aria-hidden="true"
                style={{
                    backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
                    backgroundSize: "200px 200px",
                }}
            />

            {/* ── Stars decoration ── */}
            <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
                {[...Array(28)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute rounded-full bg-white"
                        style={{
                            width: `${Math.random() * 1.5 + 0.5}px`,
                            height: `${Math.random() * 1.5 + 0.5}px`,
                            top: `${Math.random() * 100}%`,
                            left: `${Math.random() * 100}%`,
                            opacity: Math.random() * 0.3 + 0.05,
                        }}
                    />
                ))}
            </div>

            {/* ── Content ── */}
            <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-8">
                {/* Agendo wordmark */}
                <div className="flex flex-col items-center gap-2">
                    <span
                        className="text-2xl font-light tracking-[0.25em] text-white/90 select-none"
                        style={{ fontFamily: "var(--font-geist-sans)" }}
                    >
                        AGENDO
                    </span>
                    <div className="h-px w-12" style={{ background: "rgba(139,92,246,0.5)" }} />
                </div>

                {/* Glass Card */}
                <LoginForm error={searchParams.error} />

                {/* Footer */}
                <p
                    className="text-center text-xs leading-relaxed"
                    style={{ color: "rgba(255,255,255,0.2)" }}
                >
                    By continuing, you agree to Agendo&apos;s{" "}
                    <span style={{ color: "rgba(167,139,250,0.5)" }}>Terms of Service</span>.
                </p>
            </div>
        </div>
    );
}
