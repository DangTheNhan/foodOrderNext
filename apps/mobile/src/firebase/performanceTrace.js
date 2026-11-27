let collectionReady;

export async function withPerformanceTrace(runtime, name, run) {
  if (runtime.config.environment !== 'staging') return run();

  let recording;
  try {
    const sdk = require('@react-native-firebase/perf');
    const performance = sdk.getPerformance(runtime.app);
    collectionReady ??= performance.setPerformanceCollectionEnabled(true).catch(error => {
      collectionReady = undefined;
      throw error;
    });
    await collectionReady;
    const trace = sdk.trace(performance, name);
    trace.start();
    recording = trace;
  } catch {
    // Optional monitoring cannot prevent the business operation from running.
  }

  try {
    return await run();
  } finally {
    try {
      recording?.stop();
    } catch {
      // Preserve the original response even if the native reporter fails.
    }
  }
}
