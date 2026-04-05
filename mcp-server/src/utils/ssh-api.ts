import { readFileSync } from "node:fs";
import { Client } from "ssh2";
import {
  SSHError,
  SSHConnectionError,
  SSHAuthError,
  SSHTimeoutError,
  CommandFailedError,
} from "./errors.js";

const CONNECT_TIMEOUT_MS = 10_000;
const EXEC_TIMEOUT_MS = 30_000;

function getConfig() {
  const host = process.env.HOMELAB_PI_HOST || "raspi5.local";
  const username = process.env.HOMELAB_PI_USER || "tmhs";
  const keyPath = process.env.HOMELAB_PI_KEY_PATH || "";

  return { host, username, keyPath };
}

export async function execSSH(command: string): Promise<string> {
  const { host, username, keyPath } = getConfig();

  return new Promise((resolve, reject) => {
    const conn = new Client();
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      conn.end();
      reject(new SSHTimeoutError(EXEC_TIMEOUT_MS));
    }, EXEC_TIMEOUT_MS);

    conn
      .on("ready", () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            clearTimeout(timer);
            conn.end();
            return reject(new SSHError(err.message, command));
          }

          stream
            .on("close", (code: number) => {
              clearTimeout(timer);
              conn.end();
              if (timedOut) return;

              if (code !== 0 && code !== null) {
                reject(new CommandFailedError(command, code, stderr));
              } else {
                resolve(stdout.trim());
              }
            })
            .on("data", (data: Buffer) => {
              stdout += data.toString();
            })
            .stderr.on("data", (data: Buffer) => {
              stderr += data.toString();
            });
        });
      })
      .on("error", (err: Error & { level?: string }) => {
        clearTimeout(timer);
        if (timedOut) return;

        if (
          err.message.includes("authentication") ||
          err.message.includes("All configured authentication methods failed")
        ) {
          reject(new SSHAuthError());
        } else if (
          err.message.includes("ECONNREFUSED") ||
          err.message.includes("ENOTFOUND") ||
          err.message.includes("ETIMEDOUT") ||
          err.level === "client-timeout"
        ) {
          reject(new SSHConnectionError(host));
        } else {
          reject(new SSHError(err.message));
        }
      })
      .connect({
        host,
        port: 22,
        username,
        privateKey: keyPath ? readFileSync(keyPath) : undefined,
        agent: process.env.SSH_AUTH_SOCK,
        readyTimeout: CONNECT_TIMEOUT_MS,
      });
  });
}

export async function checkSSHAvailable(): Promise<void> {
  try {
    await execSSH("echo ok");
  } catch (error) {
    throw error;
  }
}

export function errorResponse(error: unknown): {
  content: { type: "text"; text: string }[];
  isError: true;
} {
  if (error instanceof SSHError) {
    const parts: string[] = [`[${error.name}] ${error.message}`];

    if (error.command) {
      parts.push(`Command: ${error.command}`);
    }

    const suggestion = getErrorSuggestion(error);
    if (suggestion) {
      parts.push(`Suggestion: ${suggestion}`);
    }

    return {
      content: [{ type: "text" as const, text: parts.join("\n") }],
      isError: true,
    };
  }
  if (error instanceof Error) {
    return {
      content: [{ type: "text" as const, text: error.message }],
      isError: true,
    };
  }
  return {
    content: [{ type: "text" as const, text: "An unknown error occurred." }],
    isError: true,
  };
}

function getErrorSuggestion(error: SSHError): string | null {
  if (error instanceof SSHConnectionError) {
    return "Check that the Pi is powered on and reachable. Verify HOMELAB_PI_HOST is correct.";
  }
  if (error instanceof SSHAuthError) {
    return "Verify HOMELAB_PI_KEY_PATH points to a valid private key and HOMELAB_PI_USER is correct.";
  }
  if (error instanceof SSHTimeoutError) {
    return "The Pi may be under heavy load or unreachable. Try again or check network connectivity.";
  }
  if (error instanceof CommandFailedError) {
    return "The command failed on the Pi. Check the error output above for details.";
  }
  return null;
}
