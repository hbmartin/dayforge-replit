import { streamObject } from "ai";
import { z } from "zod";
import { sheetPrompt, updateDocumentPrompt } from "@/lib/ai/prompts";
import { getArtifactModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";
import type { DataStream } from "../types";

const sheetSchema = z.object({
	csv: z.string().describe("CSV data"),
});

async function streamSheetContent(
	fullStream: ReturnType<typeof streamObject<typeof sheetSchema>>["fullStream"],
	dataStream: DataStream,
) {
	let draftContent = "";

	for await (const delta of fullStream) {
		if (delta.type === "object" && delta.object.csv) {
			dataStream.write({
				type: "data-sheetDelta",
				data: delta.object.csv,
				transient: true,
			});
			draftContent = delta.object.csv;
		}
	}

	return draftContent;
}

export const sheetDocumentHandler = createDocumentHandler<"sheet">({
	kind: "sheet",
	onCreateDocument: async ({ title, dataStream }) => {
		const { fullStream } = streamObject({
			model: getArtifactModel(),
			system: sheetPrompt,
			prompt: title,
			schema: sheetSchema,
		});

		const draftContent = await streamSheetContent(fullStream, dataStream);

		dataStream.write({
			type: "data-sheetDelta",
			data: draftContent,
			transient: true,
		});

		return draftContent;
	},
	onUpdateDocument: async ({ document, description, dataStream }) => {
		const { fullStream } = streamObject({
			model: getArtifactModel(),
			system: updateDocumentPrompt(document.content, "sheet"),
			prompt: description,
			schema: sheetSchema,
		});

		return await streamSheetContent(fullStream, dataStream);
	},
});
