import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/database/prisma";
import { loginSchema } from "@/lib/validation/auth";
import { normalizeEmail } from "@/lib/utils/normalize";
import { getClientIp } from "@/lib/api/request-ip";
import { rateLimit } from "@/lib/security/rate-limit";

const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

class RateLimitedSignin extends CredentialsSignin {
  override code = "rate_limited";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const ip = getClientIp(request);
        const limit = rateLimit(`auth:ip:${ip}`, LOGIN_LIMIT, LOGIN_WINDOW_MS);

        if (!limit.allowed) {
          throw new RateLimitedSignin();
        }

        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const email = normalizeEmail(parsed.data.email);

        if (!email) {
          return null;
        }

        const user = await prisma.user.findFirst({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            passwordHash: true,
            role: true,
            workspaceId: true,
          },
        });

        if (!user) {
          return null;
        }

        const passwordMatches = await bcrypt.compare(parsed.data.password, user.passwordHash);

        if (!passwordMatches) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as Role,
          workspaceId: user.workspaceId as string,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.workspaceId = user.workspaceId;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;

        if (token.role) {
          session.user.role = token.role as Role;
        }

        if (token.workspaceId) {
          session.user.workspaceId = token.workspaceId as string;
        }
      }

      return session;
    },
  },
});
