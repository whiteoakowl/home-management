/**
 * Every section of the app and its tabs, with what each does, for the public
 * Features page. Tab names match the app's own navigation.
 */
export type CatalogSection = { name: string; icon: string; summary: string; tabs: { name: string; does: string }[] };
export type CatalogGroup = { title: string; intro: string; sections: CatalogSection[] };

export const FEATURE_CATALOG: CatalogGroup[] = [
  {
    title: "Every day",
    intro: "The places your family checks every morning.",
    sections: [
      {
        name: "Home",
        icon: "LayoutDashboard",
        summary: "A dashboard for today that each person can arrange their own way.",
        tabs: [
          { name: "Today", does: "Chores and cleaning left today and what's overdue, today's events, weather and announcements." },
          { name: "Widgets", does: "Over 20 cards to add, remove and reorder: meals, shopping, goals, birthdays, budget and more." },
          { name: "Family activity", does: "See what everyone has finished and added lately." },
        ],
      },
      {
        name: "Calendar",
        icon: "CalendarDays",
        summary: "One calendar for the whole family, colour-coded by person, with privacy for every event.",
        tabs: [
          { name: "Month, Week, Day", does: "Named colour bars on the month view, full detail on the week and day views." },
          { name: "List", does: "Filter by person, category, type or colour, search, and pick any date range." },
          { name: "Categories & layers", does: "Show or hide chores, sports, dance, work shifts, meals, pets, trips, birthdays and more." },
          { name: "Print & PDF", does: "Print the month, week or a list, or save it as a PDF, with your family's name at the top." },
        ],
      },
      {
        name: "Family Chat",
        icon: "MessagesSquare",
        summary: "One group conversation for the whole family.",
        tabs: [
          { name: "All, Parents, Kids", does: "The whole family's chat, a private parents' chat, and a chat for the kids." },
          { name: "Announcements & Pinned", does: "Parents post announcements everyone sees; pin important messages to find them fast." },
          { name: "Photos, files, polls & events", does: "Share pictures and documents, run quick polls, and post calendar events as reminders." },
          { name: "Reactions & read receipts", does: "React with emoji, and see when your message has been read." },
        ],
      },
      {
        name: "Sports",
        icon: "Trophy",
        summary: "Teams, practices, games and stats for every athlete.",
        tabs: [
          { name: "This week", does: "Practices and games day by day, with arrival times and places." },
          { name: "Teams", does: "Each athlete's teams with season, position, jersey number, coach and win-loss record." },
          { name: "Games & results", does: "Scores, outcomes, what to bring and snack duty." },
          { name: "Stats", does: "Per-game stats for 13 sports (plus your own) with season totals, averages and bests." },
        ],
      },
      {
        name: "Dance",
        icon: "Music",
        summary: "Classes, teams and performances for each dancer.",
        tabs: [
          { name: "Weekly schedule", does: "Classes repeat every week and skip studio days off." },
          { name: "Performances & events", does: "Competitions, recitals, auditions and picture days with call times and costs." },
          { name: "Pointe shoes", does: "Track pairs, fittings and when to order the next pair." },
        ],
      },
      {
        name: "Work",
        icon: "Briefcase",
        summary: "Everyone's work shifts, week by week, on the family calendar.",
        tabs: [{ name: "Shifts", does: "Add one-off or repeating shifts so everyone knows who's home when." }],
      },
      {
        name: "Plans",
        icon: "Plane",
        summary: "Vacations, trips and big events in one place.",
        tabs: [
          { name: "Itinerary", does: "A day-by-day plan with a countdown." },
          { name: "Travel", does: "Flights, hotels and rental cars with confirmation numbers." },
          { name: "Budget", does: "Trip costs and a savings goal." },
        ],
      },
    ],
  },
  {
    title: "Home & household",
    intro: "Everything about the house and the people and animals in it.",
    sections: [
      {
        name: "Family",
        icon: "Users",
        summary: "Each person's own space, login and permissions.",
        tabs: [
          { name: "Member pages", does: "A personal portal for each person, with their photo album." },
          { name: "Manage", does: "Parents add members, set logins and reset passwords." },
          { name: "Permissions", does: "Choose what each person can see and change in every section." },
        ],
      },
      {
        name: "Contacts",
        icon: "Contact",
        summary: "The family address book.",
        tabs: [
          { name: "Groups", does: "Relatives, school, doctors, babysitters, neighbours, services and more." },
          { name: "Contact cards", does: "Tap to call, text or email; add addresses, notes and favourites." },
          { name: "Birthdays", does: "Upcoming birthdays, also shown on the calendar." },
        ],
      },
      {
        name: "Photo Albums",
        icon: "Images",
        summary: "Shared albums everyone can add to.",
        tabs: [{ name: "Albums", does: "Make an album for any trip or event and upload photos from any phone." }],
      },
      {
        name: "House",
        icon: "House",
        summary: "Chores, cleaning and the family's to-dos.",
        tabs: [
          { name: "Overview", does: "Today's progress for chores, cleaning and tasks at a glance." },
          { name: "Tasks", does: "One-off to-dos with due dates and owners." },
          { name: "Chores", does: "Repeating chores for one person, several people, or taking turns; everyone assigned earns the points." },
          { name: "Rewards", does: "Points earned for chores, rewards to cash them in for, and parent approval." },
          { name: "Cleaning", does: "Daily to annual cleaning, room by room, with cleanliness meters and checklists." },
          { name: "Important info", does: "Wi-Fi, alarm codes, shut-offs and account details, shared or private." },
        ],
      },
      {
        name: "Home Maintenance",
        icon: "Hammer",
        summary: "Keep the house in good shape and every record in one place.",
        tabs: [
          { name: "Rooms & systems", does: "Each room and system (HVAC, water heater, roof…) with its details." },
          { name: "Maintenance schedule", does: "Preventative jobs on a schedule, with costs and reminders." },
          { name: "Repair log", does: "Repairs with photos, costs and warranty dates." },
          { name: "Remodeling projects", does: "Projects in stages with materials that go straight to the shopping list." },
          { name: "To-do lists", does: "House jobs to get to." },
          { name: "Documents & warranties", does: "Manuals, receipts and warranties, with expiry reminders." },
          { name: "Home inventory", does: "Belongings with values and photos, and a report for insurance." },
          { name: "Service providers", does: "Plumbers, electricians and other pros you trust." },
          { name: "Household manual", does: "A printable guide to how your home works." },
        ],
      },
      {
        name: "Pool",
        icon: "Waves",
        summary: "Pool and spa care made simple.",
        tabs: [
          { name: "Water tests", does: "Log readings and see exactly what to add." },
          { name: "History", does: "Every test and treatment over time." },
        ],
      },
      {
        name: "Vehicles",
        icon: "Car",
        summary: "Every car's records and costs.",
        tabs: [{ name: "Vehicle profiles", does: "Mileage, maintenance due, repairs, parts and loan payoff." }],
      },
      {
        name: "Medical",
        icon: "HeartPulse",
        summary: "The family's health information, kept private.",
        tabs: [
          { name: "Family members", does: "A health profile for each person." },
          { name: "Allergies & food restrictions", does: "Flagged automatically in recipes and meal plans." },
          { name: "Conditions & medications", does: "With refill reminders." },
          { name: "Documents", does: "Private medical documents." },
          { name: "Medical calendar", does: "Appointments and refills in one view." },
        ],
      },
      {
        name: "Pets",
        icon: "PawPrint",
        summary: "Everything about your pets.",
        tabs: [
          { name: "Pet profiles", does: "Photos and details for every pet." },
          { name: "Medical records & preventatives", does: "Vet visits and flea, tick and heartworm reminders." },
          { name: "Food & supplies", does: "Running low adds them to the shopping list." },
          { name: "Care schedule", does: "Feeding, walks and grooming as shared chores." },
          { name: "Memories", does: "A timeline of favourite moments." },
        ],
      },
      {
        name: "Lists",
        icon: "ClipboardList",
        summary: "Any list your family needs.",
        tabs: [
          { name: "Lists", does: "Checklists, to-dos, bullet and numbered lists, private or shared." },
          { name: "Wishlists", does: "Everyone's gift wishlist, editable anytime. Others quietly mark what they're buying; the owner never sees it." },
        ],
      },
    ],
  },
  {
    title: "Family Pantry",
    intro: "Food from the cupboard to the table, with a private space for anyone who wants one.",
    sections: [
      {
        name: "Family Pantry",
        icon: "Refrigerator",
        summary: "Know what you have before you shop.",
        tabs: [
          { name: "Pantry, fridge & freezer", does: "Everything you have, with gentle expiry alerts." },
          { name: "Supplies", does: "Home, pet and craft supplies too." },
          { name: "Scan & receipts", does: "Scan barcodes or a grocery receipt to add items fast." },
          { name: "What can I cook?", does: "Recipes you can make now, and ideas to use things up." },
        ],
      },
      {
        name: "Family Recipes",
        icon: "BookOpen",
        summary: "Your family's recipe book.",
        tabs: [
          { name: "Recipes", does: "Import from a website, pasted text or Word documents." },
          { name: "Cook mode", does: "Step-by-step view with timers." },
          { name: "Collections", does: "Group recipes and print them as a book." },
        ],
      },
      {
        name: "Family Meal Plans",
        icon: "UtensilsCrossed",
        summary: "Plan the week in minutes.",
        tabs: [
          { name: "Week planner", does: "Breakfast to dinner, copy last week, print the plan." },
          { name: "Shopping from the plan", does: "Adds only what's missing from the pantry." },
        ],
      },
      {
        name: "Grocery Shopping",
        icon: "ShoppingBasket",
        summary: "Smart shopping lists.",
        tabs: [{ name: "Lists", does: "Grouped by aisle, with prices, totals and quick 'buy again'." }],
      },
    ],
  },
  {
    title: "Personal",
    intro: "Space for each person, private unless they choose to share.",
    sections: [
      {
        name: "Journal",
        icon: "NotebookPen",
        summary: "Private or shared entries.",
        tabs: [
          { name: "Today & timeline", does: "Write with moods, photos and tags, then look back over time." },
          { name: "Calendar & search", does: "Find any entry by date or word." },
        ],
      },
      {
        name: "Goals",
        icon: "Target",
        summary: "Goals from 6 months to 20 years out.",
        tabs: [
          { name: "Family", does: "Shared goals everyone can see." },
          { name: "My personal, savings & fitness", does: "Your own goals with milestones and projections; savings stay private." },
        ],
      },
      {
        name: "Fitness",
        icon: "Dumbbell",
        summary: "Workouts and progress.",
        tabs: [
          { name: "Workouts", does: "Log workouts and personal records." },
          { name: "Plans", does: "Weekly workout plans on the calendar." },
          { name: "Food journal", does: "A simple log of what you eat." },
        ],
      },
      {
        name: "Book Library",
        icon: "LibraryBig",
        summary: "Every book in the house.",
        tabs: [
          { name: "All books & currently reading", does: "Reading status, progress, ratings and notes." },
          { name: "Scan barcode / Add a book", does: "Scan with your phone's camera and details fill in." },
          { name: "Categories", does: "Your own shelves, with yearly reading stats." },
        ],
      },
      {
        name: "Personal Health",
        icon: "ShieldCheck",
        summary: "Private health tracking.",
        tabs: [
          { name: "Period tracker", does: "Simple tracking or ovulation estimates, private by default." },
          { name: "Food journal", does: "Day, week and month views." },
          { name: "Privacy Center", does: "Choose exactly who can see what." },
        ],
      },
      {
        name: "Mental Wellness",
        icon: "Smile",
        summary: "Gentle daily care.",
        tabs: [
          { name: "Check-ins", does: "A quick daily mood check with history." },
          { name: "Wellness journal", does: "Prompts, gratitude and self-care ideas." },
          { name: "Quotes & reminders", does: "Daily quotes and gentle reminders." },
        ],
      },
      {
        name: "Spiritual & faith",
        icon: "Moon",
        summary: "A tab for each person's religion or path: Spiritual, Christian, Catholic, Jewish, Hindu or Buddhist (pick several, or none).",
        tabs: [
          { name: "Today", does: "A daily verse or teaching, the church year, Hebrew date and Omer, Hindu tithi and Ekadashi, Uposatha days, and the saint and Rosary mysteries of the day." },
          { name: "Holidays", does: "Every holiday for the year with accurate dates; add your family's own days and show any religion's holidays on the family calendar." },
          { name: "Saints (Catholic)", does: "Feasts, memorials and holy days of obligation." },
          { name: "Reading", does: "Track the Bible, the Catholic Bible and Catechism, Torah portions and Tanakh, the Gita and Upanishads, the Dhammapada and sutras, or your own books, chapter by chapter." },
          { name: "Devotions & prayer", does: "A daily practice checklist with streaks (prayer, Mass, Rosary, puja, japa, meditation…) and a prayer list with answered prayers." },
          { name: "Journal", does: "A private devotional or study journal; share an entry with the family if you like." },
          { name: "Moon phases & Wheel of the Year", does: "Lunar calendar and seasonal celebrations." },
          { name: "Spells, rituals & grimoire", does: "Your own library, printable as a grimoire." },
          { name: "Crystals, herbs & tools", does: "References with safety notes." },
          { name: "Supplies", does: "Track what you have." },
        ],
      },
    ],
  },
  {
    title: "Money & reports",
    intro: "The household's finances and how things are going.",
    sections: [
      {
        name: "Budget",
        icon: "Wallet",
        summary: "Income, bills and spending at a glance.",
        tabs: [
          { name: "Overview", does: "This month against your limits, and your savings rate." },
          { name: "Transactions", does: "Every expense, with recurring bills." },
          { name: "Income", does: "Paychecks and other income." },
          { name: "Categories & limits", does: "Your categories and monthly limits; private money spaces for each person." },
        ],
      },
      {
        name: "Reports",
        icon: "ChartColumn",
        summary: "History and trends across the household.",
        tabs: [{ name: "Cleaning & chores, Garden, Farm, Pantry, Budget, Fitness, Goals", does: "30- and 90-day views for each area." }],
      },
    ],
  },
  {
    title: "Land",
    intro: "For families who grow food or keep animals.",
    sections: [
      {
        name: "Garden",
        icon: "Sprout",
        summary: "Plan, plant and harvest.",
        tabs: [
          { name: "Overview & bed planner", does: "Drag-and-drop garden beds." },
          { name: "Plantings & log", does: "What's growing where, and harvest totals." },
          { name: "Plant database", does: "Growing info for common plants." },
          { name: "Seeds", does: "Your seed inventory." },
        ],
      },
      {
        name: "Farm",
        icon: "Tractor",
        summary: "Animals and production records.",
        tabs: [
          { name: "Chores", does: "Feeding, watering and mucking out, assigned and on schedule." },
          { name: "Animals", does: "Animals and flocks with health records." },
          { name: "Feed", does: "Feed stock and orders." },
          { name: "Production", does: "Eggs, milk and more, with charts." },
          { name: "Farm map & sitter instructions", does: "A drag-and-drop map, and instructions for whoever looks after the farm while you're away." },
        ],
      },
    ],
  },
  {
    title: "Your account",
    intro: "Make the app yours.",
    sections: [
      {
        name: "Settings",
        icon: "Settings",
        summary: "Run by the account holder.",
        tabs: [
          { name: "Sections", does: "Turn whole sections on or off (no pool? no farm? hide them)." },
          { name: "Family name & colours", does: "Your family's name becomes the app's name on everyone's phone." },
          { name: "Subscription & billing", does: "Plan, card, receipts, switch monthly or yearly, or cancel, all in the app." },
        ],
      },
      {
        name: "Feedback & feature ideas",
        icon: "Sparkles",
        summary: "Tell us what you'd like next.",
        tabs: [{ name: "Suggest a feature", does: "Send ideas, report problems or write a review." }],
      },
    ],
  },
];
