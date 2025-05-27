export type QuestStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "failed";

export interface Quest {
  id: string;
  title: string;
  description: string;
  status: QuestStatus;
  objectives?: string[];
}

export class QuestManager {
  private quests: Map<string, Quest> = new Map();

  addQuest(quest: Quest): void {
    this.quests.set(quest.id, quest);
  }

  getQuest(id: string): Quest | undefined {
    return this.quests.get(id);
  }

  getAllQuests(): Quest[] {
    return Array.from(this.quests.values());
  }

  updateQuestStatus(id: string, status: QuestStatus): void {
    const quest = this.quests.get(id);
    if (quest) {
      quest.status = status;
    }
  }
}
