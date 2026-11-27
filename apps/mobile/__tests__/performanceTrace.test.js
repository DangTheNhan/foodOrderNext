/* eslint-env jest */
import { getPerformance, trace } from '@react-native-firebase/perf';
import { withPerformanceTrace } from '../src/firebase/performanceTrace';

jest.mock('@react-native-firebase/perf', () => ({
  getPerformance: jest.fn(() => ({ setPerformanceCollectionEnabled: jest.fn().mockResolvedValue() })),
  trace: jest.fn(),
}));

const runtime = environment => ({ app: {}, config: { environment } });

test('local operations do not initialize Firebase Performance', async () => {
  await expect(withPerformanceTrace(runtime('emulator'), 'order_quote', () => 42)).resolves.toBe(42);
  expect(getPerformance).not.toHaveBeenCalled();
});

test('staging trace closes when an order quote fails and preserves the business error', async () => {
  getPerformance.mockReturnValue({ setPerformanceCollectionEnabled: jest.fn().mockResolvedValue() });
  const recording = { start: jest.fn(), stop: jest.fn() };
  trace.mockReturnValueOnce(recording);
  const failure = new Error('Quote failed');
  await expect(withPerformanceTrace(runtime('staging'), 'order_quote', async () => {
    expect(recording.start).toHaveBeenCalledTimes(1);
    throw failure;
  })).rejects.toBe(failure);
  expect(recording.stop).toHaveBeenCalledTimes(1);
});

test('an unavailable native trace does not interrupt a report request', async () => {
  trace.mockImplementationOnce(() => { throw new Error('Native trace unavailable'); });
  await expect(withPerformanceTrace(runtime('staging'), 'daily_report_first', async () => 'report'))
    .resolves.toBe('report');
});
