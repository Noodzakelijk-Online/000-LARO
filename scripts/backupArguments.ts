export interface BackupCliArguments {
  commandOrDestination?: string;
  file?: string;
  desktopSecretsPath?: string;
  allowLegacy: boolean;
}

export function parseBackupArguments(args: string[]): BackupCliArguments {
  const positional: string[] = [];
  let desktopSecretsPath: string | undefined;
  let allowLegacy = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--allow-legacy') {
      allowLegacy = true;
      continue;
    }
    if (argument === '--desktop-secrets') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--desktop-secrets requires a file path.');
      }
      desktopSecretsPath = value;
      index += 1;
      continue;
    }
    if (argument.startsWith('--') && argument !== '--restore' && argument !== '--validate') {
      throw new Error(`Unknown database-maintenance option: ${argument}`);
    }
    positional.push(argument);
  }

  return {
    commandOrDestination: positional[0],
    file: positional[1],
    desktopSecretsPath,
    allowLegacy,
  };
}
