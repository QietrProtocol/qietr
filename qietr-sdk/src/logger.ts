export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private readonly context: string;
  private readonly level: LogLevel;

  constructor(context: string, level: LogLevel = "info") {
    this.context = context;
    this.level = level;
  }

  child(sub: string): Logger {
    return new Logger(`${this.context}:${sub}`, this.level);
  }

  private log(level: LogLevel, message: string, meta?: unknown): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level]) return;
    const timestamp = new Date().toISOString();
    const metaStr = meta !== undefined ? ` ${JSON.stringify(meta)}` : "";
    const line = `[${timestamp}] [${level.toUpperCase()}] [${this.context}] ${message}${metaStr}`;
    switch (level) {
      case "error":
        console.error(line);
        break;
      case "warn":
        console.warn(line);
        break;
      default:
        console.log(line);
        break;
    }
  }

  debug(message: string, meta?: unknown): void {
    this.log("debug", message, meta);
  }
  info(message: string, meta?: unknown): void {
    this.log("info", message, meta);
  }
  warn(message: string, meta?: unknown): void {
    this.log("warn", message, meta);
  }
  error(message: string, meta?: unknown): void {
    this.log("error", message, meta);
  }
}
