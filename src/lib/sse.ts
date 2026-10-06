// Minimal Server-Sent Events framing. Shared by the run endpoint and the browser client.

export function encodeSSE(data: unknown): string {
  // JSON.stringify never emits raw newlines, so one data line per event is safe.
  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * Incremental SSE parser. Feed it decoded text chunks as they arrive;
 * it returns complete events and buffers any partial one.
 */
export function createSSEParser<T = unknown>() {
  let buffer = "";
  return {
    push(chunk: string): T[] {
      buffer += chunk.replace(/\r\n/g, "\n");
      const events: T[] = [];
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = raw
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).replace(/^ /, ""))
          .join("\n");
        if (data) events.push(JSON.parse(data) as T);
      }
      return events;
    },
  };
}
