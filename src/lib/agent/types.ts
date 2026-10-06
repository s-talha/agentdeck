// Message shapes follow the Anthropic Messages API so the real provider needs no translation layer.

export type TextBlock = { type: "text"; text: string };
export type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: unknown };
export type ToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};

export type AssistantBlock = TextBlock | ToolUseBlock;

export type Message =
  | { role: "user"; content: string | ToolResultBlock[] }
  | { role: "assistant"; content: AssistantBlock[] };

export type ToolSpec = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export type CompletionRequest = {
  system: string;
  messages: Message[];
  tools: ToolSpec[];
  maxTokens: number;
  signal?: AbortSignal;
};

export type CompletionResponse = {
  content: AssistantBlock[];
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" | string;
  usage: { inputTokens: number; outputTokens: number };
};

export interface ModelProvider {
  /** Model id shown in the UI and stored on each run. */
  readonly model: string;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}

/** Events streamed to the browser while a run executes. */
export type RunEvent =
  | { type: "run"; runId: string; model: string }
  | { type: "step"; step: number }
  | { type: "text"; text: string }
  | { type: "tool_call"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; name: string; output: string; isError: boolean }
  | { type: "done"; output: string; usage: { inputTokens: number; outputTokens: number }; durationMs: number }
  | { type: "error"; message: string };
