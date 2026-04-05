import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execSSH, errorResponse } from "../utils/ssh-api.js";

const inputSchema = {
  image: z
    .string()
    .optional()
    .describe("Specific container image to scan. Scans all running images if omitted"),
};

export function register(server: McpServer): void {
  server.tool(
    "homelab_containerScan",
    "Scan running container images for HIGH/CRITICAL vulnerabilities using Trivy",
    inputSchema,
    async (args) => {
      try {
        const trivyCheck = await execSSH(
          "command -v trivy >/dev/null 2>&1 && echo 'installed' || echo 'missing'",
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

        const cmd = args.image
          ? `trivy image --severity HIGH,CRITICAL --format table '${args.image}' 2>&1`
          : "docker ps --format '{{.Image}}' | sort -u | while read img; do echo \"=== $img ===\"; trivy image --severity HIGH,CRITICAL --format table \"$img\" 2>&1; echo; done";
        const output = await execSSH(cmd);
        return { content: [{ type: "text" as const, text: output }] };
      } catch (error) {
        return errorResponse(error);
      }
    },
  );
}
