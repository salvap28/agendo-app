import { LoginForm } from "./LoginForm";
import { getServerLanguage, getServerMessages } from "@/lib/i18n/server";

const STARS = Array.from({ length: 7 }, (_, index) => {
    const size = 1 + ((index * 19) % 5) * 0.15;

    return {
        id: index,
        size,
        top: `${8 + ((index * 23) % 84)}%`,
        left: `${6 + ((index * 17) % 88)}%`,
        opacity: 0.06 + (((index * 13) % 12) / 100),
        delay: `${(index % 7) * 1.1}s`,
        duration: `${12 + (index % 4) * 4}s`,
    };
});

export default async function LoginPage(
    props: { searchParams: Promise<{ error?: string; verified?: string }> }
) {
    const searchParams = await props.searchParams;
    const language = await getServerLanguage();
    const t = await getServerMessages();
    const success =
        searchParams.verified === "1"
            ? t.login.successVerified
            : undefined;

    return (
        <div className="relative isolate min-h-[100dvh] overflow-hidden bg-[#04030a] text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_44%,_rgba(118,94,220,0.10),_transparent_22%),radial-gradient(circle_at_50%_50%,_rgba(70,53,130,0.10),_transparent_36%),linear-gradient(180deg,_#07060c_0%,_#050409_50%,_#030208_100%)]" />
            <div
                aria-hidden="true"
                className="absolute inset-0 opacity-[0.014]"
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
                            opacity: star.opacity * 0.35,
                            boxShadow: "0 0 10px rgba(255,255,255,0.08)",
                            animation: `agendoStarPulse ${star.duration} ease-in-out ${star.delay} infinite`,
                        }}
                    />
                ))}
            </div>

            <div
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 h-[42rem] w-[42rem] -translate-x-[5%] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,_rgba(136,112,232,0.09)_0%,_rgba(92,70,172,0.06)_26%,_rgba(26,18,47,0)_65%)] blur-[140px] motion-safe:animate-[agendoNebulaFloat_26s_ease-in-out_infinite] motion-reduce:animate-none"
            />

            <main className="relative z-10 mx-auto grid min-h-[100dvh] max-w-[1320px] items-center gap-12 px-6 py-8 sm:px-8 md:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(400px,500px)] lg:gap-16 lg:px-16 lg:py-10 xl:px-20">
                <section className="flex flex-col justify-center lg:pr-12">
                    <div className="max-w-[28rem] space-y-8">
                        <div className="space-y-5">
                            <h1 className="text-[clamp(2.6rem,5.2vw,3.9rem)] font-[460] leading-[0.96] tracking-[-0.04em] text-white/90">
                                {t.login.headline}
                            </h1>
                            <p className="max-w-[24rem] text-[0.96rem] leading-[1.7] tracking-[-0.01em] text-white/46 sm:text-[1rem]">
                                {t.login.subheadline}
                            </p>
                        </div>
                    </div>
                </section>

                <section className="relative flex items-center justify-center lg:justify-end">
                    <div className="group/login-scene relative w-full max-w-[31rem]">
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 flex items-center justify-center"
                        >
                            <div className="relative h-[22rem] w-[22rem] max-w-[90vw] rounded-full motion-reduce:animate-none">
                                <div className="absolute inset-[8%] rounded-full border border-white/[0.04] opacity-25 transition-all duration-700 group-focus-within/login-scene:opacity-35 motion-safe:animate-[agendoHaloBreath_24s_ease-in-out_infinite]" />
                                <div className="absolute inset-[20%] rounded-full bg-[radial-gradient(circle,_rgba(181,164,255,0.08)_0%,_rgba(100,75,185,0.05)_34%,_rgba(15,10,30,0)_68%)] opacity-50 blur-[80px] transition-all duration-700 group-focus-within/login-scene:scale-[1.02] group-focus-within/login-scene:opacity-65" />
                            </div>
                        </div>

                        <div className="relative">
                            <LoginForm error={searchParams.error} success={success} language={language} />
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
