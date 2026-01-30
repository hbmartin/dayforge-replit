import { z } from "zod";
import { ConfigurationError } from "./errors";

const envSchema = z
	.object({
		NODE_ENV: z.string().optional(),
		VERCEL_ENV: z.string().optional(),
		VERCEL_URL: z.string().optional(),
		VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
		SKIP_ENV_VALIDATION: z.string().optional(),
		PLAYWRIGHT_TEST_BASE_URL: z.string().optional(),
		PLAYWRIGHT: z.string().optional(),
		CI_PLAYWRIGHT: z.string().optional(),
		POSTGRES_URL: z.string().min(1).optional(),
		AUTH_SECRET: z.string().min(1).optional(),
	})
	.passthrough();

function formatZodError(error: z.ZodError): string {
	return error.issues
		.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
		.join("; ");
}

export function parseEnv<TSchema extends z.ZodTypeAny>(
	schema: TSchema,
): z.infer<TSchema> {
	const parsed = schema.safeParse(process.env);

	if (!parsed.success) {
		throw new ConfigurationError(
			`Invalid environment configuration: ${formatZodError(parsed.error)}`,
			{ issues: parsed.error.issues },
		);
	}

	return parsed.data;
}

const env = parseEnv(envSchema);
export const nodeEnv = env.NODE_ENV;
export const isTestEnvironment = Boolean(
	env.PLAYWRIGHT_TEST_BASE_URL || env.PLAYWRIGHT || env.CI_PLAYWRIGHT,
);

const isTestLike = isTestEnvironment || nodeEnv === "test";
const shouldEnforce = env.SKIP_ENV_VALIDATION !== "true" && !isTestLike;

export function getAuthSecret(): string {
	const authSecret = env.AUTH_SECRET ?? null;

	if (!authSecret && shouldEnforce) {
		throw new ConfigurationError(
			"Missing required AUTH_SECRET configuration. " +
				"Set this environment variable for production.",
			{ missingEnvVars: ["AUTH_SECRET"] },
		);
	}

	return authSecret ?? "TEST_DUMMY";
}

let cachedPostgresUrl: string | null = null;

export function getPostgresUrl(): string {
	if (cachedPostgresUrl) {
		return cachedPostgresUrl;
	}

	const postgresUrl = env.POSTGRES_URL;

	if (!postgresUrl) {
		throw new ConfigurationError(
			"Missing required database configuration: POSTGRES_URL. " +
				"Set this environment variable or check your setup.",
			{ missingEnvVars: ["POSTGRES_URL"] },
		);
	}

	cachedPostgresUrl = postgresUrl;
	return cachedPostgresUrl;
}
