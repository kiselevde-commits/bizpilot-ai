import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
    updateAge: 15 * 60,
  },
  callbacks: {
    authorized({ auth }) {
      return Boolean(auth?.user);
    },
  },
  providers: [],
} satisfies NextAuthConfig;
