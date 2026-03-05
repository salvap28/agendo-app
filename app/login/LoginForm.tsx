"use client";

import { useTransition, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Eye, EyeOff } from "lucide-react";
import { login, signup } from "./actions";
import { GlowingEffect } from "@/components/ui/glowing-effect";

type Tab = "signin" | "signup";

// ── Tab Switcher ──────────────────────────────────────────────────────────────
function TabSwitcher({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
    return (
        <div
            className="flex rounded-2xl p-1"
            style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
            }}
        >
            {(["signin", "signup"] as Tab[]).map((tab) => {
                const isActive = active === tab;
                return (
                    <motion.button
                        key={tab}
                        type="button"
                        onClick={() => onChange(tab)}
                        whileTap={{ scale: 0.96 }}
                        transition={{ duration: 0.12, ease: [0.4, 0, 0.2, 1] }}
                        className="relative flex-1 py-2.5 text-sm font-medium rounded-xl z-10 outline-none flex items-center justify-center gap-1.5"
                        style={{
                            color: isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.28)",
                            transition: "color 0.25s ease",
                        }}
                        onMouseEnter={(e) => {
                            if (!isActive) e.currentTarget.style.color = "rgba(255,255,255,0.55)";
                        }}
                        onMouseLeave={(e) => {
                            if (!isActive) e.currentTarget.style.color = "rgba(255,255,255,0.28)";
                        }}
                    >
                        {/* Animated active pill */}
                        {isActive && (
                            <motion.div
                                layoutId="tab-bg"
                                className="absolute inset-0 rounded-xl"
                                style={{
                                    background: "linear-gradient(135deg, rgba(109,40,217,0.35) 0%, rgba(79,70,229,0.25) 100%)",
                                    border: "1px solid rgba(139,92,246,0.25)",
                                    boxShadow: "0 0 12px rgba(109,40,217,0.2), inset 0 1px 0 rgba(255,255,255,0.08)",
                                }}
                                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                            />
                        )}

                        {/* Active indicator dot */}
                        {isActive && (
                            <motion.span
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.2, delay: 0.05, ease: "easeOut" }}
                                className="relative z-10 w-1 h-1 rounded-full"
                                style={{ background: "rgba(167,139,250,0.9)", boxShadow: "0 0 4px rgba(167,139,250,0.6)" }}
                            />
                        )}

                        <span className="relative z-10">
                            {tab === "signin" ? "Sign in" : "Sign up"}
                        </span>
                    </motion.button>
                );
            })}
        </div>
    );
}

function AuthInput({ id, name, type, placeholder, autoComplete, maxLength }: {
    id: string; name: string; type: string; placeholder: string; autoComplete?: string; maxLength?: number;
}) {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    const inputType = isPassword ? (showPassword ? "text" : "password") : type;

    return (
        <div className="relative">
            <input
                id={id} name={name} type={inputType} required
                autoComplete={autoComplete}
                placeholder={placeholder}
                maxLength={maxLength}
                className="h-12 w-full rounded-xl pl-4 pr-10 text-sm text-white bg-white/[0.04] border border-white/[0.06] placeholder:text-white/20 outline-none transition-colors duration-200 focus:bg-white/[0.06] focus:border-white/10"
            />
            {isPassword && (
                <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/30 hover:text-white/60 transition-colors"
                >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
            )}
        </div>
    );
}

