import { streamObject } from "ai";
import { z } from "zod";
import { codePrompt, updateDocumentPrompt } from "@/lib/ai/prompts";
import { getArtifactModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";
import type { DataStream } from "../types";

const codeSchema = z.object({
	code: z.string(),
});

async function streamCodeContent(
	fullStream: ReturnType<typeof streamObject<typeof codeSchema>>["fullStream"],
	dataStream: DataStream,
) {
	let draftContent = "";

	for await (const delta of fullStream) {
		if (delta.type === "object" && delta.object.code) {
			dataStream.write({
				type: "data-codeDelta",
				data: delta.object.code,
				transient: true,
			});
			draftContent = delta.object.code;
		}
	}

	return draftContent;
}

export const codeDocumentHandler = createDocumentHandler<"code">({
	kind: "code",
	onCreateDocument: async ({ title, dataStream }) => {
		const { fullStream } = streamObject({
			model: getArtifactModel(),
			system: codePrompt,
			prompt: title,
			schema: codeSchema,
		});

		return await streamCodeContent(fullStream, dataStream);
	},
	onUpdateDocument: async ({ document, description, dataStream }) => {
		const { fullStream } = streamObject({
			model: getArtifactModel(),
			system: updateDocumentPrompt(document.content, "code"),
			prompt: description,
			schema: codeSchema,
		});

		return await streamCodeContent(fullStream, dataStream);
	},
});
