import { describe, it, expect } from "vitest";
import { z } from "zod";

describe("input validation schemas", () => {
  describe("serviceLogs", () => {
    const schema = z.object({
      service: z.string().min(1),
      lines: z.number().int().positive().optional().default(50),
    });

    it("rejects empty service name", () => {
      expect(() => schema.parse({ service: "" })).toThrow();
    });

    it("accepts valid service name", () => {
      const result = schema.parse({ service: "grafana" });
      expect(result.service).toBe("grafana");
      expect(result.lines).toBe(50);
    });

    it("accepts custom line count", () => {
      const result = schema.parse({ service: "prometheus", lines: 100 });
      expect(result.lines).toBe(100);
    });

    it("rejects negative line count", () => {
      expect(() => schema.parse({ service: "test", lines: -1 })).toThrow();
    });
  });

  describe("serviceRestart", () => {
    const schema = z.object({
      service: z.string().min(1),
    });

    it("rejects empty service name", () => {
      expect(() => schema.parse({ service: "" })).toThrow();
    });

    it("accepts valid service name", () => {
      const result = schema.parse({ service: "nginx-proxy-manager" });
      expect(result.service).toBe("nginx-proxy-manager");
    });
  });

  describe("piReboot", () => {
    const schema = z.object({
      confirm: z.boolean(),
    });

    it("rejects missing confirm", () => {
      expect(() => schema.parse({})).toThrow();
    });

    it("rejects non-boolean confirm", () => {
      expect(() => schema.parse({ confirm: "yes" })).toThrow();
    });

    it("accepts boolean confirm", () => {
      const result = schema.parse({ confirm: true });
      expect(result.confirm).toBe(true);
    });
  });

  describe("diskUsage", () => {
    const schema = z.object({
      path: z.string().optional().default("/"),
      depth: z.number().int().positive().optional().default(1),
    });

    it("uses defaults when no args provided", () => {
      const result = schema.parse({});
      expect(result.path).toBe("/");
      expect(result.depth).toBe(1);
    });

    it("accepts custom path and depth", () => {
      const result = schema.parse({ path: "/opt", depth: 2 });
      expect(result.path).toBe("/opt");
      expect(result.depth).toBe(2);
    });

    it("rejects zero depth", () => {
      expect(() => schema.parse({ depth: 0 })).toThrow();
    });
  });

  describe("backupRun", () => {
    const schema = z.object({
      confirm: z.boolean(),
    });

    it("rejects missing confirm", () => {
      expect(() => schema.parse({})).toThrow();
    });

    it("accepts confirm=false", () => {
      const result = schema.parse({ confirm: false });
      expect(result.confirm).toBe(false);
    });
  });

  describe("aptUpdate", () => {
    const schema = z.object({
      upgrade: z.boolean().optional().default(false),
    });

    it("defaults upgrade to false", () => {
      const result = schema.parse({});
      expect(result.upgrade).toBe(false);
    });

    it("accepts upgrade=true", () => {
      const result = schema.parse({ upgrade: true });
      expect(result.upgrade).toBe(true);
    });
  });

  describe("backupStatus", () => {
    const schema = z.object({
      count: z.number().int().positive().optional().default(5),
    });

    it("defaults count to 5", () => {
      const result = schema.parse({});
      expect(result.count).toBe(5);
    });

    it("accepts custom count", () => {
      const result = schema.parse({ count: 10 });
      expect(result.count).toBe(10);
    });

    it("rejects zero count", () => {
      expect(() => schema.parse({ count: 0 })).toThrow();
    });
  });

  describe("composeUp", () => {
    const schema = z.object({
      stacks: z.array(z.string()).optional(),
    });

    it("accepts empty stacks for all", () => {
      const result = schema.parse({});
      expect(result.stacks).toBeUndefined();
    });

    it("accepts specific stacks", () => {
      const result = schema.parse({ stacks: ["compose.monitoring.yml"] });
      expect(result.stacks).toEqual(["compose.monitoring.yml"]);
    });
  });

  describe("prometheusQuery", () => {
    const schema = z.object({
      query: z.string().min(1),
      time: z.string().optional(),
    });

    it("rejects empty query", () => {
      expect(() => schema.parse({ query: "" })).toThrow();
    });

    it("accepts valid PromQL", () => {
      const result = schema.parse({ query: "up{job='node'}" });
      expect(result.query).toBe("up{job='node'}");
      expect(result.time).toBeUndefined();
    });

    it("accepts query with time", () => {
      const result = schema.parse({ query: "up", time: "2026-01-01T00:00:00Z" });
      expect(result.time).toBe("2026-01-01T00:00:00Z");
    });
  });

  describe("grafanaSnapshot", () => {
    const schema = z.object({
      dashboard: z.string().min(1),
    });

    it("rejects empty dashboard UID", () => {
      expect(() => schema.parse({ dashboard: "" })).toThrow();
    });

    it("accepts valid dashboard UID", () => {
      const result = schema.parse({ dashboard: "abc123" });
      expect(result.dashboard).toBe("abc123");
    });
  });

  describe("alertList", () => {
    const schema = z.object({
      state: z.enum(["active", "suppressed", "unprocessed"]).optional(),
    });

    it("accepts no state filter", () => {
      const result = schema.parse({});
      expect(result.state).toBeUndefined();
    });

    it("accepts valid state", () => {
      const result = schema.parse({ state: "active" });
      expect(result.state).toBe("active");
    });

    it("rejects invalid state", () => {
      expect(() => schema.parse({ state: "firing" })).toThrow();
    });
  });

  describe("speedtestResults", () => {
    const schema = z.object({
      count: z.number().int().positive().optional().default(5),
    });

    it("defaults count to 5", () => {
      const result = schema.parse({});
      expect(result.count).toBe(5);
    });

    it("accepts custom count", () => {
      const result = schema.parse({ count: 10 });
      expect(result.count).toBe(10);
    });

    it("rejects zero count", () => {
      expect(() => schema.parse({ count: 0 })).toThrow();
    });

    it("rejects negative count", () => {
      expect(() => schema.parse({ count: -3 })).toThrow();
    });
  });
});
