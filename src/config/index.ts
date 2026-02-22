export interface AppConfig {
  port: number;
  accessTokenSecret: string;
  refreshTokenSecret: string;
  nodeEnv: string;
}

export function loadConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    accessTokenSecret: process.env.ACCESS_TOKEN_SECRET || 'dev-access-secret-change-in-production',
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'dev-refresh-secret-change-in-production',
    nodeEnv: process.env.NODE_ENV || 'development'
  };
}
