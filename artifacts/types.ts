import type { UIMessageStreamWriter } from "ai";
import type { ChatMessage } from "@/lib/types";

export type DataStream = UIMessageStreamWriter<ChatMessage>;
