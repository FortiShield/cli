import { execSync } from 'child_process';
import { getPackageManagerCommand } from '../../../../utils/package-manager';

export function setupIntegratedWorkspace(): void {
  const pmc = getPackageManagerCommand();
  execSync(`${pmc.exec} buildscale g @buildscale/angular:ng-add`, { stdio: [0, 1, 2] });
}
