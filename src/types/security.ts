export interface SecurityIssue {
  severity: string;
  category: string;
  description: string;
  line_number?: number;
  code_snippet?: string;
}

export interface SecurityReport {
  skill_id: string;
  score: number;
  level: string;
  issues: SecurityIssue[];
  recommendations: string[];
  blocked: boolean;
  hard_trigger_issues: string[];
}

export interface SkillScanResult {
  skill_id: string;
  skill_name: string;
  score: number;
  level: string;
  scanned_at: string;
  report: SecurityReport;
}
