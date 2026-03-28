import { SettingsSidebar } from "@/components/settings/SettingsSidebar";

export const metadata = {
    title: "Settings | Agendo",
    description: "Manage your Agendo account and preferences.",
};

export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen pt-20 pb-10 px-4 md:px-8 max-w-6xl mx-auto flex flex-col md:flex-row gap-8 lg:gap-16">
            <SettingsSidebar />
            <div className="flex-1 min-w-0">
                {children}
            </div>
        </div>
    );
}
