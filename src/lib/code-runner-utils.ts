export interface Judge0ResponseBody {
  stdout?: unknown;
  stderr?: unknown;
  compile_output?: unknown;
  message?: unknown;
  status?: {
    id?: unknown;
    description?: unknown;
  };
}

export function normalizeCodeOutput(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

export function judge0ErrorMessage(
  body: Judge0ResponseBody,
  response: { ok: boolean; status: number },
): string | undefined {
  const errors: string[] = [];
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const statusDescription =
    typeof body.status?.description === "string" ? body.status.description.trim() : "";
  const statusId = typeof body.status?.id === "number" ? body.status.id : null;
  const compileOutput = typeof body.compile_output === "string" ? body.compile_output.trim() : "";
  const stderr = typeof body.stderr === "string" ? body.stderr.trim() : "";

  if (!response.ok) {
    errors.push(
      `Code runner request failed (HTTP ${response.status})${message ? `: ${message}` : "."}`,
    );
  } else if (message) {
    errors.push(message);
  }
  if (statusDescription && statusId !== 3 && statusId !== 4) errors.push(statusDescription);
  if (compileOutput) errors.push(compileOutput);
  if (stderr) errors.push(stderr);

  return errors.length ? errors.join("\n") : undefined;
}
