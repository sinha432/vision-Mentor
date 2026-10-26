import initSqlJs, { type SqlJsStatic } from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import {
  formatSqlResult,
  normalizeSqlOutput,
  type SqlRunResult,
  type SqlTestCase,
} from "./sql-runner";

interface SqlRunRequest {
  sourceCode: string;
  cases: SqlTestCase[];
}

let sqlEngine: Promise<SqlJsStatic> | null = null;

function getSqlEngine() {
  sqlEngine ??= initSqlJs({ locateFile: () => sqlWasmUrl });
  return sqlEngine;
}

self.addEventListener("message", async (event: MessageEvent<SqlRunRequest>) => {
  try {
    const SQL = await getSqlEngine();
    const results: SqlRunResult["cases"] = [];

    for (const testCase of event.data.cases) {
      const database = new SQL.Database();

      try {
        database.exec(testCase.input);
        const queryResults = database.exec(event.data.sourceCode);
        const actual = formatSqlResult(queryResults.at(-1));
        const expected = normalizeSqlOutput(testCase.expectedStdout);

        results.push({
          ok: normalizeSqlOutput(actual) === expected,
          actual,
        });
      } catch (error) {
        results.push({
          ok: false,
          actual: "",
          stderr: error instanceof Error ? error.message : "SQL query failed.",
        });
      } finally {
        database.close();
      }
    }

    self.postMessage({
      passed: results.filter((result) => result.ok).length,
      total: results.length,
      cases: results,
    } satisfies SqlRunResult);
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "Could not start the SQL engine.",
    });
  }
});
