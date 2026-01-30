"use server";

import { z } from "zod";

import { createUser, getUser } from "@/lib/db/queries";

import { signIn } from "./auth";

const authFormSchema = z.object({
	email: z.string().email(),
	password: z.string().min(6),
});

function parseAuthFormData(formData: FormData) {
	return authFormSchema.parse({
		email: formData.get("email"),
		password: formData.get("password"),
	});
}

async function signInWithCredentials(email: string, password: string) {
	await signIn("credentials", {
		email,
		password,
		redirect: false,
	});
}

function handleAuthError<T extends { status: string }>(error: unknown): T {
	if (error instanceof z.ZodError) {
		return { status: "invalid_data" } as T;
	}
	return { status: "failed" } as T;
}

export type LoginActionState = {
	status: "idle" | "in_progress" | "success" | "failed" | "invalid_data";
};

export const login = async (
	_: LoginActionState,
	formData: FormData,
): Promise<LoginActionState> => {
	try {
		const { email, password } = parseAuthFormData(formData);
		await signInWithCredentials(email, password);
		return { status: "success" };
	} catch (error) {
		return handleAuthError<LoginActionState>(error);
	}
};

export type RegisterActionState = {
	status:
		| "idle"
		| "in_progress"
		| "success"
		| "failed"
		| "user_exists"
		| "invalid_data";
};

export const register = async (
	_: RegisterActionState,
	formData: FormData,
): Promise<RegisterActionState> => {
	try {
		const { email, password } = parseAuthFormData(formData);

		const [user] = await getUser(email);

		if (user) {
			return { status: "user_exists" };
		}

		await createUser(email, password);
		await signInWithCredentials(email, password);

		return { status: "success" };
	} catch (error) {
		return handleAuthError<RegisterActionState>(error);
	}
};
