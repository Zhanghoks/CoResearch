import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { adaptPiEvent, pickSerializable } from "./adaptPiEvent.js";

describe("adaptPiEvent", () => {
  it("maps message_update text_delta to message.delta", () => {
    const adapted = adaptPiEvent({
      type: "message_update",
      assistantMessageEvent: { type: "text_delta", delta: "hello" },
    });
    assert.ok(adapted);
    assert.equal(adapted.type, "message.delta");
  });

  it("drops message_update that is not a text_delta", () => {
    const adapted = adaptPiEvent({
      type: "message_update",
      assistantMessageEvent: { type: "thinking_delta", delta: "..." },
    });
    assert.equal(adapted, null);
  });

  it("ignores queue_update", () => {
    assert.equal(adaptPiEvent({ type: "queue_update" }), null);
  });

  it("truncates oversized payloads", () => {
    const huge = { type: "agent_end", blob: "x".repeat(20_000) };
    const picked = pickSerializable(huge) as { truncated?: boolean };
    assert.equal(picked.truncated, true);
  });
});
