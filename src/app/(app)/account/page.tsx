import { readSession } from "@/shared/lib/auth";
import { getUser } from "@/features/auth/server/service";
import { ProfileForm } from "@/features/account/components/ProfileForm";
import { PasswordForm } from "@/features/account/components/PasswordForm";
import { DeleteAccount } from "@/features/account/components/DeleteAccount";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const s = await readSession();
  const user = await getUser(s!.sub);
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-5">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
          <p className="text-sm text-muted mt-1">Manage your profile and credentials.</p>
        </header>
        <ProfileForm user={{ name: user!.name, email: user!.email }} />
        <PasswordForm />
        <DeleteAccount email={user!.email} />
      </div>
    </div>
  );
}
