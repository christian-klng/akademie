"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { COOKIE_NAME, SESSION_TTL_S, createSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { readField } from "@/lib/form";

export type LoginState = { error?: string };

// A syntactically valid hash to compare against when the email is unknown, so
// the action takes the same time for "no such user" and "wrong password"
// (no user enumeration via timing). Computed once per server start.
const DUMMY_HASH = bcrypt.hashSync("invalid-password-placeholder", 12);

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = readField(formData, "email").trim().toLowerCase();
  const password = readField(formData, "password");

  const [user] = email
    ? await db
        .select()
        .from(schema.adminUser)
        .where(eq(schema.adminUser.email, email))
        .limit(1)
    : [];

  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    return { error: "E-Mail oder Passwort ist falsch." };
  }

  const token = await createSession(user.email);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_S,
  });

  redirect("/admin/events");
}
