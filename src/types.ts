export type Category =
  "whatsapp" | "telephone" | "email" | "placeholder" | "accessible-name";
export type Severity = "error" | "warning" | "info";
export type FindingScope = "contact" | "general";
export type IntentSignal = "destination" | "label-or-context" | "none";
export interface Finding {
  id: number;
  category: Category;
  severity: Severity;
  link: string;
  explanation: string;
  fix: string;
  count: number;
  scope: FindingScope;
  intent: IntentSignal;
}
export interface ScanResult {
  findings: Finding[];
  inspected: number;
  truncated: boolean;
  frames: number;
  page: string;
  token: string;
}
