import { useAuthStore } from "../store/authStore";

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  return (
    <div className="rounded bg-white p-4">
      <h2 className="text-2xl font-semibold">Profile</h2>
      <p className="mt-2 text-sm">Name: {user?.name}</p>
      <p className="text-sm">Email: {user?.email}</p>
      <p className="text-sm">Role: {user?.role}</p>
      <p className="text-sm">Branch ID: {user?.branch_id ?? "-"}</p>
    </div>
  );
}
