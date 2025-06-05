import { datadogLogs } from "@datadog/browser-logs";

type Site =
  | "datadoghq.com"
  | "us3.datadoghq.com"
  | "us5.datadoghq.com"
  | "datadoghq.eu"
  | "ddog-gov.com"
  | "ap1.datadoghq.com";

datadogLogs.init({
  clientToken: process.env.NEXT_PUBLIC_DATADOG_RUM_CLIENT_TOKEN || "",
  site: (process.env.NEXT_PUBLIC_DD_HOST as Site) || "datadoghq.com",
  forwardErrorsToLogs: true,
  sessionSampleRate: 100,
  service: process.env.NEXT_PUBLIC_DD_SERVICE || "turbo-da",
  env: process.env.NEXT_PUBLIC_ENVIRONMENT || "local",
});

export class Logger {
  static info(message: string) {
    datadogLogs.logger.info(message);
    console.info(message);
  }

  static debug(message: string) {
    datadogLogs.logger.debug(message);
    console.debug(message);
  }

  static error(message: string) {
    datadogLogs.logger.error(message);
    // console.error(message);
  }
}
