/**
 * Every section of the app and its tabs, with what each does, for the public
 * Features page. Tab names match the app's own navigation.
 */
export type CatalogSection = { name: string; /** Heading on the Features page, when different from the app name. */ title?: string; icon: string; summary: string; tabs: { name: string; does: string }[] };
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
          { name: "Event templates", does: "Set up \"Soccer practice, Tuesdays 5:30, Field 3, Jack, remind me an hour before\" once, then add the whole season in one tap." },
          { name: "Reminders", does: "Reminders at the time you choose (10 minutes to a week before), on your phone, for one-time and repeating events." },
          { name: "Sync", does: "See the family calendar in Google Calendar, Outlook or Apple Calendar, and bring your own Google, Outlook or iCloud calendars in." },
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
        name: "Travel",
        icon: "Plane",
        summary: "Everything about a trip in one place: \"Disney World, June 14–20\" with its itinerary, reservations, photos, expenses and notes. Part of Planning & Lists, with Goals, Lists and Party plans.",
        tabs: [
          { name: "Itinerary", does: "A day-by-day plan with a countdown; every stop and reservation also shows on the family calendar." },
          { name: "Travel & reservations", does: "Flights, hotels, rental cars, dinner reservations and park tickets with confirmation numbers." },
          { name: "Trip photos", does: "One shared album for the trip, so everyone's photos end up together." },
          { name: "Budget & expenses", does: "What you booked and what you spent, against the trip budget and a savings goal." },
        ],
      },
      {
        name: "Party Plans",
        icon: "PartyPopper",
        summary: "Plan birthday parties and celebrations from the first idea to the thank-you notes.",
        tabs: [
          { name: "Checklist", does: "A ready-made party checklist (invitations, cake, decorations, RSVPs) with due dates counted back from the party." },
          { name: "Guests & RSVPs", does: "The guest list with adults and kids, who's coming, and a headcount." },
          { name: "Food, decorations & supplies", does: "What to buy, what it costs, and one tap to put it on the shopping list." },
          { name: "Schedule & activities", does: "The party day hour by hour, plus games and who's running them." },
          { name: "Budget, gifts & thank-yous", does: "Spending against the budget, who gave what, and thank-you notes ticked off." },
        ],
      },
      {
        name: "Baby Tracker",
        icon: "Baby",
        summary: "Everything about the baby's day in one place, shared by parents, grandparents and sitters.",
        tabs: [
          { name: "Today", does: "One-tap diapers, nursing timers (with which side is next), sleep and tummy-time timers, and how long since the last feed, diaper and nap." },
          { name: "Feeding", does: "Breastfeeding, bottles (breast milk or formula), pumping and solid foods, with first tries and reactions." },
          { name: "History", does: "Every day's log and a week at a glance: feeds, ounces, diapers and hours of sleep." },
          { name: "Schedule", does: "The baby's daily routine (feeds, naps, bath, bedtime), starting from sample routines by age, with what's next." },
          { name: "Growth & health", does: "Weight, length and head size over time; temperatures with fever alerts, medicine, symptoms, vaccines and doctor visits." },
          { name: "Milestones", does: "Firsts and teeth with photos, and the milestones coming up for the baby's age." },
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
        name: "Memories & Photos",
        icon: "Images",
        summary: "Your family's story: memories, milestones and photos, year by year. Family-only and private.",
        tabs: [
          { name: "Timeline", does: "Every memory, milestone, album and trip on one year-by-year timeline, with search and an \"On this day\" look back." },
          { name: "Memories & milestones", does: "Write what happened, when and who was there, with photos; mark the big moments as milestones." },
          { name: "Albums", does: "Shared family albums, someone's own album, or a private one; photos sorted by when they were taken; videos too." },
          { name: "Comments, reactions & favorites", does: "React and comment on any photo or memory, keep favorites, and download originals." },
          { name: "Birthdays & anniversaries", does: "Countdowns with ages and years together, on the calendar, with reminders (never spoiling the birthday person's surprise)." },
        ],
      },
      {
        name: "House",
        icon: "House",
        summary: "Chores, cleaning and the family's to-dos.",
        tabs: [
          { name: "Overview", does: "Today's progress for chores, cleaning and tasks at a glance." },
          { name: "Tasks", does: "One-off to-dos with due dates and owners." },
          { name: "Chores", does: "Repeating chores for one person, several people, or taking turns; everyone assigned earns the points, with 🔥 streaks for chores done day after day." },
          { name: "Rewards", does: "Points earned for chores, rewards to cash them in for, and parent approval." },
          { name: "Cleaning", does: "Daily to annual cleaning, room by room, with cleanliness meters and checklists." },
          { name: "Important Info", does: "Your family binder: emergency contacts, important numbers, school, doctors, insurance, babysitter notes, household instructions, addresses, memberships and Wi-Fi (with a scan-to-join QR code), plus a one-page printable babysitter sheet. Everyone in the family can open it, and you choose who sees each entry." },
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
          { name: "All books", does: "Every book in the house, with ratings, notes and your own shelves." },
          { name: "Reading log", does: "Tap \"I'm reading this\" on any book to track pages, dates and notes. Share it, and the family sees what you're reading on your profile." },
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
        title: "Your faith, your way",
        icon: "Moon",
        summary: "A tab for each religion your family uses: Christian, Catholic, Jewish, Hindu, Buddhist or Spiritual. Parents choose who gets each one.",
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
        name: "Account settings",
        icon: "Settings",
        summary: "Run by the account holder.",
        tabs: [
          { name: "Sections", does: "Turn whole sections on or off (no pool? no farm? hide them)." },
          { name: "Religions", does: "Check the religions your family uses and choose which members get each one." },
          { name: "Download your data", does: "Download all your photos (in folders by album, memory and pet) and all your saved information as spreadsheets, anytime." },
          { name: "Family name & colours", does: "Your family's name becomes the app's name on everyone's phone." },
          { name: "Subscription & billing", does: "Plan, card, receipts, switch monthly or yearly, or cancel, all in the app." },
        ],
      },
      {
        name: "Notifications",
        icon: "Bell",
        summary: "Reminders in the app and on your phone.",
        tabs: [
          { name: "Push notifications", does: "Reminders and new Family Chat messages on phones and computers, even when the app is closed (iPhone, Android, Mac, Windows)." },
          { name: "Choose what you get", does: "Turn each kind of reminder on or off, in the app and as push, for each person." },
          { name: "Quiet hours", does: "Phones stay silent from 9pm to 7am; reminders come in the morning." },
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
