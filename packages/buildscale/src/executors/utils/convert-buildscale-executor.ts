/**
 * This is a copy of the @buildscale/devkit utility but this should not be used outside of the buildscale package
 */

import type { Observable } from 'rxjs';
import { readBuildscaleJson } from '../../config/buildscale-json';
import { Executor, ExecutorContext } from '../../config/misc-interfaces';
import { retrieveProjectConfigurations } from '../../project-graph/utils/retrieve-workspace-files';
import { ProjectsConfigurations } from '../../config/workspace-json-project-json';
import { loadBuildscalePlugins } from '../../project-graph/plugins/internal-api';

/**
 * Convert an Buildscale Executor into an Angular Devkit Builder
 *
 * Use this to expose a compatible Angular Builder
 */
export function convertBuildscaleExecutor(executor: Executor) {
  const builderFunction = (options, builderContext) => {
    const promise = async () => {
      const buildscaleJsonConfiguration = readBuildscaleJson(builderContext.workspaceRoot);

      const [plugins, cleanup] = await loadBuildscalePlugins(
        buildscaleJsonConfiguration.plugins,
        builderContext.workspaceRoot
      );
      const projectsConfigurations: ProjectsConfigurations = {
        version: 2,
        projects: (
          await retrieveProjectConfigurations(
            plugins,
            builderContext.workspaceRoot,
            buildscaleJsonConfiguration
          )
        ).projects,
      };
      cleanup();
      const context: ExecutorContext = {
        root: builderContext.workspaceRoot,
        projectName: builderContext.target.project,
        targetName: builderContext.target.target,
        target: builderContext.target.target,
        configurationName: builderContext.target.configuration,
        workspace: { ...buildscaleJsonConfiguration, ...projectsConfigurations },
        projectsConfigurations,
        buildscaleJsonConfiguration,
        cwd: process.cwd(),
        projectGraph: null,
        taskGraph: null,
        isVerbose: false,
      };
      return executor(options, context);
    };
    return toObservable(promise());
  };
  return require('@angular-devkit/architect').createBuilder(builderFunction);
}

function toObservable<T extends { success: boolean }>(
  promiseOrAsyncIterator: Promise<T | AsyncIterableIterator<T>>
): Observable<T> {
  return new (require('rxjs') as typeof import('rxjs')).Observable(
    (subscriber) => {
      promiseOrAsyncIterator
        .then((value) => {
          if (!(value as any).next) {
            subscriber.next(value as T);
            subscriber.complete();
          } else {
            let asyncIterator = value as AsyncIterableIterator<T>;

            function recurse(iterator: AsyncIterableIterator<T>) {
              iterator
                .next()
                .then((result) => {
                  if (!result.done) {
                    subscriber.next(result.value);
                    recurse(iterator);
                  } else {
                    if (result.value) {
                      subscriber.next(result.value);
                    }
                    subscriber.complete();
                  }
                })
                .catch((e) => {
                  subscriber.error(e);
                });
            }

            recurse(asyncIterator);

            return () => {
              asyncIterator.return();
            };
          }
        })
        .catch((err) => {
          subscriber.error(err);
        });
    }
  );
}