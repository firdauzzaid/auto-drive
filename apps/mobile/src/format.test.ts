/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";

import { parseQuantity } from "./format.ts";

test("parseQuantity reads comma or dot decimals and rejects junk", () => {
  assert.equal(parseQuantity("1,5"), 1.5);
  assert.equal(parseQuantity(" 0.25 "), 0.25);
  assert.equal(parseQuantity("12"), 12);
  assert.ok(Number.isNaN(parseQuantity("")));
  assert.ok(Number.isNaN(parseQuantity("dua")));
});
