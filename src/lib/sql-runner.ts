export type SqlTestCase = {
  input: string;
  expectedStdout: string;
};

export type SqlCaseResult = {
  ok: boolean;
  actual: string;
  stderr?: string;
};

export type SqlRunResult = {
  passed: number;
  total: number;
  cases: SqlCaseResult[];
};

export function formatSqlResult(result?: {
  columns: string[];
  values: (string | number | null | Uint8Array)[][];
}): string {
  if (!result) return "";

  const rows = result.values.map((row) =>
    row
      .map((value) => {
        if (value === null) return "NULL";
        if (value instanceof Uint8Array) {
          return `X'${Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("")}'`;
        }
        return String(value);
      })
      .join(" | "),
  );

  return [result.columns.join(" | "), ...rows].join("\n").trim();
}

export function normalizeSqlOutput(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

export async function runSqlCode(
  sourceCode: string,
  cases: SqlTestCase[],
): Promise<SqlRunResult> {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    throw new Error("SQL execution requires a browser with Web Worker support.");
  }

  const worker = new Worker(new URL("./sql-runner.worker.ts", import.meta.url), {
    type: "module",
  });

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      worker.terminate();
      reject(new Error("SQL execution exceeded the 8-second time limit."));
    }, 8_000);

    worker.onmessage = (event: MessageEvent<SqlRunResult | { error: string }>) => {
      window.clearTimeout(timeout);
      worker.terminate();

      if ("error" in event.data) {
        reject(new Error(event.data.error));
        return;
      }

      resolve(event.data);
    };

    worker.onerror = (event) => {
      window.clearTimeout(timeout);
      worker.terminate();
      reject(new Error(event.message || "SQL execution failed."));
    };

    worker.postMessage({ sourceCode, cases });
  });
}
