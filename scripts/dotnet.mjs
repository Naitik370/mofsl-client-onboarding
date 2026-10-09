import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Prefer the normal SDK; the local install allows development without machine-wide changes.
const installed = spawnSync('dotnet', ['--list-sdks'], { encoding: 'utf8', windowsHide: true });
const local =
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'mofsl-dotnet', 'dotnet.exe');
const executable =
  process.env.MOFSL_DOTNET ||
  (installed.stdout?.trim() ? 'dotnet' : local && existsSync(local) ? local : 'dotnet');
const result = spawnSync(executable, process.argv.slice(2), {
  stdio: 'inherit',
  windowsHide: true,
});
if (result.error)
  console.error('Install the .NET 10 SDK, or set MOFSL_DOTNET to its dotnet executable.');
process.exit(result.status ?? 1);
