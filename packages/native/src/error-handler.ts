/**
 * Uncaught JS errors on React Native, routed through `reportError`.
 *
 *   installNativeErrorHandler();   // once, as early as the app starts
 *
 * It wraps `ErrorUtils.setGlobalHandler`: the error is reported first, then handed to the
 * handler that was there before with the same arguments, so the red screen in development and
 * the crash in production still happen. Installing twice adds nothing. It sends nothing: the
 * report goes to the reporter the app set (by default one development console line).
 * Crashes in native code (Hermes, Objective-C, Kotlin) are the platform's tools, not this.
 */
import { defaultErrorLog, wrapNativeHandler, type ErrorUtilsLike } from '@interlace/ui/error-report';

export function installNativeErrorHandler(
  utils: ErrorUtilsLike | undefined = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils,
): void {
  wrapNativeHandler(utils, defaultErrorLog);
}
