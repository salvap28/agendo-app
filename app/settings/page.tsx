import { redirect } from 'next/navigation';

export default function SettingsPage() {
    // Redirigir a la primera pestaña por defecto
    redirect('/settings/profile');
}
