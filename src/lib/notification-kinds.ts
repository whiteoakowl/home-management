/** Every notification the app sends; members can mute each one. */
export const NOTIFICATION_KINDS = [
  { key: "chat", label: "Family Chat", description: "New messages in your chats (phone & computer only)", pushOnly: true },
  { key: "chore_due", label: "Chores due", description: "Your chores for the day" },
  { key: "event_reminder", label: "Event reminders", description: "Events you're attending today" },
  { key: "food_expiring", label: "Food expiring", description: "Kitchen items expiring soon" },
  { key: "garden_task", label: "Garden", description: "Upcoming harvests" },
  { key: "farm_task", label: "Farm", description: "Animal care that's due" },
  { key: "goal_milestone", label: "Goal milestones", description: "When a goal reaches a milestone" },
  { key: "budget_alert", label: "Budget alerts", description: "Categories over their monthly limit (parents)" },
  { key: "fitness_reminder", label: "Workout reminders", description: "Workouts scheduled today" },
  { key: "medical_reminder", label: "Medical reminders", description: "Refills, follow-ups and expiring medical documents (patient & parents)" },
  { key: "pet_care", label: "Pet care", description: "Preventatives, vet visits and pet supplies" },
  { key: "craft_reminder", label: "Moon & sabbat reminders", description: "Upcoming sabbats, full and new moons, celebrations" },
  { key: "wellness_reminder", label: "Wellness check-ins", description: "Gentle reminders you set in Mental Wellness" },
  { key: "wellness_support", label: "Family support", description: "When a family member asks to talk" },
  { key: "maintenance_due", label: "Home maintenance", description: "Maintenance due, warranties expiring, project dates" },
] as const;
