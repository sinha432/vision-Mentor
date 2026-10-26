import assert from "node:assert/strict";
import initSqlJs from "sql.js";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import test from "node:test";
import { formatSqlResult, normalizeSqlOutput } from "./sql-runner.ts";

const require = createRequire(import.meta.url);

test("SQL output includes column names, rows, nulls, and stable line breaks", () => {
  assert.equal(
    formatSqlResult({
      columns: ["id", "name", "note"],
      values: [
        [1, "Ada", null],
        [2, "Lin", "engineer"],
      ],
    }),
    "id | name | note\n1 | Ada | NULL\n2 | Lin | engineer",
  );
});

test("SQL output normalizes line endings and outer whitespace", () => {
  assert.equal(normalizeSqlOutput(" \r\nid | name\r\n1 | Ada \r\n"), "id | name\n1 | Ada");
});

test("SQLite setup and candidate queries produce comparable result tables", async () => {
  const wasmPath = join(dirname(require.resolve("sql.js")), "sql-wasm.wasm");
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const database = new SQL.Database();

  try {
    database.exec(
      "CREATE TABLE employees (id INTEGER, name TEXT, active INTEGER); " +
        "INSERT INTO employees VALUES (1, 'Ada', 1), (2, 'Lin', 0);",
    );
    const result = database.exec(
      "SELECT name, active FROM employees WHERE active = 1 ORDER BY id;",
    )[0];
    const expected = "name | active\nAda | 1";

    assert.equal(formatSqlResult(result), expected);
  } finally {
    database.close();
  }
});
