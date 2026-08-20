import { AccountSettings } from "@/components/settings/account-settings";
export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm text-accent">Preferências</p>
      <h1 className="mt-1 mb-7 text-3xl font-semibold">Configurações</h1>
      <AccountSettings />
    </div>
  );
}
