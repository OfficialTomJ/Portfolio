import { redirect } from "next/navigation";
import { getSession } from "../../../lib/session";
import AccountForm from "../../../Components/AccountForm";

export default async function AccountPage() {
  const session = await getSession();
  if (!session?.user) redirect("/sign-in");

  const { name, email, image, emailVerified } = session.user;
  return (
    <AccountForm
      initialName={name ?? ""}
      email={email}
      image={image ?? null}
      emailVerified={!!emailVerified}
    />
  );
}
