import dotenv from "dotenv";

dotenv.config({ path: ".env" });

export interface Config {
    port: number;
    debugLogging: boolean;
    cronJobExpression: string;
    abnormalDetectionCronJobExpression: string;
}

export const isDevMode = process.env.NODE_ENV == "development";

const config: Config = {
    port: +(process.env.PORT || 3000),
    debugLogging: isDevMode,
    cronJobExpression: "*/10 * * * * *", // every 10s
    abnormalDetectionCronJobExpression: "0 */10 * * * *", // every 10 minutes
};

export { config };