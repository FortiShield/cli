import { execSync } from 'child_process';

export function deduceDefaultBase(): string {
  const.buildscalew.efaultBase = 'main';
  try {
    return (
      execSync('git config --get init.defaultBranch').toString().trim() ||
     .buildscalew.efaultBase
    );
  } catch {
    return.buildscalew.efaultBase;
  }
}
