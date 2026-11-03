import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * MCP prompts: guided workflows built from the skills, available to any MCP
 * client (not only Cursor / Claude Code plugin users).
 */

function nodeClause(node?: string): string {
  return node ? ` Pass \`node: "${node}"\` to every tool call.` : "";
}

function userMessage(text: string) {
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text } }] };
}

export function morningHealthCheckText(node?: string): string {
  return [
    `Run a morning health check of my home lab.${nodeClause(node)}`,
    "",
    "1. Call `homelab_piStatus` for temperature, throttling, memory, disk and uptime.",
    "2. Call `homelab_serviceHealth` and list any container that is unhealthy, restarting or exited.",
    "3. Call `homelab_alertList` with `state: \"active\"` for firing alerts.",
    "4. Call `homelab_backupStatus` and check that the latest snapshot is recent.",
    "5. Call `homelab_diskUsage` if any filesystem is above 80% used.",
    "",
    "Summarize in a short report: OK items in one line, then each problem with its likely cause and a suggested next step.",
    "Read-only: do not restart, upgrade or change anything.",
  ].join("\n");
}

export function preRebootChecklistText(node?: string): string {
  return [
    `Prepare a pre-reboot checklist for the Pi.${nodeClause(node)}`,
    "",
    "1. Call `homelab_piStatus` and `homelab_serviceHealth` to record the current state.",
    "2. Call `homelab_backupStatus` and confirm a recent snapshot exists.",
    "3. Call `homelab_kernelInfo` and `homelab_aptUpgradable` to see whether a kernel or package update is pending.",
    "4. Call `homelab_systemdServices` for failed units that might not come back cleanly.",
    "",
    "List the risks and the containers that will restart. Do not call `homelab_piReboot`;",
    "only reboot if I explicitly confirm afterwards (it requires `confirm: true`).",
  ].join("\n");
}

export function investigateContainerText(service: string, node?: string): string {
  return [
    `Investigate the container "${service}".${nodeClause(node)}`,
    "",
    `1. Call \`homelab_serviceHealth\` with \`service: "${service}"\` for its status and health.`,
    `2. Call \`homelab_serviceLogs\` with \`service: "${service}"\` and \`lines: 200\`.`,
    `3. Call \`homelab_logSearch\` with \`service: "${service}"\` and \`pattern: "error"\` (adjust \`since\` if needed).`,
    "4. Call `homelab_composePs` to see related containers and port mappings.",
    "5. Call `homelab_piStatus` if the logs point at memory, disk or temperature pressure.",
    "",
    "Explain the most likely root cause and propose a fix. Do not restart or recreate anything",
    "until I confirm (`homelab_serviceRestart` and `homelab_composeUp` require `confirm: true`).",
  ].join("\n");
}

const nodeArg = z.string().optional().describe("Target node name (default: primary Pi)");

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "morning-health-check",
    {
      title: "Morning health check",
      description: "Read-only daily check of hardware, containers, alerts, backups and disk",
      argsSchema: { node: nodeArg },
    },
    ({ node }) => userMessage(morningHealthCheckText(node)),
  );

  server.registerPrompt(
    "pre-reboot-checklist",
    {
      title: "Pre-reboot checklist",
      description: "Gather state, backups and pending updates before rebooting; never reboots by itself",
      argsSchema: { node: nodeArg },
    },
    ({ node }) => userMessage(preRebootChecklistText(node)),
  );

  server.registerPrompt(
    "investigate-container",
    {
      title: "Investigate a failing container",
      description: "Status, logs and error search for one container, with a proposed fix",
      argsSchema: {
        service: z.string().min(1).describe("Container name"),
        node: nodeArg,
      },
    },
    ({ service, node }) => userMessage(investigateContainerText(service, node)),
  );
}
