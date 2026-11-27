import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register as adguardFilterToggle } from "./tools/adguardFilterToggle.js";
import { register as adguardFilters } from "./tools/adguardFilters.js";
import { register as adguardQueryLog } from "./tools/adguardQueryLog.js";
import { register as adguardRewrites } from "./tools/adguardRewrites.js";
import { register as adguardRewriteSet } from "./tools/adguardRewriteSet.js";
import { register as adguardStats } from "./tools/adguardStats.js";
import { register as alertList } from "./tools/alertList.js";
import { register as alertSilence } from "./tools/alertSilence.js";
import { register as alertSilences } from "./tools/alertSilences.js";
import { register as aptHistory } from "./tools/aptHistory.js";
import { register as aptUpdate } from "./tools/aptUpdate.js";
import { register as aptUpgradable } from "./tools/aptUpgradable.js";
import { register as backupCheck } from "./tools/backupCheck.js";
import { register as backupDiff } from "./tools/backupDiff.js";
import { register as backupList } from "./tools/backupList.js";
import { register as backupRestore } from "./tools/backupRestore.js";
import { register as backupRun } from "./tools/backupRun.js";
import { register as backupStatus } from "./tools/backupStatus.js";
import { register as certCheck } from "./tools/certCheck.js";
import { register as certList } from "./tools/certList.js";
import { register as certRenew } from "./tools/certRenew.js";
import { register as composeDown } from "./tools/composeDown.js";
import { register as composePs } from "./tools/composePs.js";
import { register as composePull } from "./tools/composePull.js";
import { register as composeUp } from "./tools/composeUp.js";
import { register as containerScan } from "./tools/containerScan.js";
import { register as diagnostics } from "./tools/diagnostics.js";
import { register as diskUsage } from "./tools/diskUsage.js";
import { register as fail2banStatus } from "./tools/fail2banStatus.js";
import { register as grafanaSnapshot } from "./tools/grafanaSnapshot.js";
import { register as grafanaImport } from "./tools/grafanaImport.js";
import { register as healthCheck } from "./tools/healthCheck.js";
import { register as inventorySync } from "./tools/inventorySync.js";
import { register as journalLogs } from "./tools/journalLogs.js";
import { register as kernelInfo } from "./tools/kernelInfo.js";
import { register as logSearch } from "./tools/logSearch.js";
import { register as networkInfo } from "./tools/networkInfo.js";
import { register as nodeExec } from "./tools/nodeExec.js";
import { register as nodeList } from "./tools/nodeList.js";
import { register as nodeStatus } from "./tools/nodeStatus.js";
import { register as npmCerts } from "./tools/npmCerts.js";
import { register as npmProxyHosts } from "./tools/npmProxyHosts.js";
import { register as ntfySend } from "./tools/ntfySend.js";
import { register as ntfyTopics } from "./tools/ntfyTopics.js";
import { register as openPorts } from "./tools/openPorts.js";
import { register as piReboot } from "./tools/piReboot.js";
import { register as piStatus } from "./tools/piStatus.js";
import { register as prometheusQuery } from "./tools/prometheusQuery.js";
import { register as serviceHealth } from "./tools/serviceHealth.js";
import { register as serviceLogs } from "./tools/serviceLogs.js";
import { register as serviceRestart } from "./tools/serviceRestart.js";
import { register as speedtestResults } from "./tools/speedtestResults.js";
import { register as sshTest } from "./tools/sshTest.js";
import { register as systemdControl } from "./tools/systemdControl.js";
import { register as systemdServices } from "./tools/systemdServices.js";
import { register as ufwStatus } from "./tools/ufwStatus.js";
import { register as uptimeKumaStatus } from "./tools/uptimeKumaStatus.js";
import { register as volumeBackup } from "./tools/volumeBackup.js";

/**
 * Every MCP tool, keyed by its file name in src/tools (tool name
 * `homelab_<key>`). index.ts registers these and the tests read the same
 * map; registration.test.ts checks it matches the directory.
 */
export const TOOLS: Record<string, (server: McpServer) => void> = {
  adguardFilterToggle,
  adguardFilters,
  adguardQueryLog,
  adguardRewrites,
  adguardRewriteSet,
  adguardStats,
  alertList,
  alertSilence,
  alertSilences,
  aptHistory,
  aptUpdate,
  aptUpgradable,
  backupCheck,
  backupDiff,
  backupList,
  backupRestore,
  backupRun,
  backupStatus,
  certCheck,
  certList,
  certRenew,
  composeDown,
  composePs,
  composePull,
  composeUp,
  containerScan,
  diagnostics,
  diskUsage,
  fail2banStatus,
  grafanaSnapshot,
  grafanaImport,
  healthCheck,
  inventorySync,
  journalLogs,
  kernelInfo,
  logSearch,
  networkInfo,
  nodeExec,
  nodeList,
  nodeStatus,
  npmCerts,
  npmProxyHosts,
  ntfySend,
  ntfyTopics,
  openPorts,
  piReboot,
  piStatus,
  prometheusQuery,
  serviceHealth,
  serviceLogs,
  serviceRestart,
  speedtestResults,
  sshTest,
  systemdControl,
  systemdServices,
  ufwStatus,
  uptimeKumaStatus,
  volumeBackup,
};
