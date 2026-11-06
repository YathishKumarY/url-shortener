import { Suspense } from "react";
import { AdminView } from "@/components/admin/admin-view";

export const metadata = { title: "Admin" };

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminView />
    </Suspense>
  );
}
