import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  sourceCode: z.string().min(1).max(50000),
  cases: z.array(z.object({
    input: z.string().max(10000).default(""),
    expectedStdout: z.string().max(10000).default(""),
  })).min(1).max(10),
});

export const runJavaCode = createServerFn({ method: "POST" })
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.JUDGE0_RAPIDAPI_KEY;
    if (!key) {
      return { configured: false as const, passed: 0, total: data.cases.length, cases: [] as { ok: boolean; actual: string; stderr?: string }[] };
    }
    const headers = {
      "Content-Type": "application/json",
      "X-RapidAPI-Key": key,
      "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
    };
    const url = "https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true";

    const results: { ok: boolean; actual: string; stderr?: string }[] = [];
    for (const c of data.cases) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            source_code: data.sourceCode,
            language_id: 62, // Java (OpenJDK 13)
            stdin: c.input,
            expected_output: c.expectedStdout,
          }),
        });
        const body = await res.json() as any;
        const actual = String(body.stdout ?? "").trim();
        const expected = c.expectedStdout.trim();
        const compileErr = body.compile_output ? String(body.compile_output) : "";
        const runErr = body.stderr ? String(body.stderr) : "";
        const stderr = [compileErr, runErr].filter(Boolean).join("\n") || undefined;
        results.push({ ok: actual === expected && !stderr, actual, stderr });
      } catch (e: any) {
        results.push({ ok: false, actual: "", stderr: e?.message ?? "runner error" });
      }
    }
    const passed = results.filter((r) => r.ok).length;
    return { configured: true as const, passed, total: data.cases.length, cases: results };
  });
