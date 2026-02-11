import { AppColors } from "@/constants/theme";
import { Task } from "@shared/schema";

export function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case "High":
      return AppColors.error;
    case "Medium":
      return AppColors.warning;
    case "Low":
      return AppColors.success;
    default:
      return AppColors.primary;
  }
}

export function findMatchingTask(taskTitle: string, tasks: Task[]): Task | null {
  const normalized = taskTitle.toLowerCase().trim();
  return tasks.find((t) => t.title.toLowerCase().trim() === normalized) || null;
}
