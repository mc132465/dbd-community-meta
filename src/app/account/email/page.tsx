import { redirect } from "next/navigation";

// Email management now lives on the consolidated Account page.
export default function AccountEmailRedirect() {
  redirect("/account");
}
