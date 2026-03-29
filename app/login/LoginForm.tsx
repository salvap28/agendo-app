"use client";

import { type ComponentType, type FormEvent, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { login, signup } from "./actions";
import { cn } from "@/lib/cn";
import type { AppLanguage } from "@/lib/i18n/messages";
import { getMessages } from "@/lib/i18n/messages";

type Tab = "signin" | "signup";
type Direction = 1 | -1;
type Message = {
    text: string;
    type: "error" | "success";
};

const TAB_ORDER: Tab[] = ["signin", "signup"];
const SOFT_EASE = [0.22, 1, 0.36, 1] as const;
const EMPHASIZED_EASE = [0.16, 1, 0.3, 1] as const;

function SegmentedTabs({
    active,
    onChange,
    disabled,
    language,
}: {
    active: Tab;
    onChange: (tab: Tab) => void;
    disabled: boolean;
    language: AppLanguage;
}) {
    const t = getMessages(language);

    return (
        <div className="grid grid-cols-2 rounded-[1.15rem] border border-white/8 bg-white/[0.02] p-1 backdrop-blur-xl">
            {([
                { id: "signin" as const, label: t.login.signInTab },
                { id: "signup" as const, label: t.login.signUpTab },
            ]).map((tab) => {
                const isActive = active === tab.id;

                return (
                    <button
                        key={tab.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange(tab.id)}
                        className={cn(
                            "relative rounded-[0.95rem] px-4 py-3 text-[0.92rem] font-medium tracking-[-0.015em] transition-colors duration-300",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/15",
                            isActive ? "text-white/94" : "text-white/34 hover:text-white/58"
                        )}
                    >
                        {isActive && (
                            <motion.span
                                layoutId="agendo-auth-pill"
                                className="absolute inset-0 rounded-[0.95rem] border border-white/8 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                                transition={{ type: "spring", stiffness: 360, damping: 32, mass: 0.7 }}
                            />
                        )}
                        <span className="relative z-10">{tab.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

function StatusBanner({ message }: { message: Message }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: SOFT_EASE }}
            aria-live="polite"
            className={cn(
                "rounded-[1.05rem] border px-4 py-3 text-sm leading-6 backdrop-blur-xl",
                message.type === "success"
                    ? "border-emerald-300/14 bg-emerald-400/[0.07] text-emerald-100/88"
                    : "border-rose-300/14 bg-rose-400/[0.07] text-rose-100/88"
            )}
        >
            {message.text}
        </motion.div>
    );
}

function AuthField({
    id,
    name,
    label,
    type,
    placeholder,
    icon: Icon,
    autoComplete,
    maxLength,
    autoFocus,
    language,
}: {
    id: string;
    name: string;
    label: string;
    type: "text" | "email" | "password";
    placeholder: string;
    icon: ComponentType<{ className?: string }>;
    autoComplete?: string;
    maxLength?: number;
    autoFocus?: boolean;
    language: AppLanguage;
}) {
    const t = getMessages(language);
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    const resolvedType = isPassword ? (showPassword ? "text" : "password") : type;

    return (
        <label htmlFor={id} className="group/field block">
            <span className="mb-2 block text-[0.68rem] font-medium uppercase tracking-[0.28em] text-white/40">
                {label}
            </span>

            <div className="relative overflow-hidden rounded-[1.2rem] border border-white/8 bg-white/[0.03] transition-all duration-300 group-focus-within/field:border-white/14 group-focus-within/field:bg-white/[0.045] group-focus-within/field:shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-white/24 transition-colors duration-300 group-focus-within/field:text-white/48">
                    <Icon className="h-4.5 w-4.5" />
                </div>

                <input
                    id={id}
                    name={name}
                    type={resolvedType}
                    required
                    autoComplete={autoComplete}
                    placeholder={placeholder}
                    maxLength={maxLength}
                    autoFocus={autoFocus}
                    className="h-14 w-full bg-transparent pl-12 pr-12 text-[0.98rem] font-medium tracking-[-0.015em] text-white outline-none placeholder:text-white/20"
                />

                {isPassword && (
                    <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-white/28 transition-colors hover:bg-white/[0.03] hover:text-white/60"
                        aria-label={showPassword ? t.login.hidePassword : t.login.showPassword}
                    >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                )}
            </div>
        </label>
    );
}

export function LoginForm({
    error: initialError,
    success: initialSuccess,
    language,
}: {
    error?: string;
    success?: string;
    language: AppLanguage;
}) {
    const t = getMessages(language);
    const [isPending, startTransition] = useTransition();
    const [tab, setTab] = useState<Tab>("signin");
    const [tabDirection, setTabDirection] = useState<Direction>(1);
    const [message, setMessage] = useState<Message | null>(
        initialError
            ? { text: initialError, type: "error" }
            : initialSuccess
                ? { text: initialSuccess, type: "success" }
                : null
    );
    const reducedMotion = useReducedMotion();

    const copy = tab === "signin"
        ? {
            title: t.login.signInTitle,
            description: t.login.signInDescription,
            submitLabel: t.login.signInCta,
            helper: t.login.signInHelper,
        }
        : {
            title: t.login.signUpTitle,
            description: t.login.signUpDescription,
            submitLabel: t.login.signUpCta,
            helper: t.login.signUpHelper,
        };

    const formMotion = reducedMotion
        ? {}
        : {
            initial: { opacity: 0, y: 24, filter: "blur(10px)" },
            animate: { opacity: 1, y: 0, filter: "blur(0px)" },
            transition: { duration: 0.68, ease: EMPHASIZED_EASE, delay: 0.12 },
        };

    const contentMotion = reducedMotion
        ? {}
        : {
            variants: {
                enter: (direction: Direction) => ({
                    opacity: 0,
                    x: direction > 0 ? 22 : -22,
                    y: 6,
                    filter: "blur(8px)",
                }),
                center: {
                    opacity: 1,
                    x: 0,
                    y: 0,
                    filter: "blur(0px)",
                },
                exit: (direction: Direction) => ({
                    opacity: 0,
                    x: direction > 0 ? -18 : 18,
                    y: -4,
                    filter: "blur(6px)",
                }),
            },
            initial: "enter",
            animate: "center",
            exit: "exit",
            transition: { duration: 0.3, ease: SOFT_EASE },
        };

    function handleTabChange(nextTab: Tab) {
        if (isPending || nextTab === tab) return;
        setTabDirection(TAB_ORDER.indexOf(nextTab) > TAB_ORDER.indexOf(tab) ? 1 : -1);
        setTab(nextTab);
        setMessage(null);
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setMessage(null);

        const formData = new FormData(event.currentTarget);
        formData.set("language", language);

        startTransition(async () => {
            const result = tab === "signin" ? await login(formData) : await signup(formData);

            if (result && "error" in result && result.error) {
                setMessage({ text: result.error, type: "error" });
                return;
            }

            if (result && "success" in result && result.success) {
                setMessage({ text: result.success, type: "success" });
            }
        });
    }

    return (
        <motion.div {...formMotion} className="relative w-full max-w-[32rem] lg:ml-auto">
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(14,12,20,0.76)_0%,rgba(10,9,16,0.72)_100%)] shadow-[0_30px_80px_-42px_rgba(0,0,0,0.88)] backdrop-blur-[22px]">
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]" />

                <div className="relative p-5 sm:p-7">
                    <SegmentedTabs active={tab} onChange={handleTabChange} disabled={isPending} language={language} />

                    <AnimatePresence mode="wait" initial={false} custom={tabDirection}>
                        <motion.div key={tab} className="mt-7" custom={tabDirection} {...contentMotion}>
                            <div className="space-y-2.5">
                                <h2 className="text-[1.78rem] font-medium tracking-[-0.05em] text-white/94 sm:text-[1.96rem]">
                                    {copy.title}
                                </h2>
                                <p className="max-w-[26rem] text-sm leading-6 tracking-[-0.01em] text-white/44 sm:text-[0.93rem]">
                                    {copy.description}
                                </p>
                            </div>

                            <div className="mt-5">
                                <AnimatePresence>{message && <StatusBanner message={message} />}</AnimatePresence>
                            </div>

                            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
                                <input type="hidden" name="language" value={language} />

                                {tab === "signup" && (
                                    <AuthField
                                        id="username"
                                        name="username"
                                        label={t.login.username}
                                        type="text"
                                        placeholder={t.login.usernamePlaceholder}
                                        icon={UserRound}
                                        maxLength={20}
                                        autoComplete="username"
                                        autoFocus
                                        language={language}
                                    />
                                )}

                                {tab === "signin" ? (
                                    <AuthField
                                        id="loginId"
                                        name="loginId"
                                        label={t.login.emailOrUsername}
                                        type="text"
                                        placeholder={t.login.emailOrUsernamePlaceholder}
                                        icon={Mail}
                                        autoComplete="username"
                                        autoFocus
                                        language={language}
                                    />
                                ) : (
                                    <AuthField
                                        id="email"
                                        name="email"
                                        label={t.login.email}
                                        type="email"
                                        placeholder={t.login.emailPlaceholder}
                                        icon={Mail}
                                        autoComplete="email"
                                        language={language}
                                    />
                                )}

                                <AuthField
                                    id="password"
                                    name="password"
                                    label={t.login.password}
                                    type="password"
                                    placeholder={tab === "signin" ? t.login.passwordPlaceholderSignIn : t.login.passwordPlaceholderSignUp}
                                    icon={LockKeyhole}
                                    autoComplete={tab === "signin" ? "current-password" : "new-password"}
                                    language={language}
                                />

                                {tab === "signin" && (
                                    <div className="-mt-1 flex justify-end">
                                        <button type="button" className="text-xs text-white/50 transition-colors hover:text-white">
                                            {t.login.forgotPassword}
                                        </button>
                                    </div>
                                )}

                                {tab === "signup" && (
                                    <AuthField
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        label={t.login.confirmPassword}
                                        type="password"
                                        placeholder={t.login.confirmPasswordPlaceholder}
                                        icon={CheckCircle2}
                                        autoComplete="new-password"
                                        language={language}
                                    />
                                )}

                                <div className="pt-4">
                                    <button
                                        type="submit"
                                        disabled={isPending}
                                        className="group relative isolate inline-flex h-[3.4rem] w-full items-center justify-center gap-3 overflow-hidden rounded-[1.35rem] border border-white/10 bg-gradient-to-r from-[#4c1d95] to-[#6d28d9] text-[0.98rem] font-medium tracking-[-0.02em] text-white shadow-[0_18px_42px_-20px_rgba(109,40,217,0.72)] transition-all duration-300 hover:-translate-y-[1px] hover:shadow-[0_22px_52px_-18px_rgba(109,40,217,0.92)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/40 active:translate-y-0 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60"
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0))] opacity-70 transition-opacity duration-300 group-hover:opacity-90"
                                        />
                                        <span
                                            aria-hidden="true"
                                            className="absolute inset-y-0 left-[-30%] w-[48%] bg-[radial-gradient(circle,rgba(255,255,255,0.34)_0%,rgba(255,255,255,0)_72%)] opacity-0 blur-2xl transition-all duration-500 group-hover:left-[74%] group-hover:opacity-100"
                                        />

                                        <span className="relative z-10 flex items-center gap-3">
                                            {isPending ? (
                                                <span className="inline-flex items-center gap-3">
                                                    <span className="h-4 w-4 animate-spin rounded-full border border-white/25 border-t-white/90" />
                                                    {t.login.syncing}
                                                </span>
                                            ) : (
                                                <>
                                                    {copy.submitLabel}
                                                    <ArrowRight className="h-4.5 w-4.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                                                </>
                                            )}
                                        </span>
                                    </button>
                                </div>
                            </form>

                            <div className="mt-4 px-1 text-[0.82rem] leading-6 tracking-[-0.01em] text-white/34">
                                {copy.helper}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );
}
