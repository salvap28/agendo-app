import { LoginForm } from "./LoginForm";

const STARS = Array.from({ length: 10 }, (_, index) => {
    const size = 1 + ((index * 19) % 7) * 0.18;

    return {
        id: index,
        size,
        top: `${6 + ((index * 23) % 88)}%`,
        left: `${4 + ((index * 17) % 92)}%`,
        opacity: 0.1 + (((index * 13) % 16) / 100),
        delay: `${(index % 9) * 0.9}s`,
        duration: `${10 + (index % 5) * 3}s`,
    };
});

export default async function LoginPage(
    props: { searchParams: Promise<{ error?: string; verified?: string }> }
) {
    const searchParams = await props.searchParams;
    const success =
        searchParams.verified === "1"
            ? "Email confirmado. Ya podés entrar a tu sistema."
            : undefined;

    return (
        <div
            className="relative isolate min-h-[100dvh] overflow-hidden bg-[#04030a] text-white"
        >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_46%,_rgba(118,94,220,0.16),_transparent_20%),radial-gradient(circle_at_52%_48%,_rgba(70,53,130,0.16),_transparent_34%),linear-gradient(180deg,_#08070d_0%,_#05040a_50%,_#030208_100%)]" />
            <div
                aria-hidden="true"
                className="absolute inset-0 opacity-[0.022]"
                style={{
                    backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
                    backgroundSize: "280px 280px",
                }}
            />

            <div aria-hidden="true" className="absolute inset-0">
                {STARS.map((star) => (
                    <span
                        key={star.id}
                        className="absolute rounded-full bg-white motion-reduce:animate-none"
                        style={{
                            width: `${star.size}px`,
                            height: `${star.size}px`,
                            top: star.top,
                            left: star.left,
                            opacity: star.opacity * 0.45,
                            boxShadow: "0 0 14px rgba(255,255,255,0.12)",
                            animation: `agendoStarPulse ${star.duration} ease-in-out ${star.delay} infinite`,
                        }}
                    />
                ))}
            </div>

            <div
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 h-[46rem] w-[46rem] -translate-x-[3%] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,_rgba(136,112,232,0.13)_0%,_rgba(92,70,172,0.09)_24%,_rgba(26,18,47,0)_68%)] blur-[120px] motion-safe:animate-[agendoNebulaFloat_22s_ease-in-out_infinite] motion-reduce:animate-none"
            />

            <main className="relative z-10 mx-auto grid min-h-[100dvh] max-w-[1380px] items-center gap-18 px-6 py-8 sm:px-8 md:px-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,540px)] lg:px-16 lg:py-10 xl:px-20">
                <section className="flex flex-col justify-center gap-16 lg:pr-16">
                    <div className="max-w-[31rem] space-y-9">
                        <div className="space-y-7">
                            <h1
                                className="max-w-[10ch] text-[clamp(3rem,6.4vw,4.75rem)] font-medium leading-[0.94] tracking-[-0.055em] text-white/94"
                            >
                                Organizá menos. Viví con más intención.
                            </h1>
                            <p className="max-w-[24rem] text-[1rem] leading-7 tracking-[-0.015em] text-white/52 sm:text-[1.04rem]">
                                Agendo convierte tu tiempo en dirección, foco y claridad.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="relative flex items-center justify-center lg:justify-end">
                    <div className="group/login-scene relative w-full max-w-[34rem]">
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 flex items-center justify-center"
                        >
                            <div className="relative h-[25rem] w-[25rem] max-w-[90vw] rounded-full motion-reduce:animate-none">
                                <div className="absolute inset-[7%] rounded-full border border-white/6 opacity-30 transition-all duration-700 group-focus-within/login-scene:opacity-40 motion-safe:animate-[agendoHaloBreath_20s_ease-in-out_infinite]" />
                                <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle,_rgba(181,164,255,0.11)_0%,_rgba(100,75,185,0.07)_32%,_rgba(15,10,30,0)_70%)] opacity-58 blur-[72px] transition-all duration-700 group-focus-within/login-scene:scale-[1.03] group-focus-within/login-scene:opacity-72" />
                            </div>
                        </div>

                        <div className="relative">
                            <LoginForm error={searchParams.error} success={success} />
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
