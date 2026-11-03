import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse, TIMEOUTS } from "../utils/ssh-api.js";
import { nodeParam } from "../utils/node-param.js";

const inputSchema = {
  ...nodeParam,
  image: z
    .string()
    .optional()
    .describe("Specific container image to scan. Scans all running images if omitted (slow on a Pi)"),
  severity: z
    .array(z.enum(["UNKNOWN", "LOW", "MEDIUM", "HIGH", "CRITICAL"]))
    .min(1)
    .optional()
    .describe("Severities to report (default: HIGH, CRITICAL)"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_containerScan",
    "Scan running container images for vulnerabilities using Trivy (default severities: HIGH, CRITICAL)",
    inputSchema,
    async (args) => {
      try {
        const trivyCheck = await execSSH(
          "command -v trivy >/dev/null 2>&1 && echo 'installed' || echo 'missing'",
          args.node,
        );

        if (trivyCheck.trim() === "missing") {
          return {
            content: [{
              type: "text" as const,
              text: "Trivy is not installed on the Pi. Install it with:\n\n" +
                "sudo apt install -y apt-transport-https gnupg\n" +
                "wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | gpg --dearmor | sudo tee /usr/share/keyrings/trivy.gpg > /dev/null\n" +
                'echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] https://aquasecurity.github.io/trivy-repo/deb generic main" | sudo tee /etc/apt/sources.list.d/trivy.list\n' +
                "sudo apt update && sudo apt install -y trivy",
            }],
          };
        }

        const severity = [...new Set(args.severity ?? ["HIGH", "CRITICAL"])].join(",");
        // --quiet drops progress bars, which otherwise dominate the output.
        const trivy = `trivy image --quiet --severity ${severity} --format table`;
        const cmd = args.image
          ? `${trivy} '${args.image}' 2>&1`
          : `docker ps --format '{{.Image}}' | sort -u | while read img; do echo "=== $img ==="; ${trivy} "$img" 2>&1; echo; done`;
        const output = await execSSH(cmd, args.node, { timeoutMs: TIMEOUTS.long });
        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
