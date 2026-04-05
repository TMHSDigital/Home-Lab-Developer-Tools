export class SSHError extends Error {
  public readonly command?: string;

  constructor(message: string, command?: string) {
    super(message);
    this.name = "SSHError";
    this.command = command;
  }
}

export class SSHConnectionError extends SSHError {
  constructor(host: string) {
    super(`Cannot connect to ${host}. Verify the host is reachable and SSH is running.`);
    this.name = "SSHConnectionError";
  }
}

export class SSHAuthError extends SSHError {
  constructor() {
    super(
      "SSH authentication failed. Check your key path (HOMELAB_PI_KEY_PATH) and username (HOMELAB_PI_USER).",
    );
    this.name = "SSHAuthError";
  }
}

export class SSHTimeoutError extends SSHError {
  constructor(timeoutMs: number) {
    super(`SSH connection timed out after ${timeoutMs}ms.`);
    this.name = "SSHTimeoutError";
  }
}

export class CommandFailedError extends SSHError {
  public readonly exitCode: number;

  constructor(command: string, exitCode: number, stderr: string) {
    super(stderr.trim() || `Command exited with code ${exitCode}`, command);
    this.name = "CommandFailedError";
    this.exitCode = exitCode;
  }
}
