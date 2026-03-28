import { cookies } from "next/headers";
import { DEFAULT_LANGUAGE, getMessages, resolveAppLanguage } from "./messages";

export async function getServerLanguage() {
    const cookieStore = await cookies();
    return resolveAppLanguage(cookieStore.get("agendo-language")?.value ?? DEFAULT_LANGUAGE);
}

export async function getServerMessages() {
    const language = await getServerLanguage();
    return getMessages(language);
}
