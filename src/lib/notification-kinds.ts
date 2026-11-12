/** Every notification the app sends; members can mute each one. */
export const NOTIFICATION_KINDS = [
  { key: "chore_due", label: "Chores due", description: "Your chores for the day" },
  { key: "event_reminder", label: "Event reminders", description: "Events you're attending today" },
  { key: "food_expiring", label: "Food expiring", description: "Kitchen items expiring soon" },
  { key: "garden_task", label: "Garden", description: "Upcoming harvests" },
  { key: "farm_task", label: "Farm", description: "Animal care that's due" },
  { key: "goal_milestone", label: "Goal milestones", description: "When a goal reaches a milestone" },
  { key: "budget_alert", label: "Budget alerts", description: "Categories over their monthly limit (parents)" },
  { key: "fitness_reminder", label: "Workout reminders", description: "Workouts scheduled today" },
] as const;
