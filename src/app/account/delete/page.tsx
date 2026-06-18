import { redirect } from "next/navigation";

// Account deletion now lives on the consolidated Account page.
export default function AccountDeleteRedirect() {
  redirect("/account");
}
