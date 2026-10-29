import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  judge0ErrorMessage,
  normalizeCodeOutput,
  type Judge0ResponseBody,
} from "./code-runner-utils";
import { JUDGE0_LANGUAGE_IDS } from "./judge0-languages";

const schema = z.object({
  sourceCode: z.string().min(1).max(50000),
  language: z.enum(["java", "javascript", "python", "c", "cpp"]).default("java"),
  cases: z
    .array(
      z.object({
        input: z.string().max(10000).default(""),
        expectedStdout: z.string().max(10000).default(""),
      }),
    )
    .min(1)
    .max(10),
});

export const runJavaCode = createServerFn({ method: "POST" })
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.JUDGE0_RAPIDAPI_KEY;
    if (!key) {
      return {
        configured: false as const,
        passed: 0,
        total: data.cases.length,
        cases: [] as { ok: boolean; actual: string; stderr?: string }[],
      };
    }
    const headers = {
      "Content-Type": "application/json",
      "X-RapidAPI-Key": key,
      "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
    };
    const url = "https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true";

    const results: { ok: boolean; actual: string; stderr?: string }[] = [];
    const languageId = JUDGE0_LANGUAGE_IDS[data.language];

    for (const c of data.cases) {
      let responseStatus: number | undefined;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            source_code: data.sourceCode,
            language_id: languageId,
            stdin: c.input,
            expected_output: c.expectedStdout,
          }),
        });
        responseStatus = res.status;
        const responseText = await res.text();
        let body: Judge0ResponseBody;
        try {
          body = JSON.parse(responseText) as Judge0ResponseBody;
        } catch {
          body = {
            message: responseText.trim() || res.statusText || "Invalid code runner response.",
          };
        }
        const actual = normalizeCodeOutput(typeof body.stdout === "string" ? body.stdout : "");
        const expected = normalizeCodeOutput(c.expectedStdout);
        const stderr = judge0ErrorMessage(body, res);
        results.push({ ok: actual === expected && !stderr, actual, stderr });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Code runner request failed.";
        results.push({
          ok: false,
          actual: "",
          stderr: responseStatus
            ? `Code runner request failed (HTTP ${responseStatus}): ${message}`
            : message,
        });
      }
    }
    const passed = results.filter((r) => r.ok).length;
    return { configured: true as const, passed, total: data.cases.length, cases: results };
  });
