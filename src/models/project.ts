export interface Project {
  name: string;
  template?: string;
  services: Service[];
  deployments?: DeploymentTarget[];
  version?: string;
}

export interface Service {
  name: string;
  type: string;
  port: number;
  healthCheck?: string;
  dependencies?: string[];
  env?: Record<string, string>;
}

export interface DeploymentTarget {
  name: string;
  host: string;
  domain?: string;
  port?: number;
  user?: string;
  ssl?: SSLConfig;
}

export interface SSLConfig {
  enabled: boolean;
  provider?: 'letsencrypt' | 'manual';
  email?: string;
}

export interface Environment {
  name: string;
  variables: Record<string, string>;
}