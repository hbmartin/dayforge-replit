import { smoothStream, streamText } from "ai";
import { updateDocumentPrompt } from "@/lib/ai/prompts";
import { getArtifactModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";
import type { DataStream } from "../types";

async function streamTextContent(
	fullStream: ReturnType<typeof streamText>["fullStream"],
	dataStream: DataStream,
) {
	let draftContent = "";

	for await (const delta of fullStream) {
		if (delta.type === "text-delta") {
			draftContent += delta.text;
			dataStream.write({
				type: "data-textDelta",
				data: delta.text,
				transient: true,
			});
		}
	}

	return draftContent;
}

export const textDocumentHandler = createDocumentHandler<"text">({
	kind: "text",
	onCreateDocument: async ({ title, dataStream }) => {
		const { fullStream } = streamText({
			model: getArtifactModel(),
			system:
				"Write about the given topic. Markdown is supported. Use headings wherever appropriate.",
			experimental_transform: smoothStream({ chunking: "word" }),
			prompt: title,
		});

		return await streamTextContent(fullStream, dataStream);
	},
	onUpdateDocument: async ({ document, description, dataStream }) => {
		const { fullStream } = streamText({
			model: getArtifactModel(),
			system: updateDocumentPrompt(document.content, "text"),
			experimental_transform: smoothStream({ chunking: "word" }),
			prompt: description,
			providerOptions: {
				openai: {
					prediction: {
						type: "content",
						content: document.content,
					},
				},
			},
		});

		return await streamTextContent(fullStream, dataStream);
	},
});
