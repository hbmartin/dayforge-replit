import { compare } from "bcrypt-ts";
import NextAuth, { type DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { DUMMY_PASSWORD } from "@/lib/constants";
import { createGuestUser, getUser } from "@/lib/db/queries";
import { authConfig } from "./auth.config";

export type UserType = "guest" | "regular";

declare module "next-auth" {
	interface Session extends DefaultSession {
		user: {
			id: string;
			type: UserType;
		} & DefaultSession["user"];
	}

	interface User {
		id?: string;
		email?: string | null;
		type: UserType;
	}
}

declare module "next-auth/jwt" {
	interface JWT extends DefaultJWT {
		id: string;
		type: UserType;
	}
}

export const LoginSchema = z.object({
	email: z.string().min(1),
	password: z.string().min(1),
});

export const {
	handlers: { GET, POST },
	auth,
	signIn,
	signOut,
} = NextAuth({
	...authConfig,
	providers: [
		Credentials({
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Password", type: "password" },
			},
			async authorize(credentials) {
				const parsed = LoginSchema.safeParse(credentials);
				if (!parsed.success) {
					console.warn({
						event: "auth.credentials.validation_failed",
						details: {
							errors: parsed.error.flatten().fieldErrors,
						},
					});
					return null;
				}

				const { email, password } = parsed.data;

				try {
					const users = await getUser(email);

					const [user] = users;

					if (!user) {
						await compare(password, DUMMY_PASSWORD);
						return null;
					}

					if (!user.password) {
						await compare(password, DUMMY_PASSWORD);
						return null;
					}

					const passwordsMatch = await compare(password, user.password);

					if (!passwordsMatch) {
						return null;
					}

					return { ...user, type: "regular" };
				} catch (error) {
					console.error({
						event: "auth.credentials.auth_error",
						error: error instanceof Error ? error.message : String(error),
						details: { email },
					});
					throw error;
				}
			},
		}),
		Credentials({
			id: "guest",
			credentials: {},
			async authorize() {
				const [guestUser] = await createGuestUser();
				return { ...guestUser, type: "guest" };
			},
		}),
	],
	callbacks: {
		jwt({ token, user }) {
			if (user) {
				token.id = user.id as string;
				token.type = user.type;
			}

			return token;
		},
		session({ session, token }) {
			if (session.user) {
				session.user.id = token.id;
				session.user.type = token.type;
			}

			return session;
		},
	},
});
