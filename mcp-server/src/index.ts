#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { register as registerPiStatus } from "./tools/piStatus.js";
import { register as registerPiReboot } from "./tools/piReboot.js";
import { register as registerServiceHealth } from "./tools/serviceHealth.js";
import { register as registerServiceLogs } from "./tools/serviceLogs.js";
import { register as registerServiceRestart } from "./tools/serviceRestart.js";
import { register as registerComposeUp } from "./tools/composeUp.js";
import { register as registerComposeDown } from "./tools/composeDown.js";
import { register as registerComposePull } from "./tools/composePull.js";
import { register as registerComposePs } from "./tools/composePs.js";
import { register as registerNetworkInfo } from "./tools/networkInfo.js";
import { register as registerDiskUsage } from "./tools/diskUsage.js";
import { register as registerBackupStatus } from "./tools/backupStatus.js";
import { register as registerBackupRun } from "./tools/backupRun.js";
import { register as registerAptUpdate } from "./tools/aptUpdate.js";
import { register as registerSshTest } from "./tools/sshTest.js";
import { register as registerPrometheusQuery } from "./tools/prometheusQuery.js";
import { register as registerGrafanaSnapshot } from "./tools/grafanaSnapshot.js";
import { register as registerUptimeKumaStatus } from "./tools/uptimeKumaStatus.js";
import { register as registerAlertList } from "./tools/alertList.js";
import { register as registerSpeedtestResults } from "./tools/speedtestResults.js";

const server = new McpServer({
  name: "homelab-mcp",
  version: "0.2.1",
});

registerPiStatus(server);
registerPiReboot(server);
registerServiceHealth(server);
registerServiceLogs(server);
registerServiceRestart(server);
registerComposeUp(server);
registerComposeDown(server);
registerComposePull(server);
registerComposePs(server);
registerNetworkInfo(server);
registerDiskUsage(server);
registerBackupStatus(server);
registerBackupRun(server);
registerAptUpdate(server);
registerSshTest(server);
registerPrometheusQuery(server);
registerGrafanaSnapshot(server);
registerUptimeKumaStatus(server);
registerAlertList(server);
registerSpeedtestResults(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
