import { redirect } from "next/navigation";

// The inbox lands here with add-human-handoff; until then pricing is the only page.
export default function StaffHome() {
  redirect("/staff/pricing");
}