// ── Gradient Submit Button ────────────────────────────────────────────────────
function SubmitButton({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
    return (
        <motion.button
            type="submit"
            disabled={disabled}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="gradient-button gradient-button-agendo w-full flex items-center justify-center rounded-2xl text-sm font-medium text-white disabled:opacity-50 disabled:pointer-events-none outline-none"
            style={{ height: "3.25rem" }}
        >
            {children}
        </motion.button>
    );
}

// ── Main Form ─────────────────────────────────────────────────────────────────
export function LoginForm({ error: initialError }: { error?: string }) {
    const [isPending, startTransition] = useTransition();
    const [tab, setTab] = useState<Tab>("signin");
    const [message, setMessage] = useState<{ text: string; type: "error" | "success" } | null>(
        initialError ? { text: initialError, type: "error" } : null
    );

    const handleTabChange = (t: Tab) => {
        setTab(t);
        setMessage(null);
    };

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setMessage(null);
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
            const result = tab === "signin" ? await login(formData) : await signup(formData);
            if (result && "error" in result && result.error)
                setMessage({ text: result.error, type: "error" });
            else if (result && "success" in result && result.success)
                setMessage({ text: result.success, type: "success" });
        });
    }

    // Height: signin has "OR / Sign up" section → taller. signup is shorter.
    // We pre-sizes with min-height and let CSS transition handle the change.
    const isSignIn = tab === "signin";

    return (
        <div
            className="relative w-full rounded-3xl"
            style={{
                background: "rgba(8,8,9,0.98)",
                border: "1px solid rgba(255,255,255,0.06)",
                backdropFilter: "blur(32px)",
                WebkitBackdropFilter: "blur(32px)",
                boxShadow: "0 0 60px rgba(0,0,0,0.6)",
                // CSS transition handles the height change naturally
                transition: "min-height 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
                minHeight: isSignIn ? "440px" : "540px",
            }}
        >
            <GlowingEffect spread={50} proximity={100} inactiveZone={0.01} borderWidth={1} />

            <div className="p-7 flex flex-col gap-5">
                <TabSwitcher active={tab} onChange={handleTabChange} />

                {/* Title — crossfade without any layout shifts */}
                <div className="relative">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={tab}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18, ease: "easeInOut" }}
                        >
                            <h2 className="text-xl font-light text-white/90">
                                {isSignIn ? "Welcome back" : "Create an account"}
                            </h2>
                            <p className="text-xs mt-0.5 text-white/30">
                                {isSignIn
                                    ? "Sign in to access your Agendo workspace."
                                    : "Start planning your day with Agendo."}
                            </p>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <AnimatePresence>
                        {!isSignIn && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 48 }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                                className="overflow-hidden"
                            >
                                <AuthInput id="username" name="username" type="text" placeholder="Username (max 20 chars)" maxLength={20} />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {isSignIn ? (
                        <AuthInput id="loginId" name="loginId" type="text" placeholder="Email or Username" autoComplete="username" />
                    ) : (
                        <AuthInput id="email" name="email" type="email" placeholder="Email" autoComplete="email" />
                    )}

                    <AuthInput
                        id="password" name="password" type="password" placeholder="Password"
                        autoComplete={isSignIn ? "current-password" : "new-password"}
                    />

                    <AnimatePresence>
                        {!isSignIn && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 48 }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                                className="overflow-hidden"
                            >
                                <AuthInput
                                    id="confirmPassword" name="confirmPassword" type="password" placeholder="Confirm Password"
                                    autoComplete="new-password"
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {message && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className="overflow-hidden"
                            >
                                <div
                                    className="text-sm px-4 py-3 rounded-xl leading-relaxed"
                                    style={{
                                        background: message.type === "error" ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)",
                                        border: `1px solid ${message.type === "error" ? "rgba(239,68,68,0.18)" : "rgba(34,197,94,0.18)"}`,
                                        color: message.type === "error" ? "rgb(252,165,165)" : "rgb(134,239,172)",
                                    }}
                                >
                                    {message.text}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="pt-1">
                        <SubmitButton disabled={isPending}>
                            {isPending ? "Please wait…" : isSignIn ? "Sign in" : "Create account"}
                        </SubmitButton>
                    </div>
                </form>

                {/* "OR / Sign up" section — fades in/out without pushing content */}
                <AnimatePresence>
                    {isSignIn && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="flex flex-col gap-3"
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-px bg-white/[0.06]" />
                                <span className="text-[10px] uppercase tracking-widest text-white/20">or</span>
                                <div className="flex-1 h-px bg-white/[0.06]" />
                            </div>
                            <p className="text-xs text-center text-white/25">
                                Don&apos;t have an account?{" "}
                                <button
                                    type="button"
                                    onClick={() => handleTabChange("signup")}
                                    className="text-indigo-400/70 underline underline-offset-2 hover:text-indigo-300 transition-colors"
                                >
                                    Sign up
                                </button>
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
