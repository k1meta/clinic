import Sidebar from "@/components/Sidebar";
import TopNav from "@/components/TopNav";
import { getClinicContext } from "@/db/queries/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let context;
  try {
    context = await getClinicContext();
  } catch {
    redirect('/sign-in');
  }

  const initials = context.user.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-screen">
      <Sidebar
        role={context.user.role}
        clinicName={context.clinicName}
        fullName={context.user.fullName}
        initials={initials}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav displayName={context.user.fullName} role={context.user.role} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
