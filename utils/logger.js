/**
 * Logger utility for production and development
 * In production, only errors are logged
 * In development, all logs are shown
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

class Logger {
    log(...args) {
        if (isDevelopment) {
            console.log(...args);
        }
    }

    error(...args) {
        // Always log errors, even in production
        console.error(...args);
    }

    warn(...args) {
        if (isDevelopment) {
            console.warn(...args);
        }
    }

    info(...args) {
        if (isDevelopment) {
            console.info(...args);
        }
    }

    debug(...args) {
        if (isDevelopment) {
            console.log('[DEBUG]', ...args);
        }
    }
}

export const logger = new Logger();
export default logger;
