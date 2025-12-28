export interface Repository {
  id: string;
  url: string;
  name: string;
  description?: string;
  enabled: boolean;
  scan_subdirs: boolean;
  added_at: string;
  last_scanned?: string;
}

export interface Skill {
  id: string;
  name: string;
  description?: string;
  repository_url: string;
  file_path: string;
  version?: string;
  author?: string;
  installed: boolean;
  installed_at?: string;
  local_path?: string;
  checksum?: string;
  security_score?: number;
  security_issues?: string[];
}

export enum SecurityLevel {
  Safe = "Safe",
  Low = "Low",
  Medium = "Medium",
  High = "High",
  Critical = "Critical",
}
