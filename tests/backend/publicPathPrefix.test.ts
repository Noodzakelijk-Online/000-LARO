import { describe, expect, it } from "vitest";
import {
  normalizePublicPathPrefix,
  stripPublicPathPrefix,
} from "../../server/publicPathPrefix";

describe("public path prefix", () => {
  it("normalizes a configured shared-domain prefix", () => {
    expect(normalizePublicPathPrefix(" /laro/ ")).toBe("/laro");
    expect(normalizePublicPathPrefix("/")).toBe("");
    expect(normalizePublicPathPrefix("")).toBe("");
  });

  it("rejects values that are not path prefixes", () => {
    expect(() => normalizePublicPathPrefix("laro")).toThrow(/absolute URL path/);
    expect(() => normalizePublicPathPrefix("/laro?mode=1")).toThrow(/absolute URL path/);
    expect(() => normalizePublicPathPrefix("/laro//api")).toThrow(/absolute URL path/);
    expect(() => normalizePublicPathPrefix("/laro/../api")).toThrow(/absolute URL path/);
  });

  it("strips the prefix only at a path boundary", () => {
    expect(stripPublicPathPrefix("/laro/api/health", "/laro")).toBe("/api/health");
    expect(stripPublicPathPrefix("/laro?check=1", "/laro")).toBe("/?check=1");
    expect(stripPublicPathPrefix("/laro", "/laro")).toBe("/");
    expect(stripPublicPathPrefix("/larousse/api", "/laro")).toBe("/larousse/api");
    expect(stripPublicPathPrefix("/api/health", "/laro")).toBe("/api/health");
  });

  it("builds the public realtime path without changing the direct default", () => {
    expect(`${normalizePublicPathPrefix("/laro")}/socket.io`).toBe("/laro/socket.io");
    expect(`${normalizePublicPathPrefix("")}/socket.io`).toBe("/socket.io");
  });
});
