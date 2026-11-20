import type { Metadata } from "next";
import { LoginInstallPopup } from "@/components/pwa/login-install-popup";
import { deviceFamily } from "@/lib/auth/device-family";
import { getBrand } from "@/lib/billing";
import { LoginForm } from "../auth-forms";

/**
 * When this device has signed in before, installing the app from here names
 * it after that family (as installing from inside the app does).
 */
export async function generateMetadata(): Promise<Metadata> {
  const fam = await deviceFamily();
  if (!fam) return { title: "Sign in" };
  return {
    title: "Sign in",
    manifest: `/api/manifest?f=${fam.id}`,
    applicationName: `${fam.name} Family`,
    appleWebApp: { capable: true, title: fam.name, statusBarStyle: "default" },
  };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, reset } = await searchParams;
  const [brand, fam] = await Promise.all([getBrand(), deviceFamily()]);
  return (
    <>
      <LoginForm next={typeof next === "string" ? next : undefined} notice={reset === "1" ? "Your password was changed. Sign in with your new password." : undefined} />
      <LoginInstallPopup appName={brand} knowsFamily={!!fam} />
    </>
  );
}
