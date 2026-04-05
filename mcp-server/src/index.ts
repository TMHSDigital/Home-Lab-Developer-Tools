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
import { register as registerAdguardStats } from "./tools/adguardStats.js";
import { register as registerAdguardFilters } from "./tools/adguardFilters.js";
import { register as registerAdguardQueryLog } from "./tools/adguardQueryLog.js";
import { register as registerNpmProxyHosts } from "./tools/npmProxyHosts.js";
import { register as registerNpmCerts } from "./tools/npmCerts.js";
import { register as registerBackupList } from "./tools/backupList.js";
import { register as registerBackupRestore } from "./tools/backupRestore.js";
import { register as registerBackupDiff } from "./tools/backupDiff.js";
import { register as registerVolumeBackup } from "./tools/volumeBackup.js";
import { register as registerUfwStatus } from "./tools/ufwStatus.js";
import { register as registerFail2banStatus } from "./tools/fail2banStatus.js";
import { register as registerOpenPorts } from "./tools/openPorts.js";
import { register as registerContainerScan } from "./tools/containerScan.js";
import { register as registerJournalLogs } from "./tools/journalLogs.js";
import { register as registerLogSearch } from "./tools/logSearch.js";
import { register as registerNtfySend } from "./tools/ntfySend.js";
import { register as registerNtfyTopics } from "./tools/ntfyTopics.js";
import { register as registerAptUpgradable } from "./tools/aptUpgradable.js";
import { register as registerAptHistory } from "./tools/aptHistory.js";
import { register as registerKernelInfo } from "./tools/kernelInfo.js";
import { register as registerSystemdServices } from "./tools/systemdServices.js";
import { register as registerCertCheck } from "./tools/certCheck.js";
import { register as registerCertRenew } from "./tools/certRenew.js";
import { register as registerCertList } from "./tools/certList.js";

const server = new McpServer({
  name: "homelab-mcp",
  version: "0.8.0",
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
registerAdguardStats(server);
registerAdguardFilters(server);
registerAdguardQueryLog(server);
registerNpmProxyHosts(server);
registerNpmCerts(server);
registerBackupList(server);
registerBackupRestore(server);
registerBackupDiff(server);
registerVolumeBackup(server);
registerUfwStatus(server);
registerFail2banStatus(server);
registerOpenPorts(server);
registerContainerScan(server);
registerJournalLogs(server);
registerLogSearch(server);
registerNtfySend(server);
registerNtfyTopics(server);
registerAptUpgradable(server);
registerAptHistory(server);
registerKernelInfo(server);
registerSystemdServices(server);
registerCertCheck(server);
registerCertRenew(server);
registerCertList(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
