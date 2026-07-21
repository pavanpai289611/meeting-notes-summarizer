export interface ActionItem {
  task: string;
  owner: string;
}

export interface Summary {
  keyDiscussionPoints: string[];
  decisionsMade: string[];
  actionItems: ActionItem[];
}

export interface SummaryRecord {
  id: string;
  createdAt: string; // ISO 8601
  inputText: string;
  summary: Summary;
}
