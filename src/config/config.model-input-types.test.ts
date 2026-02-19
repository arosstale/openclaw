import { describe, expect, it } from "vitest";
import { validateConfigObject } from "./validation.js";

describe("model input types", () => {
  it("accepts text and image input types", () => {
    const res = validateConfigObject({
      models: {
        providers: {
          test: {
            baseUrl: "http://127.0.0.1:1234/v1",
            models: [
              {
                id: "test-model",
                name: "Test Model",
                input: ["text", "image"],
              },
            ],
          },
        },
      },
    });

    expect(res.ok).toBe(true);
  });

  it("accepts video input type", () => {
    const res = validateConfigObject({
      models: {
        providers: {
          test: {
            baseUrl: "http://127.0.0.1:1234/v1",
            models: [
              {
                id: "test-model",
                name: "Test Model",
                input: ["text", "video"],
              },
            ],
          },
        },
      },
    });

    expect(res.ok).toBe(true);
  });

  it("accepts audio input type", () => {
    const res = validateConfigObject({
      models: {
        providers: {
          test: {
            baseUrl: "http://127.0.0.1:1234/v1",
            models: [
              {
                id: "test-model",
                name: "Test Model",
                input: ["text", "audio"],
              },
            ],
          },
        },
      },
    });

    expect(res.ok).toBe(true);
  });

  it("accepts all input types together", () => {
    const res = validateConfigObject({
      models: {
        providers: {
          test: {
            baseUrl: "http://127.0.0.1:1234/v1",
            models: [
              {
                id: "test-model",
                name: "Test Model",
                input: ["text", "image", "video", "audio"],
              },
            ],
          },
        },
      },
    });

    expect(res.ok).toBe(true);
  });

  it("rejects invalid input type", () => {
    const res = validateConfigObject({
      models: {
        providers: {
          test: {
            baseUrl: "http://127.0.0.1:1234/v1",
            models: [
              {
                id: "test-model",
                name: "Test Model",
                input: ["text", "invalid-type"],
              },
            ],
          },
        },
      },
    });

    expect(res.ok).toBe(false);
  });
});
