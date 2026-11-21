import { generateKeyPairSync } from "node:crypto";
import { Server } from "ssh2";
import { describe, it, expect, vi, afterEach } from "vitest";
import { execSSH } from "../ssh-api.js";

const hostKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey
  .export({ type: "pkcs1", format: "pem" });

afterEach(() => { vi.unstubAllEnvs(); });

describe("SSH stdin transport", () => {
  it.each(["empty", "large"])("sends %s input and EOF over a real local SSH channel", async (size) => {
    const input = size === "empty" ? "" : "台北's dashboard\n".repeat(70000);
    const received: Buffer[] = [];
    let eof = false;
    const server = new Server({ hostKeys: [hostKey] }, (client) => {
      client.on("authentication", (ctx) => ctx.accept());
      client.on("ready", () => {
        client.on("session", (accept) => {
          accept().on("exec", (acceptExec) => {
            const stream = acceptExec();
            stream.on("data", (chunk: Buffer) => received.push(chunk));
            stream.on("end", () => {
              eof = true;
              stream.write("received\n");
              stream.exit(0);
              stream.end();
            });
          });
        });
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("No local SSH port");
      vi.stubEnv("HOMELAB_NODES", "");
      vi.stubEnv("HOMELAB_DRY_RUN", "");
      vi.stubEnv("HOMELAB_PI_HOST", "127.0.0.1");
      vi.stubEnv("HOMELAB_PI_PORT", String(address.port));
      vi.stubEnv("HOMELAB_PI_KEY_PATH", "");
      vi.stubEnv("SSH_AUTH_SOCK", "");
      await expect(execSSH("receive-input", undefined, { stdin: input, timeoutMs: 5000 })).resolves.toBe("received");
      expect(eof).toBe(true);
      expect(Buffer.concat(received).toString("utf8")).toBe(input);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 10000);
});
