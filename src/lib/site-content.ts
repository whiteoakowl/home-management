/** Copy for the public website (kept in one place so pages stay consistent). */

export const HOME_HIGHLIGHTS = [
  { icon: "CalendarDays", title: "One family calendar", body: "Everyone's events, practices, classes, work shifts and trips, color-coded by person. Syncs with Google, Outlook and Apple calendars." },
  { icon: "ListChecks", title: "Chores that get done", body: "Assign chores to one person or several, repeat them on any schedule, and reward points everyone can cash in." },
  { icon: "UtensilsCrossed", title: "Meals without the stress", body: "Plan the week, keep your recipes, know what's in the pantry and build the shopping list automatically." },
  { icon: "Trophy", title: "Sports, dance & activities", body: "Teams, practices, games, recitals and stats for every kid, all on the calendar so nobody misses a pickup." },
  { icon: "MessagesSquare", title: "Family chat & memories", body: "Family group chats with push notifications, plus a year-by-year timeline of memories, milestones and photos." },
  { icon: "Gift", title: "Wishlists that keep the surprise", body: "Everyone keeps a gift wishlist. Family members quietly mark what they're buying, and the list owner never sees it." },
  { icon: "Wallet", title: "Budget & goals", body: "Bills, income, expenses and savings goals in one view, with private money spaces for each person." },
  { icon: "House", title: "Important Info & more", body: "A family binder of emergency contacts, doctors, school, insurance and Wi-Fi in one binder with a printable babysitter sheet, plus home, pets, health and more." },
] as const;

/** The Spiritual section's religion tabs, for the public website. */
export const FAITH_OPTIONS = [
  { emoji: "✝️", name: "Christian", does: "The church year, Easter and Christmas countdowns, the whole Bible, prayer requests and a devotional journal." },
  { emoji: "⛪", name: "Catholic", does: "Feasts, holy days of obligation, the saint of the day, the Rosary, the 73-book Bible and the Catechism." },
  { emoji: "✡️", name: "Jewish", does: "The Hebrew date, Shabbat, the Omer count, every holiday, weekly Torah portions and the Tanakh." },
  { emoji: "🕉️", name: "Hindu", does: "Festivals like Diwali and Holi, today's tithi, Ekadashi days, puja and japa, the Gita and Upanishads." },
  { emoji: "☸️", name: "Buddhist", does: "Vesak and Uposatha days, meditation minutes, the Five Precepts, the Dhammapada and the sutras." },
  { emoji: "🌙", name: "Spiritual", does: "Moon phases, the Wheel of the Year, rituals, a grimoire, crystals, herbs and daily practice." },
] as const;

export const FAITH_POINTS = [
  "Choose your family's religions and who gets each one",
  "Accurate holiday dates every year, on the family calendar",
  "Track your reading chapter by chapter",
  "A daily devotion checklist with streaks",
  "Prayer lists with answered prayers",
  "A private journal, shared only if you choose",
] as const;

export const PILLARS = [
  { title: "Everyone gets their own login", body: "Parents, teens and kids each sign in to see what matters to them, with permissions you control for every section." },
  { title: "Private when it should be", body: "Journals, savings, medical details and personal goals stay private. Share only what you choose." },
  { title: "It's your family's app", body: "Your family's name becomes the app's name on everyone's phone, in the colors you pick." },
  { title: "Only the sections you need", body: "No pool? No farm? Switch sections off and the app stays simple. Turn them back on anytime." },
] as const;

export const STEPS = [
  { title: "Create your family", body: "Sign up, name your family and pick your colors. It takes about two minutes." },
  { title: "Add everyone", body: "Add parents, kids and anyone else, with their own logins and the right permissions." },
  { title: "Install it on every phone", body: "Add it to the home screen on iPhone, Android, tablets and computers. It shows your family's name." },
] as const;

export const EXTRA_FEATURES = [
  "Own login for every family member",
  "Permissions per person and per section",
  "Your family's name as the app title on phones",
  "Custom family colors, plus personal themes",
  "Turn whole sections on or off",
  "Search everything",
  "Quick add from anywhere",
  "Push notifications for reminders and chat",
  "Syncs with Google, Outlook and Apple calendars",
  "Event templates and reminders at the time you choose",
  "Chore streaks that keep kids going",
  "Birthday and anniversary countdowns",
  "Works on phones, tablets and computers",
  "Installs on the home screen like an app",
  "Private spaces for each person",
  "Christian, Catholic, Jewish, Hindu and Buddhist holidays on the calendar",
  "Pregnancy Tracker that hands off to the Baby Tracker",
  "Sleep Sounds with a sleep timer and mixer",
  "Speak to add items to any list",
  "Printable babysitter forms for the kids",
  "Every storage area in one place",
  "Your data is never sold",
] as const;

export const FAQ = [
  { q: "Is there a free plan?", a: "Yes. The everyday family hub is free forever: the shared calendar, grocery list, chores, lists, Family Chat, contacts and Important Info, for up to 6 family members, plus Sleep Sounds, Mental Wellness and the Pregnancy Tracker. Premium unlocks every other section (including memories and photo albums, and the Period Tracker), plus calendar sync, reminders and unlimited members and lists." },
  { q: "How does the free trial work?", a: "Every new family gets Premium free for the first days, with no card needed. When the trial ends you move to the Free plan automatically, unless you choose Premium. If you choose a plan during the trial, your card is only charged when the trial ends." },
  { q: "What happens to our information on the Free plan?", a: "Nothing is deleted. Premium sections stay visible and view-only, and everything comes back the moment you upgrade." },
  { q: "Is the price per person?", a: "No. One Premium subscription covers your whole family, with as many family members and logins as you need." },
  { q: "Can kids use it?", a: "Yes. Kids can have their own login (or none, for little ones). You choose exactly which sections each person can see and change." },
  { q: "Does it work on iPhone and Android?", a: "Yes. It works in any modern browser and can be installed on the home screen of phones and tablets, where it shows up with your family's name." },
  { q: "Does it work with Google Calendar, Outlook or Apple Calendar?", a: "Yes. Each person can show the family calendar in Google Calendar, Outlook or Apple Calendar with one tap, and bring their own Google, Outlook or iCloud calendars into the family calendar. Everything stays in sync automatically." },
  { q: "Will I get notifications on my phone?", a: "Yes. Turn on push notifications on each phone or computer to get reminders and new chat messages, even when the app is closed. You choose what you get, and phones stay quiet overnight." },
  { q: "Does it support our faith?", a: "Yes. The Spiritual section has a tab for Christian, Catholic, Jewish, Hindu, Buddhist and spiritual families, with holidays, reading, devotions, prayer lists and a journal. Parents choose the religions the family uses and which members get each one, and those holidays can be shown on the family calendar." },
  { q: "Can I cancel anytime?", a: "Yes. Cancel from Account settings → Subscription. You keep Premium until the end of the period you've paid for, then your family moves to the Free plan." },
  { q: "What happens to our information?", a: "Your family's information belongs to you. It's only visible to the people in your family you share it with, and we never sell it." },
] as const;
