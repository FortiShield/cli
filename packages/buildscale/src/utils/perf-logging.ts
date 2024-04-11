import { PerformanceObserver } from 'perf_hooks';

if (process.env.BUILDSCALE_PERF_LOGGING === 'true') {
  const obs = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      console.log(`Time for '${entry.name}'`, entry.duration);
    }
  });
  obs.observe({ entryTypes: ['measure'] });
}
