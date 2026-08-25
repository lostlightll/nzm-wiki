import assert from "node:assert/strict";
import test from "node:test";

import { hashJsonSourceText } from "./project";

test("projection source hashes ignore JSON formatting and line endings", () => {
  const lf = "{\n  \"schemaVersion\": 1,\n  \"values\": [1, 2]\n}\n";
  const crlf = "{\r\n\"schemaVersion\":1,\r\n\"values\":[1,2]\r\n}\r\n";

  assert.equal(hashJsonSourceText(lf), hashJsonSourceText(crlf));
});
