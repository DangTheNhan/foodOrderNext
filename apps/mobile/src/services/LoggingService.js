export class LoggingService {
  /**
   * Log errors centrally.
   * In production, this can be hooked up to Sentry, Crashlytics, DataDog, etc.
   */
  static error(context, error) {
    console.error(`[${context}] ERROR:`, error);
  }

  static info(context, message) {
    console.log(`[${context}] INFO:`, message);
  }

  static warn(context, message) {
    console.warn(`[${context}] WARN:`, message);
  }
}
