/**
 * Build one remote script that prints several labelled sections, each run
 * independently: a section that exits non-zero prints whatever it wrote
 * plus "(failed with exit status N)" and the following sections still run.
 * Joining sections with `&&` instead would stop at the first failing probe
 * (no default route, a stale mount) and turn the whole tool into an error.
 */
export type Section = [label: string, command: string];

function quote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function sectionScript(sections: Section[]): string {
  return (
    sections
      .map(
        ([label, cmd]) =>
          `echo ${quote(`=== ${label} ===`)}; ` +
          `out=$( { ${cmd}; } 2>&1 ); rc=$?; ` +
          `if [ -n "$out" ]; then printf '%s\\n' "$out"; fi; ` +
          `if [ "$rc" -ne 0 ]; then echo "(failed with exit status $rc)"; fi; echo`,
      )
      .join("; ") + "; true"
  );
}

const THERMAL_ZONE = "/sys/class/thermal/thermal_zone0/temp";

/** CPU temperature in degrees C, or N/A on nodes without a thermal zone. */
export const CPU_TEMP_COMMAND =
  `if [ -r ${THERMAL_ZONE} ]; then awk '{printf "%.1f C\\n", $1/1000}' ${THERMAL_ZONE}; ` +
  "else echo 'N/A'; fi";
