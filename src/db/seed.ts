/**
 * Demo data for the Vanderbilt family: `npm run db:seed`
 * Logins (password: vanderbilt123): sarah@vanderbilt.family (parent, owner),
 * michael@vanderbilt.family (parent), emma@vanderbilt.family (member).
 * Re-running replaces the demo family.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { CRAFT_REFERENCE } from "./craft-data";
import { referencePlantRows } from "./plant-data";
import * as s from "./schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: s });

const tz = "America/New_York";
const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const day = (n: number) => {
  const d = new Date(`${todayIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const at = (n: number, hh: number, mm = 0) => {
  // Eastern time ≈ UTC-5 (good enough for demo data)
  const d = new Date(`${day(n)}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00-05:00`);
  return d;
};
const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

async function main() {
  const emails = ["sarah@vanderbilt.family", "michael@vanderbilt.family", "emma@vanderbilt.family"];
  const old = await db.select().from(s.users).where(inArray(s.users.email, emails));
  if (old.length) {
    const members = await db.select().from(s.familyMembers).where(inArray(s.familyMembers.userId, old.map((u) => u.id)));
    const famIds = [...new Set(members.map((m) => m.familyId))];
    if (famIds.length) await db.delete(s.families).where(inArray(s.families.id, famIds));
    await db.delete(s.users).where(inArray(s.users.id, old.map((u) => u.id)));
  }
  const hash = await bcrypt.hash("vanderbilt123", 12);
  const [sarahU, michaelU, emmaU] = await db
    .insert(s.users)
    .values([
      { email: emails[0]!, name: "Sarah Vanderbilt", passwordHash: hash },
      { email: emails[1]!, name: "Michael Vanderbilt", passwordHash: hash },
      { email: emails[2]!, name: "Emma Vanderbilt", passwordHash: hash },
    ])
    .returning();

  const [fam] = await db
    .insert(s.families)
    .values({ name: "Vanderbilt", timezone: tz, locationName: "Asheville, NC", latitude: 35.5951, longitude: -82.5515, onboardingStep: 10, onboardingCompletedAt: new Date(), settings: { weekStartsOn: 0 } })
    .returning();
  const fid = fam!.id;
  const [sarah, michael, emma, jack] = await db
    .insert(s.familyMembers)
    .values([
      { familyId: fid, userId: sarahU!.id, displayName: "Sarah", role: "parent", color: "plum" },
      { familyId: fid, userId: michaelU!.id, displayName: "Michael", role: "parent", color: "olive" },
      { familyId: fid, userId: emmaU!.id, displayName: "Emma", role: "member", color: "lilac", birthday: "2014-04-18" },
      { familyId: fid, displayName: "Jack", role: "member", color: "wine", birthday: "2018-09-02" },
    ])
    .returning();
  await db.update(s.families).set({ ownerMemberId: sarah!.id }).where(eq(s.families.id, fid));
  // Emma: no budget/reports (defaults); Jack: hidden garden budget.
  await db.insert(s.memberPermissions).values(
    s.MODULES.map((m) => ({ memberId: jack!.id, module: m, level: (["budget", "reports", "journal"].includes(m) ? "none" : ["chores", "lists", "fitness", "goals"].includes(m) ? "edit" : "view") as "none" | "view" | "edit" })),
  );

  // ── House ──
  const rooms = await db.insert(s.rooms).values(["Kitchen", "Living room", "Bathroom", "Kids' rooms", "Laundry", "Garage", "Mudroom"].map((name, i) => ({ familyId: fid, name, sortOrder: i }))).returning();
  const room = (n: string) => rooms.find((r) => r.name === n)!.id;
  const choreCats = await db.insert(s.categories).values(["Kitchen", "Laundry", "Pets", "Outdoor", "Trash & recycling"].map((name, i) => ({ familyId: fid, domain: "chore" as const, name, sortOrder: i }))).returning();
  const rule = async (r: Omit<typeof s.recurrenceRules.$inferInsert, "familyId">) => (await db.insert(s.recurrenceRules).values({ ...r, familyId: fid }).returning())[0]!.id;
  const chore = async (c: Omit<typeof s.chores.$inferInsert, "familyId">, items: { text: string; assigneeId?: string }[] = []) => {
    const [row] = await db.insert(s.chores).values({ ...c, familyId: fid, createdByMemberId: sarah!.id }).returning();
    if (items.length) await db.insert(s.choreChecklistItems).values(items.map((it, i) => ({ choreId: row!.id, text: it.text, assigneeId: it.assigneeId ?? null, position: i })));
    return row!;
  };
  const kitchenReset = await chore({ title: "Kitchen reset", kind: "chore", roomId: room("Kitchen"), categoryId: choreCats[0]!.id, defaultAssigneeId: emma!.id, estimatedMinutes: 20, recurrenceRuleId: await rule({ freq: "daily", interval: 1, startsOn: day(-30) }) }, [{ text: "Load the dishwasher" }, { text: "Wipe the counters", assigneeId: jack!.id }, { text: "Sweep the floor" }]);
  const feedChickens = await chore({ title: "Feed & water the chickens", kind: "chore", categoryId: choreCats[2]!.id, defaultAssigneeId: jack!.id, estimatedMinutes: 10, recurrenceRuleId: await rule({ freq: "daily", interval: 1, startsOn: day(-30) }) });
  await chore({ title: "Take out trash & recycling", kind: "chore", categoryId: choreCats[4]!.id, defaultAssigneeId: michael!.id, recurrenceRuleId: await rule({ freq: "weekly", interval: 1, byWeekday: [1, 4], startsOn: day(-30) }) });
  await chore({ title: "Fold laundry", kind: "chore", roomId: room("Laundry"), categoryId: choreCats[1]!.id, defaultAssigneeId: emma!.id, recurrenceRuleId: await rule({ freq: "weekly", interval: 1, byWeekday: [6], startsOn: day(-30) }) });
  await chore({ title: "Bathroom clean", kind: "cleaning", cleaningCadence: "weekly", roomId: room("Bathroom"), defaultAssigneeId: sarah!.id, estimatedMinutes: 30, recurrenceRuleId: await rule({ freq: "weekly", interval: 1, byWeekday: [weekday(todayIso)], startsOn: day(-21) }) }, [{ text: "Scrub sink & toilet" }, { text: "Clean the mirror", assigneeId: emma!.id }, { text: "Mop the floor" }]);
  await chore({ title: "Kitchen deep clean", kind: "cleaning", cleaningCadence: "seasonal", roomId: room("Kitchen"), estimatedMinutes: 120, recurrenceRuleId: await rule({ freq: "yearly", interval: 1, byMonth: [3, 6, 9, 12], startsOn: day(5) }) }, [{ text: "Clean refrigerator" }, { text: "Clean oven" }, { text: "Wipe cabinets", assigneeId: emma!.id }, { text: "Clean pantry" }, { text: "Mop floor", assigneeId: michael!.id }, { text: "Clean windows" }]);
  await chore({ title: "Vacuum living room", kind: "cleaning", cleaningCadence: "daily", roomId: room("Living room"), defaultAssigneeId: michael!.id, recurrenceRuleId: await rule({ freq: "daily", interval: 1, startsOn: day(-10) }) });
  const [hvac, plumbing, roof] = await db
    .insert(s.rooms)
    .values([
      { familyId: fid, name: "HVAC", kind: "system", description: "Carrier heat pump (2019) · 16×25×1 filters", sortOrder: 20 },
      { familyId: fid, name: "Plumbing", kind: "system", description: "50-gal gas water heater (2017), main shut-off in the basement", sortOrder: 21 },
      { familyId: fid, name: "Roof & gutters", kind: "system", description: "Architectural shingles, replaced 2015", sortOrder: 22 },
      { familyId: fid, name: "Back yard", kind: "area", sortOrder: 30 },
    ])
    .returning();
  const filter = await chore({ title: "Replace HVAC filter", kind: "maintenance", roomId: hvac!.id, defaultAssigneeId: michael!.id, estimatedCostCents: 2500, recurrenceRuleId: await rule({ freq: "monthly", interval: 3, startsOn: day(3) }) });
  await chore({ title: "Clean gutters", kind: "maintenance", roomId: roof!.id, estimatedCostCents: 15000, recurrenceRuleId: await rule({ freq: "yearly", interval: 1, byMonth: [4, 11], startsOn: day(2) }) });
  await chore({ title: "Test smoke detectors", kind: "maintenance", recurrenceRuleId: await rule({ freq: "monthly", interval: 6, startsOn: day(12) }) });
  await chore({ title: "Flush water heater", kind: "maintenance", roomId: plumbing!.id, estimatedMinutes: 45, recurrenceRuleId: await rule({ freq: "yearly", interval: 1, startsOn: day(40) }) });
  await chore({ title: "Check for leaks under sinks", kind: "maintenance", roomId: plumbing!.id, estimatedMinutes: 10, recurrenceRuleId: await rule({ freq: "monthly", interval: 1, startsOn: day(6) }) });
  await db.insert(s.choreOccurrences).values({ familyId: fid, choreId: filter.id, dueDate: day(-88), status: "done", completedAt: at(-88, 10), completedByMemberId: michael!.id, actualCostCents: 2299 });
  await chore({ title: "Schedule furnace inspection", kind: "task", defaultAssigneeId: michael!.id, dueDate: day(-2), priority: "high" });
  await chore({ title: "Return library books", kind: "task", defaultAssigneeId: emma!.id, dueDate: day(1) });
  // Completed history for the past week.
  const occ: (typeof s.choreOccurrences.$inferInsert)[] = [];
  for (let i = 7; i >= 1; i--) {
    occ.push({ familyId: fid, choreId: kitchenReset.id, dueDate: day(-i), assigneeId: emma!.id, status: i === 3 ? "missed" : "done", completedAt: i === 3 ? null : at(-i, 19), completedByMemberId: i === 3 ? null : emma!.id });
    occ.push({ familyId: fid, choreId: feedChickens.id, dueDate: day(-i), assigneeId: jack!.id, status: "done", completedAt: at(-i, 7, 30), completedByMemberId: jack!.id });
  }
  await db.insert(s.choreOccurrences).values(occ);
  const [beds, porch] = await db
    .insert(s.homeProjects)
    .values([
      { familyId: fid, title: "Build raised garden beds", status: "in_progress", budgetCents: 40000, estimatedCostCents: 32000, startDate: day(-10), targetDate: day(20), ownerMemberId: michael!.id, description: "Three cedar beds along the south fence.", measurements: "Each bed 4 ft × 8 ft × 16 in" },
      { familyId: fid, title: "Paint the porch", status: "budgeting", budgetCents: 25000, targetDate: day(120), description: "Scrape, prime and paint the front porch floor and railings." },
      { familyId: fid, title: "Mudroom cubbies", status: "idea", roomId: room("Mudroom") },
    ])
    .returning();
  await db.insert(s.projectStages).values([
    { projectId: beds!.id, name: "Buy lumber & soil", done: true, position: 1, dueOn: day(-5) },
    { projectId: beds!.id, name: "Build the frames", position: 2, dueOn: day(2) },
    { projectId: beds!.id, name: "Fill & plant", position: 3, dueOn: day(20) },
    { projectId: porch!.id, name: "Get paint quotes", position: 1, dueOn: day(30) },
  ]);
  await db.insert(s.projectMaterials).values([
    { projectId: beds!.id, name: "Cedar 2×8 boards", quantity: "18", unit: "boards", estimatedCostCents: 21600, store: "Lumber yard", purchased: true },
    { projectId: beds!.id, name: "Raised bed soil", quantity: "2", unit: "cu yd", estimatedCostCents: 9000, store: "Garden center" },
    { projectId: beds!.id, name: "Deck screws 3 in", quantity: "1", unit: "box", estimatedCostCents: 1400 },
    { projectId: porch!.id, name: "Porch & floor paint", quantity: "3", unit: "gal", estimatedCostCents: 18000 },
  ]);
  await db.insert(s.homeRepairs).values([
    { familyId: fid, title: "Leaking kitchen faucet", roomId: room("Kitchen"), status: "completed", reportedOn: day(-45), completedOn: day(-40), problem: "Drip from the base of the spout.", repairPerformed: "Replaced the cartridge and O-rings.", contractor: "Blue Ridge Plumbing", costCents: 18500, warrantyInfo: "90-day labor warranty", warrantyExpiresOn: day(50), reportedByMemberId: sarah!.id },
    { familyId: fid, title: "Garage door sticks", roomId: room("Garage"), status: "scheduled", reportedOn: day(-6), scheduledOn: day(1), problem: "Door stops halfway when closing.", contractor: "Overhead Door Co.", reportedByMemberId: michael!.id },
  ]);
  await db.insert(s.homeDocuments).values([
    { familyId: fid, title: "Living room paint colors", docType: "paint", roomId: room("Living room"), notes: "Walls: Sherwin-Williams 'Grape Mist' SW 6556 (eggshell)\nTrim: 'Alabaster' SW 7008 (semi-gloss)", createdByMemberId: sarah!.id },
    { familyId: fid, title: "Heat pump warranty", docType: "warranty", roomId: hvac!.id, applianceName: "Carrier 25HCE4", expiresOn: day(25), notes: "10-year parts registration", createdByMemberId: michael!.id },
  ]);
  await db.insert(s.householdInfo).values([
    { familyId: fid, title: "Wi-Fi", body: "Network: Vanderbilt-Home\nPassword: sunflower-porch-42", createdByMemberId: sarah!.id },
    { familyId: fid, title: "Emergency contacts", body: "Plumber: Blue Ridge Plumbing 828-555-0134\nVet: Mountain Paws 828-555-0190\nPoison control: 1-800-222-1222", createdByMemberId: sarah!.id },
    { familyId: fid, title: "Alarm code", body: "4-7-1-9", visibility: "private", createdByMemberId: michael!.id },
  ]);

  // ── Calendar ──
  const calCats = await db
    .insert(s.categories)
    .values([["School", "orchid"], ["Work", "slate"], ["Appointments", "wine"], ["Activities", "lilac"], ["Household", "mauve"], ["Farm", "olive"], ["Garden", "khaki"], ["Fitness", "plum"], ["Meals", "khaki"]].map(([name, color], i) => ({ familyId: fid, domain: "calendar" as const, name: name!, color, sortOrder: i })))
    .returning();
  const cal = (n: string) => calCats.find((c) => c.name === n)!.id;
  const [doctor] = await db
    .insert(s.calendarEvents)
    .values({ familyId: fid, title: "Emma: doctor appointment", startsAt: at(1, 14, 30), endsAt: at(1, 15, 30), location: "Valley Pediatrics", categoryId: cal("Appointments"), visibility: "selected", reminderMinutes: 60, createdByMemberId: sarah!.id })
    .returning();
  await db.insert(s.recordAccess).values([{ familyId: fid, entityType: "event", entityId: doctor!.id, memberId: michael!.id }, { familyId: fid, entityType: "event", entityId: doctor!.id, memberId: emma!.id }]);
  const soccerRule = await rule({ freq: "weekly", interval: 1, byWeekday: [2, 4], startsOn: day(-20) });
  const events = await db
    .insert(s.calendarEvents)
    .values([
      { familyId: fid, title: "Soccer practice", startsAt: at(-20, 17), endsAt: at(-20, 18, 30), location: "Carrier Park", categoryId: cal("Activities"), recurrenceRuleId: soccerRule, createdByMemberId: sarah!.id },
      { familyId: fid, title: "Parent-teacher conference", startsAt: at(3, 16), endsAt: at(3, 16, 30), location: "Isaac Dickson Elementary", categoryId: cal("School"), createdByMemberId: sarah!.id },
      { familyId: fid, title: "Farrier visit", startsAt: at(5, 9), endsAt: at(5, 10), categoryId: cal("Farm"), createdByMemberId: michael!.id },
      { familyId: fid, title: "Grandma visits", startsAt: at(9, 0), allDay: true, categoryId: cal("Household"), createdByMemberId: sarah!.id },
      { familyId: fid, title: "Date night", startsAt: at(6, 19), endsAt: at(6, 22), visibility: "selected", createdByMemberId: michael!.id },
    ])
    .returning();
  await db.insert(s.recordAccess).values({ familyId: fid, entityType: "event", entityId: events[4]!.id, memberId: sarah!.id });
  await db.insert(s.eventAttendees).values([
    { eventId: doctor!.id, memberId: emma!.id },
    { eventId: doctor!.id, memberId: sarah!.id },
    { eventId: events[0]!.id, memberId: jack!.id },
    { eventId: events[1]!.id, memberId: sarah!.id },
    { eventId: events[2]!.id, memberId: michael!.id },
    { eventId: events[4]!.id, memberId: sarah!.id },
    { eventId: events[4]!.id, memberId: michael!.id },
  ]);

  // ── Kitchen ──
  const invCats = await db.insert(s.categories).values(["Baking", "Canned goods", "Dairy", "Produce", "Meat", "Cleaning supplies", "Paper goods"].map((name, i) => ({ familyId: fid, domain: "inventory" as const, name, sortOrder: i }))).returning();
  const ic = (n: string) => invCats.find((c) => c.name === n)!.id;
  const inv = await db
    .insert(s.inventoryItems)
    .values([
      { familyId: fid, name: "Eggs", quantity: "18", unit: "each", location: "fridge", categoryId: ic("Dairy"), expiresOn: day(12), lowStockThreshold: "6" },
      { familyId: fid, name: "Milk", quantity: "1", unit: "gal", location: "fridge", categoryId: ic("Dairy"), expiresOn: day(3) },
      { familyId: fid, name: "Butter", quantity: "2", unit: "stick", location: "fridge", categoryId: ic("Dairy"), expiresOn: day(30) },
      { familyId: fid, name: "Spinach", quantity: "1", unit: "bag", location: "fridge", categoryId: ic("Produce"), expiresOn: day(-1) },
      { familyId: fid, name: "Tomatoes", quantity: "1", unit: null, location: "fridge", categoryId: ic("Produce"), expiresOn: day(0) },
      { familyId: fid, name: "Bananas", quantity: "3", unit: null, location: "pantry", categoryId: ic("Produce"), expiresOn: day(2) },
      { familyId: fid, name: "Flour", quantity: "8", unit: "cup", location: "pantry", categoryId: ic("Baking"), expiresOn: day(200) },
      { familyId: fid, name: "Sugar", quantity: "4", unit: "cup", location: "pantry", categoryId: ic("Baking") },
      { familyId: fid, name: "Canned tomatoes", quantity: "4", unit: "can", location: "pantry", categoryId: ic("Canned goods"), expiresOn: day(400) },
      { familyId: fid, name: "Pasta", quantity: "2", unit: "box", location: "pantry", lowStockThreshold: "2" },
      { familyId: fid, name: "Ground beef", quantity: "2", unit: "lb", location: "freezer", categoryId: ic("Meat"), expiresOn: day(60) },
      { familyId: fid, name: "Frozen peas", quantity: "1", unit: "bag", location: "freezer" },
      { familyId: fid, name: "Paper towels", quantity: "2", unit: "roll", location: "supplies", categoryId: ic("Paper goods"), lowStockThreshold: "2" },
      { familyId: fid, name: "Dish soap", quantity: "1", unit: "bottle", location: "supplies", categoryId: ic("Cleaning supplies") },
    ])
    .returning();
  await db.insert(s.inventoryEvents).values(inv.map((i) => ({ familyId: fid, itemId: i.id, kind: "added" as const, quantityDelta: i.quantity, memberId: sarah!.id })));

  const recipeCats = await db.insert(s.categories).values(["Breakfast", "Lunch", "Dinner", "Sides", "Desserts"].map((name, i) => ({ familyId: fid, domain: "recipe" as const, name, sortOrder: i }))).returning();
  const rc = (n: string) => recipeCats.find((c) => c.name === n)!.id;
  const cols = await db.insert(s.recipeCollections).values(["Breakfast", "Dinner", "Desserts", "Holiday", "Family Favorites", "Slow Cooker", "Garden Recipes"].map((name) => ({ familyId: fid, name }))).returning();
  const col = (n: string) => cols.find((c) => c.name === n)!.id;
  const recipe = async (r: Omit<typeof s.recipes.$inferInsert, "familyId">, ings: [number | null, string | null, string, string][], collections: string[]) => {
    const [row] = await db.insert(s.recipes).values({ ...r, familyId: fid, createdByMemberId: sarah!.id }).returning();
    await db.insert(s.recipeIngredients).values(ings.map(([q, u, name, original], i) => ({ recipeId: row!.id, quantity: q === null ? null : String(q), unit: u, name, original, position: i })));
    if (collections.length) await db.insert(s.recipeCollectionItems).values(collections.map((c) => ({ collectionId: col(c), recipeId: row!.id })));
    return row!;
  };
  const parm = await recipe(
    { name: "Chicken Parmesan", description: "Crispy breaded chicken with marinara and melted mozzarella. A Tuesday-night favorite.", servings: 4, prepMinutes: 20, cookMinutes: 25, categoryId: rc("Dinner"), tags: ["kid-friendly", "family favorite"], isFavorite: true, instructions: ["Preheat oven to 400°F.", "Pound chicken to an even thickness.", "Dip in egg, then flour and breadcrumbs.", "Bake 20 minutes, top with sauce and cheese, bake 5 more."] },
    [[2, null, "eggs", "2 eggs"], [1, "cup", "flour", "1 cup flour"], [1, "lb", "chicken", "1 lb chicken breast"], [2, null, "tomatoes", "2 tomatoes, diced"], [1, "cup", "mozzarella", "1 cup shredded mozzarella"]],
    ["Dinner", "Family Favorites"],
  );
  const bread = await recipe(
    { name: "Grandma's banana bread", description: "Moist, simple and the best use for spotty bananas.", servings: 8, prepMinutes: 15, cookMinutes: 60, categoryId: rc("Desserts"), tags: ["baking"], isFavorite: true, instructions: ["Preheat oven to 350°F and grease a loaf pan.", "Mash bananas; stir in melted butter.", "Mix in sugar, egg and vanilla, then flour and baking soda.", "Bake 55–65 minutes."] },
    [[3, null, "bananas", "3 ripe bananas"], [0.33, "cup", "butter", "⅓ cup melted butter"], [0.75, "cup", "sugar", "¾ cup sugar"], [1, null, "eggs", "1 egg"], [1.5, "cup", "flour", "1½ cups flour"]],
    ["Desserts", "Family Favorites", "Holiday"],
  );
  const salad = await recipe(
    { name: "Garden harvest salad", description: "Whatever's ready in the garden, tossed with a lemon vinaigrette.", servings: 4, prepMinutes: 15, categoryId: rc("Sides"), tags: ["garden", "quick"], instructions: ["Wash and tear the greens.", "Slice tomatoes and cucumbers.", "Whisk lemon, olive oil, salt and pepper; toss."] },
    [[1, "bag", "spinach", "1 bag spinach"], [2, null, "tomatoes", "2 tomatoes"], [1, null, "cucumber", "1 cucumber"], [1, null, "lemon", "1 lemon"]],
    ["Garden Recipes"],
  );
  await db.insert(s.recipeRatings).values([{ recipeId: parm.id, memberId: emma!.id, rating: 5 }, { recipeId: parm.id, memberId: michael!.id, rating: 4 }, { recipeId: bread.id, memberId: jack!.id, rating: 5 }]);
  await db.insert(s.mealPlanEntries).values([
    { familyId: fid, date: day(0), slot: "dinner", recipeId: parm.id, servings: 4, createdByMemberId: sarah!.id },
    { familyId: fid, date: day(0), slot: "breakfast", title: "Oatmeal & berries", createdByMemberId: sarah!.id },
    { familyId: fid, date: day(1), slot: "dinner", title: "Tacos", createdByMemberId: sarah!.id },
    { familyId: fid, date: day(2), slot: "lunch", recipeId: salad.id, createdByMemberId: sarah!.id },
    { familyId: fid, date: day(3), slot: "dinner", title: "Leftovers", createdByMemberId: sarah!.id },
    { familyId: fid, date: day(4), slot: "breakfast", recipeId: bread.id, createdByMemberId: sarah!.id },
  ]);
  const [groceries] = await db.insert(s.lists).values({ familyId: fid, title: "Groceries", kind: "shopping", store: "Ingles", createdByMemberId: sarah!.id }).returning();
  await db.insert(s.listItems).values([
    { listId: groceries!.id, text: "Chicken", quantity: "1", unit: "lb", shoppingCategory: "meat", source: "recipe", sourceId: parm.id, position: 1 },
    { listId: groceries!.id, text: "Mozzarella", quantity: "1", unit: "cup", shoppingCategory: "dairy", source: "recipe", sourceId: parm.id, position: 2 },
    { listId: groceries!.id, text: "Tomatoes", quantity: "1", shoppingCategory: "produce", source: "meal_plan", position: 3 },
    { listId: groceries!.id, text: "Coffee", shoppingCategory: "pantry", position: 4 },
    { listId: groceries!.id, text: "Paper towels", unit: "roll", shoppingCategory: "household", source: "low_stock", sourceId: inv.find((i) => i.name === "Paper towels")!.id, position: 5 },
    { listId: groceries!.id, text: "Layer pellets", quantity: "50", unit: "lb", shoppingCategory: "farm", position: 6 },
  ]);
  const [todos] = await db.insert(s.lists).values({ familyId: fid, title: "Weekend to-dos", kind: "todo", createdByMemberId: sarah!.id }).returning();
  await db.insert(s.listItems).values([
    { listId: todos!.id, text: "Rake the front yard", assigneeId: michael!.id, dueDate: day(2), position: 1 },
    { listId: todos!.id, text: "Order Jack's birthday cake", assigneeId: sarah!.id, dueDate: day(4), priority: "high", position: 2 },
    { listId: todos!.id, text: "Fix bike tire", assigneeId: emma!.id, position: 3, checked: true, checkedAt: new Date() },
  ]);
  const [packing] = await db.insert(s.lists).values({ familyId: fid, title: "Lake trip packing", kind: "checklist", createdByMemberId: sarah!.id }).returning();
  await db.insert(s.listItems).values(["Swimsuits", "Sunscreen", "Fishing poles", "Life jackets", "Snacks for the car"].map((text, i) => ({ listId: packing!.id, text, position: i })));

  // ── Garden ──
  if (!(await db.select({ id: s.plants.id }).from(s.plants).where(isNull(s.plants.familyId)).limit(1)).length) {
    await db.insert(s.plants).values(referencePlantRows());
  }
  const allPlants = await db.select().from(s.plants);
  const P = (name: string) => allPlants.find((p) => p.name === name && p.familyId === null);
  const [plan] = await db
    .insert(s.gardenPlans)
    .values({
      familyId: fid,
      name: `${todayIso.slice(0, 4)} Garden Plan`,
      year: Number(todayIso.slice(0, 4)),
      notes: "Soil test (March): pH 6.4, low nitrogen. Added 2 in. compost to all beds.",
      layout: {
        width: 40, height: 30, unit: "ft", gridSize: 1,
        objects: [
          { key: "bed1", type: "bed", label: "Bed 1", x: 4, y: 4, w: 4, h: 10, rotation: 0, zIndex: 2 },
          { key: "bed2", type: "bed", label: "Bed 2", x: 11, y: 4, w: 4, h: 10, rotation: 0, zIndex: 2 },
          { key: "bed3", type: "bed", label: "Bed 3", x: 18, y: 4, w: 4, h: 10, rotation: 0, zIndex: 2 },
          { key: "path1", type: "path", label: "Main path", x: 4, y: 16, w: 26, h: 3, rotation: 0, zIndex: 1 },
          { key: "tree1", type: "tree", label: "Apple tree", x: 30, y: 3, w: 7, h: 7, rotation: 0, zIndex: 2 },
          { key: "irr1", type: "irrigation", label: "Drip line", x: 4, y: 14.6, w: 18, h: 0.3, rotation: 0, zIndex: 3 },
          { key: "shed", type: "structure", label: "Garden shed", x: 30, y: 20, w: 8, h: 6, rotation: 0, zIndex: 2 },
          { key: "fence1", type: "fence", label: "Fence", x: 1, y: 28, w: 38, h: 0.3, rotation: 0, zIndex: 3 },
        ],
      },
    })
    .returning();
  const planting = async (plant: string, bedKey: string, quantity: number, status: "planned" | "growing" | "harvesting", plantedDaysAgo: number | null, harvestIn: number | null) => {
    const p = P(plant);
    if (!p) return null;
    const [row] = await db
      .insert(s.gardenPlantings)
      .values({ familyId: fid, planId: plan!.id, bedKey, plantId: p.id, quantity, status, plantedOn: plantedDaysAgo === null ? null : day(-plantedDaysAgo), expectedHarvestOn: harvestIn === null ? null : day(harvestIn) })
      .returning();
    return row;
  };
  const tom = await planting("Tomato", "bed1", 4, "harvesting", 80, 2);
  await planting("Basil", "bed1", 6, "growing", 50, 10);
  await planting("Marigold", "bed1", 4, "growing", 50, null);
  await planting("Carrot", "bed2", 30, "growing", 40, 25);
  await planting("Onion", "bed2", 20, "growing", 60, 40);
  const lettuce = await planting("Lettuce", "bed2", 12, "harvesting", 45, 0);
  await planting("Garlic", "bed3", 24, "planned", null, null);
  if (tom && lettuce) {
    await db.insert(s.gardenLogs).values([
      { familyId: fid, plantingId: tom.id, plantId: tom.plantId, kind: "harvest", date: day(-6), quantity: "3.5", unit: "lb", memberId: michael!.id },
      { familyId: fid, plantingId: tom.id, plantId: tom.plantId, kind: "harvest", date: day(-2), quantity: "2", unit: "lb", memberId: emma!.id },
      { familyId: fid, plantingId: lettuce.id, plantId: lettuce.plantId, kind: "harvest", date: day(-1), quantity: "4", unit: "head", memberId: sarah!.id },
      { familyId: fid, plantingId: tom.id, plantId: tom.plantId, kind: "pest", date: day(-9), notes: "Hornworms on two plants. Picked off and fed to the chickens.", memberId: michael!.id },
      { familyId: fid, plantId: P("Garlic")?.id ?? null, kind: "note", date: day(-3), notes: "Garlic cloves arrived. Plant after first frost.", memberId: sarah!.id },
    ]);
  }
  await db.insert(s.seedInventory).values([
    { familyId: fid, name: "Sungold cherry tomato", plantId: P("Cherry tomato")?.id ?? null, quantity: "1 packet", source: "Baker Creek", packedFor: todayIso.slice(0, 4) },
    { familyId: fid, name: "Saved zinnia seeds", plantId: P("Zinnia")?.id ?? null, quantity: "~200", source: "Saved" },
  ]);

  // ── Farm ──
  const [flock, goats] = await db
    .insert(s.animals)
    .values([
      { familyId: fid, name: "Layer flock", species: "Chicken", breed: "Buff Orpington & Australorp", sex: "female", groupName: "Layers", headCount: 12, acquiredOn: day(-400), feed: "16% layer pellets" },
      { familyId: fid, name: "Daisy & Clover", species: "Goat", breed: "Nigerian Dwarf", sex: "female", headCount: 2, birthDate: day(-900), feed: "Hay + goat ration" },
      { familyId: fid, name: "Bees", species: "Bee", groupName: "Hive 1", headCount: 1, acquiredOn: day(-500) },
    ])
    .returning();
  await db.insert(s.animalHealthRecords).values([
    { animalId: goats!.id, date: day(-170), kind: "Hoof trim", nextDueOn: day(4) },
    { animalId: goats!.id, date: day(-60), kind: "Deworming", nextDueOn: day(30) },
    { animalId: flock!.id, date: day(-30), kind: "Vet visit", description: "Annual flock check. All healthy." },
  ]);
  await db.insert(s.productionLogs).values([
    ...Array.from({ length: 30 }, (_, i) => ({ familyId: fid, animalId: flock!.id, kind: "eggs" as const, date: day(-i), quantity: String(7 + ((i * 7) % 5)), unit: "each", memberId: jack!.id })),
    ...Array.from({ length: 14 }, (_, i) => ({ familyId: fid, animalId: goats!.id, kind: "milk" as const, date: day(-i), quantity: String(0.5 + (i % 3) * 0.1), unit: "gal", memberId: michael!.id })),
  ]);
  await db.insert(s.feedLogs).values([
    { familyId: fid, animalId: flock!.id, date: day(-12), feed: "Layer pellets", quantity: "50", unit: "lb", costCents: 2399 },
    { familyId: fid, animalId: goats!.id, date: day(-10), feed: "Hay", quantity: "4", unit: "bale", costCents: 4800 },
  ]);
  await db.insert(s.farmPlans).values({
    familyId: fid,
    name: "Homestead map",
    layout: {
      width: 300, height: 200, unit: "ft", gridSize: 5,
      objects: [
        { key: "pasture", type: "pasture", label: "Goat pasture", x: 10, y: 10, w: 120, h: 80, rotation: 0, zIndex: 0 },
        { key: "barn", type: "barn", label: "Barn", x: 140, y: 20, w: 40, h: 30, rotation: 0, zIndex: 2 },
        { key: "coop", type: "coop", label: "Coop", x: 200, y: 25, w: 12, h: 8, rotation: 0, zIndex: 2 },
        { key: "run", type: "run", label: "Chicken run", x: 195, y: 35, w: 30, h: 25, rotation: 0, zIndex: 1 },
        { key: "garden", type: "garden", label: "Kitchen garden", x: 150, y: 110, w: 40, h: 30, rotation: 0, zIndex: 1 },
        { key: "pond", type: "water", label: "Pond", x: 40, y: 120, w: 30, h: 20, rotation: 0, zIndex: 1 },
        { key: "fence", type: "fence", label: "Pasture fence", x: 10, y: 92, w: 120, h: 0.5, rotation: 0, zIndex: 3 },
        { key: "gate", type: "gate", label: "Gate", x: 128, y: 50, w: 8, h: 0.8, rotation: 90, zIndex: 4 },
      ],
    },
  });

  // ── Personal ──
  await db.insert(s.journalEntries).values([
    { familyId: fid, authorMemberId: sarah!.id, date: day(-1), title: "First frost", body: "Woke up to frost on the garden this morning. Jack ran out in his pajamas to see the ‘sparkly lettuce’. We harvested the last of the tomatoes before it got colder.", mood: "grateful", tags: ["garden", "kids"], visibility: "family" },
    { familyId: fid, authorMemberId: sarah!.id, date: day(-3), title: null, body: "Long day. Feeling stretched thin, but dinner together helped.", mood: "tired", tags: [], visibility: "private" },
    { familyId: fid, authorMemberId: emma!.id, date: day(-2), title: "Soccer win!", body: "We won 3–1 and I scored a goal!!", mood: "excited", tags: ["soccer"], visibility: "family" },
  ]);
  const [emergency] = await db
    .insert(s.goals)
    .values([
      { familyId: fid, kind: "savings", horizon: "1y", name: "Emergency fund", targetCents: 1000000, currentCents: 420000, monthlyContributionCents: 50000, targetDate: day(330) },
      { familyId: fid, kind: "savings", horizon: "6m", name: "Beach vacation", targetCents: 300000, currentCents: 130000, monthlyContributionCents: 25000, targetDate: day(180) },
      { familyId: fid, kind: "savings", horizon: "5y", name: "Farm truck", targetCents: 2500000, currentCents: 380000, monthlyContributionCents: 30000 },
      { familyId: fid, kind: "family", horizon: "1y", name: "Read 100 books together", targetValue: "100", currentValue: "37", unit: "books" },
      { familyId: fid, ownerMemberId: michael!.id, kind: "fitness", horizon: "6m", name: "Run a 5K", targetValue: "5", currentValue: "3", unit: "km" },
    ])
    .returning();
  await db.insert(s.goalMilestones).values([
    { goalId: emergency!.id, title: "First $2,500", targetCents: 250000, achievedAt: new Date(), position: 0 },
    { goalId: emergency!.id, title: "Halfway", targetCents: 500000, position: 1 },
  ]);
  await db.insert(s.goalContributions).values(
    [1, 2, 3].map((m) => ({ goalId: emergency!.id, date: day(-30 * m), amountCents: 50000, notes: "Monthly savings", memberId: sarah!.id })),
  );
  const [mPlan] = await db.insert(s.fitnessPlans).values({ familyId: fid, memberId: michael!.id, name: "Couch to 5K + strength", startsOn: day(-28) }).returning();
  const strengthRule = await rule({ freq: "weekly", interval: 1, byWeekday: [1, 4], startsOn: day(-28) });
  const runRule = await rule({ freq: "weekly", interval: 1, byWeekday: [2, 6], startsOn: day(-28) });
  const [strength] = await db
    .insert(s.workouts)
    .values([
      { planId: mPlan!.id, name: "Strength", focus: "Full body", recurrenceRuleId: strengthRule, position: 0 },
      { planId: mPlan!.id, name: "Run", focus: "Intervals", recurrenceRuleId: runRule, position: 1 },
    ])
    .returning();
  await db.insert(s.workoutExercises).values([
    { workoutId: strength!.id, name: "Goblet squat", sets: 3, reps: 10, videoUrl: "https://www.youtube.com/results?search_query=goblet+squat", position: 0 },
    { workoutId: strength!.id, name: "Push-up", sets: 3, reps: 12, position: 1 },
    { workoutId: strength!.id, name: "Deadlift", sets: 3, reps: 5, position: 2 },
  ]);
  await db.insert(s.workoutLogs).values(
    [-2, -4, -7, -9, -11, -14].map((d, i) => ({ familyId: fid, memberId: michael!.id, workoutId: i % 2 ? null : strength!.id, date: day(d), title: i % 2 ? "Run" : "Strength", durationMinutes: 30 + i * 3, effort: 3 })),
  );
  await db.insert(s.personalRecords).values({ memberId: michael!.id, exercise: "Deadlift", value: "225", unit: "lb", achievedOn: day(-4) });
  await db.insert(s.bodyMetrics).values([0, 7, 14, 21, 28, 35].map((d, i) => ({ memberId: michael!.id, date: day(-d), metric: "weight", value: String(196 + i * 0.8), unit: "lb" })));
  await db.insert(s.foodJournalEntries).values([
    { familyId: fid, memberId: michael!.id, date: day(0), slot: "breakfast", food: "Oatmeal & berries" },
    { familyId: fid, memberId: michael!.id, date: day(0), slot: "lunch", food: "Turkey sandwich, apple" },
  ]);

  // ── Budget ──
  const budgetCats = await db
    .insert(s.categories)
    .values(["Mortgage/Rent", "Utilities", "Groceries", "Transportation", "Insurance", "Kids & school", "Medical", "Entertainment", "Farm", "Garden"].map((name, i) => ({ familyId: fid, domain: "budget" as const, name, sortOrder: i })))
    .returning();
  const bc = (n: string) => budgetCats.find((c) => c.name === n)!.id;
  await db.insert(s.budgetLimits).values(
    ([["Mortgage/Rent", 185000, 1], ["Utilities", 32000, 1], ["Insurance", 28000, 1], ["Groceries", 90000, 0], ["Transportation", 30000, 0], ["Entertainment", 20000, 0], ["Farm", 25000, 0], ["Kids & school", 25000, 0]] as const).map(([n, c, bill]) => ({ familyId: fid, categoryId: bc(n), effectiveFrom: `${todayIso.slice(0, 7)}-01`, monthlyCents: c, isBill: bill })),
  );
  const [salary, side] = await db
    .insert(s.incomeSources)
    .values([
      { familyId: fid, name: "Michael: county extension office", amountCents: 240000, frequency: "biweekly", memberId: michael!.id },
      { familyId: fid, name: "Sarah: freelance design", amountCents: 150000, frequency: "monthly", memberId: sarah!.id },
      { familyId: fid, name: "Egg & honey sales", amountCents: 12000, frequency: "monthly" },
    ])
    .returning();
  const mortgageRule = await rule({ freq: "monthly", interval: 1, byMonthDay: [1], startsOn: `${day(-150).slice(0, 7)}-01` });
  const txns: (typeof s.transactions.$inferInsert)[] = [];
  for (let m = 5; m >= 0; m--) {
    const first = new Date(`${todayIso.slice(0, 7)}-01T12:00:00Z`);
    first.setUTCMonth(first.getUTCMonth() - m);
    const ym = first.toISOString().slice(0, 7);
    const d = (dd: number) => `${ym}-${String(dd).padStart(2, "0")}`;
    const ok = (dd: number) => d(dd) <= todayIso;
    if (ok(1)) txns.push({ familyId: fid, kind: "expense", name: "Mortgage", amountCents: 185000, date: d(1), categoryId: bc("Mortgage/Rent"), recurrenceRuleId: mortgageRule });
    if (ok(5)) txns.push({ familyId: fid, kind: "income", name: "Paycheck", amountCents: 240000, date: d(5), incomeSourceId: salary!.id, memberId: michael!.id });
    if (ok(19)) txns.push({ familyId: fid, kind: "income", name: "Paycheck", amountCents: 240000, date: d(19), incomeSourceId: salary!.id, memberId: michael!.id });
    if (ok(10)) txns.push({ familyId: fid, kind: "income", name: "Design client", amountCents: 150000 + m * 9000, date: d(10), incomeSourceId: side!.id, memberId: sarah!.id });
    if (ok(8)) txns.push({ familyId: fid, kind: "expense", name: "Electric & water", amountCents: 28000 + m * 1200, date: d(8), categoryId: bc("Utilities") });
    if (ok(12)) txns.push({ familyId: fid, kind: "expense", name: "Car & home insurance", amountCents: 27500, date: d(12), categoryId: bc("Insurance") });
    for (const [dd, amt] of [[3, 18450], [10, 21230], [17, 16380], [24, 23120]] as const) if (ok(dd)) txns.push({ familyId: fid, kind: "expense", name: "Groceries", amountCents: amt + m * 700, date: d(dd), categoryId: bc("Groceries") });
    if (ok(14)) txns.push({ familyId: fid, kind: "expense", name: "Gas", amountCents: 14200, date: d(14), categoryId: bc("Transportation") });
    if (ok(20)) txns.push({ familyId: fid, kind: "expense", name: "Feed store", amountCents: 7200, date: d(20), categoryId: bc("Farm") });
    if (ok(22)) txns.push({ familyId: fid, kind: "expense", name: "Movie night", amountCents: 6400, date: d(22), categoryId: bc("Entertainment") });
    if (ok(25)) txns.push({ familyId: fid, kind: "savings_transfer", name: "Monthly savings", amountCents: 50000, date: d(25), goalId: emergency!.id });
  }
  await db.insert(s.transactions).values(txns);

  // ── Medical ──
  await db.insert(s.medicalProfiles).values([
    { familyId: fid, memberId: sarah!.id, createdByMemberId: sarah!.id, fullName: "Sarah Anne Vanderbilt", primaryPhysician: "Dr. Priya Patel · Valley Family Medicine · 828-555-0101", dentist: "Blue Ridge Dental · 828-555-0144", emergencyContacts: "Michael Vanderbilt · 828-555-0199", insuranceProvider: "Mountain Health Plan", insurancePolicy: "MHP-448-221", insuranceGroup: "G-7781" },
    { familyId: fid, memberId: emma!.id, createdByMemberId: sarah!.id, fullName: "Emma Rose Vanderbilt", primaryPhysician: "Dr. Lena Ortiz · Asheville Pediatrics · 828-555-0130", specialists: "Allergist: Dr. Kim · 828-555-0120", emergencyContacts: "Sarah · 828-555-0198\nMichael · 828-555-0199", insuranceProvider: "Mountain Health Plan", insurancePolicy: "MHP-448-223" },
  ]);
  await db.insert(s.allergies).values([
    { familyId: fid, memberId: emma!.id, createdByMemberId: sarah!.id, name: "Peanuts", type: "food", severity: "severe", identifiedOn: "2019-05-02", triggers: ["peanut", "peanut butter", "groundnut"], symptoms: "Hives, swelling", emergencyInstructions: "Follow the allergy action plan from Dr. Kim. Epinephrine auto-injector is in the kitchen drawer and Emma's backpack. Call 911.", visibility: "family" },
    { familyId: fid, memberId: michael!.id, createdByMemberId: michael!.id, name: "Ragweed pollen", type: "seasonal", severity: "mild", symptoms: "Sneezing, itchy eyes in late summer" },
  ]);
  await db.insert(s.foodRestrictions).values([
    { familyId: fid, memberId: jack!.id, createdByMemberId: sarah!.id, kind: "intolerance", title: "Lactose intolerance", foods: ["milk", "cream", "ice cream", "cheese"], notes: "Lactose-free milk is fine.", visibility: "family" },
  ]);
  const [asthma] = await db
    .insert(s.medicalConditions)
    .values({ familyId: fid, memberId: jack!.id, createdByMemberId: sarah!.id, name: "Mild asthma", diagnosedOn: "2022-02-10", physician: "Dr. Lena Ortiz", followUpOn: day(18), symptoms: "Coughing with colds or hard exercise", treatmentNotes: "Follow the asthma action plan from Dr. Ortiz." })
    .returning();
  await db.insert(s.medications).values([
    { familyId: fid, memberId: jack!.id, createdByMemberId: sarah!.id, name: "Rescue inhaler", prescriber: "Dr. Lena Ortiz", dosage: "As prescribed", frequency: "As needed, per action plan", pharmacy: "Blue Ridge Pharmacy", refillsRemaining: 2, nextRefillOn: day(2), conditionId: asthma!.id },
    { familyId: fid, memberId: michael!.id, createdByMemberId: michael!.id, name: "Seasonal allergy tablet", prescriber: "Dr. Priya Patel", dosage: "As prescribed", frequency: "Daily in allergy season", pharmacy: "Blue Ridge Pharmacy", refillsRemaining: 5, nextRefillOn: day(21) },
  ]);
  const [appt] = await db
    .insert(s.calendarEvents)
    .values({ familyId: fid, title: "Allergist check-up", location: "Dr. Kim · Asheville Allergy", startsAt: at(9, 15, 30), endsAt: at(9, 16, 30), reminderMinutes: 1440, visibility: "selected", source: "medical", sourceId: emma!.id, createdByMemberId: sarah!.id, description: "Ask about the updated action plan for school." })
    .returning();
  await db.insert(s.eventAttendees).values({ eventId: appt!.id, memberId: emma!.id });
  await db.insert(s.recordAccess).values([sarah!.id, emma!.id].map((memberId) => ({ familyId: fid, entityType: "event" as const, entityId: appt!.id, memberId })));

  // ── Pets ──
  const [biscuit, pepper] = await db
    .insert(s.pets)
    .values([
      { familyId: fid, name: "Biscuit", species: "dog", breed: "Golden retriever", sex: "male_neutered", birthday: "2020-06-14", adoptedOn: "2020-08-20", colorMarkings: "Golden, white blaze on chest", weight: "68", weightUnit: "lb", microchipNumber: "985112004455667", microchipCompany: "HomeAgain", veterinarian: "Blue Ridge Animal Hospital", vetPhone: "828-555-0175", caretakerMemberId: michael!.id, personality: "Gentle, goofy, afraid of the vacuum.", favoriteThings: "Tennis balls, creek walks, peanut-free biscuits" },
      { familyId: fid, name: "Pepper", species: "cat", breed: "Domestic shorthair", sex: "female_spayed", birthday: "2019-03-01", adoptedOn: "2019-05-11", colorMarkings: "Black with white socks", weight: "9.5", weightUnit: "lb", veterinarian: "Blue Ridge Animal Hospital", vetPhone: "828-555-0175", caretakerMemberId: emma!.id, personality: "Independent, loves sunny windowsills." },
    ])
    .returning();
  await db.insert(s.petPreventatives).values([
    { petId: biscuit!.id, kind: "heartworm", productName: "Monthly heartworm chewable", lastGivenOn: day(-29), intervalDays: 30, nextDueOn: day(1), assigneeId: michael!.id },
    { petId: biscuit!.id, kind: "flea_tick", productName: "Flea & tick chew", lastGivenOn: day(-80), intervalDays: 90, nextDueOn: day(10), assigneeId: michael!.id },
    { petId: pepper!.id, kind: "flea", productName: "Topical flea treatment", lastGivenOn: day(-25), intervalDays: 30, nextDueOn: day(5), assigneeId: emma!.id },
  ]);
  await db.insert(s.petMedicalRecords).values([
    { petId: biscuit!.id, kind: "vet_visit", title: "Annual wellness exam", date: day(-120), veterinarian: "Dr. Hale", costCents: 18500, nextDueOn: day(245), description: "Healthy weight; teeth look good." },
    { petId: biscuit!.id, kind: "vaccination", title: "Rabies booster (3-year)", date: day(-120), veterinarian: "Dr. Hale" },
    { petId: pepper!.id, kind: "dental", title: "Dental cleaning", date: day(-200), veterinarian: "Dr. Hale", costCents: 32000 },
  ]);
  const [kibble] = await db.insert(s.inventoryItems).values({ familyId: fid, name: "Salmon & rice kibble", quantity: "1", unit: "bag", location: "pets", lowStockThreshold: "1" }).returning();
  const [litter] = await db.insert(s.inventoryItems).values({ familyId: fid, name: "Clumping litter", quantity: "3", unit: "box", location: "pets", lowStockThreshold: "1" }).returning();
  await db.insert(s.petSupplies).values([
    { petId: biscuit!.id, inventoryItemId: kibble!.id, kind: "food", brand: "Trailside", foodType: "Dry", flavor: "Salmon & rice", feedingSchedule: "7am & 5pm", feedingInstructions: "2 cups per meal" },
    { petId: pepper!.id, inventoryItemId: litter!.id, kind: "supply" },
  ]);
  await db.insert(s.petCareNotes).values([
    { petId: biscuit!.id, kind: "emergency", body: "Emergency vet: Asheville Animal ER, 828-555-0911 (open 24/7)." },
    { petId: pepper!.id, kind: "feeding", body: "½ can wet food morning, dry food free-fed. No milk." },
  ]);
  await db.insert(s.journalEntries).values([
    { familyId: fid, authorMemberId: emma!.id, date: "2020-08-20", title: "Biscuit comes home", body: "He slept the whole car ride with his head on my lap.", book: "pet", linkedId: biscuit!.id, category: "Adoption day", visibility: "family" },
    { familyId: fid, authorMemberId: sarah!.id, date: day(-30), title: "First snow", body: "Pepper watched the snow from the window for an hour.", book: "pet", linkedId: pepper!.id, visibility: "family" },
  ]);
  const [walk] = await db.insert(s.chores).values({ familyId: fid, kind: "chore", title: "Walk Biscuit", petId: biscuit!.id, defaultAssigneeId: emma!.id, createdByMemberId: sarah!.id, estimatedMinutes: 30 }).returning();
  const [walkRule] = await db.insert(s.recurrenceRules).values({ familyId: fid, freq: "daily", interval: 1, startsOn: day(0) }).returning();
  await db.update(s.chores).set({ recurrenceRuleId: walkRule!.id }).where(eq(s.chores.id, walk!.id));

  // ── Witchcraft ──
  if (!(await db.select({ id: s.craftItems.id }).from(s.craftItems).where(isNull(s.craftItems.familyId)).limit(1)).length) {
    const refPlants = await db.select({ id: s.plants.id, name: s.plants.name }).from(s.plants).where(isNull(s.plants.familyId));
    await db.insert(s.craftItems).values(
      CRAFT_REFERENCE.map((r) => ({ familyId: null, kind: r.kind, name: r.name, emoji: r.emoji, category: r.category, description: r.description, fields: r.fields, plantId: refPlants.find((p) => p.name === r.plantName)?.id ?? null, source: "Vanderbilt Family reference library" })),
    );
  }
  const refItems = await db.select({ id: s.craftItems.id, name: s.craftItems.name }).from(s.craftItems).where(isNull(s.craftItems.familyId));
  const ref = (n: string) => refItems.find((r) => r.name === n)!.id;
  const craftSupplies = await db
    .insert(s.inventoryItems)
    .values([
      { familyId: fid, name: "White chime candles", quantity: "6", unit: "candles", location: "craft", lowStockThreshold: "4", spot: "Altar cabinet" },
      { familyId: fid, name: "Dried rosemary", quantity: "1", unit: "jar", location: "craft", lowStockThreshold: "1", spot: "Herb shelf" },
      { familyId: fid, name: "Sea salt", quantity: "2", unit: "lb", location: "craft" },
      { familyId: fid, name: "Small glass jars", quantity: "0", unit: "jars", location: "craft", lowStockThreshold: "2" },
    ])
    .returning();
  const [jar, release] = await db
    .insert(s.craftItems)
    .values([
      {
        familyId: fid,
        kind: "spell",
        name: "Kitchen protection jar",
        category: "protection",
        emoji: "🫙",
        moonPhase: "waxing",
        description: "A simple jar to keep the heart of the home safe and peaceful.",
        fields: { purpose: "Protect the kitchen and everyone who gathers there.", ingredients: "Small glass jar\nSea salt\nDried rosemary\nA bay leaf with your wish written on it", tools: "White candle", instructions: "Layer salt and rosemary in the jar while naming what you're protecting.\nAdd the bay leaf, seal the jar and drip a little candle wax on the lid.\nKeep it on a high kitchen shelf.", results: "Kitchen has felt calmer since Imbolc." },
        createdByMemberId: sarah!.id,
        isFavorite: true,
      },
      {
        familyId: fid,
        kind: "ritual",
        name: "Full moon release",
        category: "moon",
        emoji: "🌕",
        moonPhase: "full_moon",
        description: "Write down what you're ready to let go of and release it under the full moon.",
        fields: { purpose: "Release worry and old habits.", duration: "20 minutes", participants: "Family", materials: "Paper, pens, fire-safe cauldron, white candle", steps: "Light the candle and take three slow breaths together.\nEveryone writes what they're releasing.\nRead silently, then burn the papers safely in the cauldron.\nShare one thing you're grateful for.", closing: "Blow out the candle with thanks." },
        createdByMemberId: sarah!.id,
      },
    ])
    .returning();
  await db.insert(s.craftItemSupplies).values([
    { itemId: jar!.id, inventoryItemId: craftSupplies[1]!.id },
    { itemId: jar!.id, inventoryItemId: craftSupplies[2]!.id },
    { itemId: jar!.id, inventoryItemId: craftSupplies[3]!.id },
    { itemId: release!.id, inventoryItemId: craftSupplies[0]!.id },
  ]);
  await db.insert(s.craftCollection).values([
    { familyId: fid, itemId: ref("Amethyst"), quantity: 2, location: "Emma's nightstand", status: "owned" },
    { familyId: fid, itemId: ref("Rose Quartz"), quantity: 1, location: "Living room altar", status: "owned" },
    { familyId: fid, itemId: ref("Labradorite"), quantity: 1, status: "wishlist" },
    { familyId: fid, itemId: ref("Cauldron"), quantity: 1, location: "Altar cabinet", status: "owned" },
  ]);
  const yuleYear = Number(day(0).slice(0, 4));
  const [yuleEv] = await db.insert(s.calendarEvents).values({ familyId: fid, title: "🕯️ Family Yule night", startsAt: new Date(`${yuleYear}-12-21T05:00:00Z`), allDay: true, source: "celebration", createdByMemberId: sarah!.id }).returning();
  await db.insert(s.celebrations).values({ calendarEventId: yuleEv!.id, familyId: fid, name: "Family Yule night", sabbat: "yule", date: `${yuleYear}-12-21`, guestList: "Grandma & Grandpa\nThe Ortiz family", decorations: "Dried orange garland\nEvergreen boughs\nGold candles", activities: "Decorate the Yule log\nWatch the sunrise", supplies: "Gold taper candles\nOranges\nCloves\nRed ribbon", budgetCents: 12000, createdByMemberId: sarah!.id });
  await db.insert(s.sabbatSettings).values({ familyId: fid, key: "imbolc", monthDay: "02-02", notes: "We celebrate Imbolc on Feb 2 with Grandma's oat bread." });
  await db.insert(s.journalEntries).values([
    { familyId: fid, authorMemberId: sarah!.id, date: day(-3), title: "Waning moon reflection", body: "Cleared the hall closet and let go of the old worries about work. Feeling lighter.", book: "grimoire", category: "moon_log", moonPhase: "waning_crescent", visibility: "private" },
    { familyId: fid, authorMemberId: sarah!.id, date: day(-20), title: "Protection jar results", body: "Made the kitchen jar on the waxing moon with Emma. Will check in at Yule.", book: "grimoire", category: "spell_log", linkedId: jar!.id, visibility: "family" },
  ]);

  // ── Points, rewards, rotation ──
  const setPoints = (title: string, points: number, extra: Partial<typeof s.chores.$inferInsert> = {}) =>
    db.update(s.chores).set({ points, ...extra }).where(and(eq(s.chores.familyId, fid), eq(s.chores.title, title)));
  await setPoints("Kitchen reset", 10);
  await setPoints("Feed & water the chickens", 5);
  await setPoints("Take out trash & recycling", 5);
  await setPoints("Fold laundry", 8, { rotationMemberIds: [emma!.id, jack!.id] });
  await setPoints("Walk Biscuit", 5);
  await setPoints("Bathroom clean", 15);
  await setPoints("Vacuum living room", 5);
  await db.execute(sql`update chore_occurrences o set points_awarded = c.points from chores c where c.id = o.chore_id and o.status = 'done' and o.family_id = ${fid} and c.points is not null`);
  await db.insert(s.rewards).values([
    { familyId: fid, title: "Pick Friday's movie", emoji: "🎬", cost: 40, createdByMemberId: sarah!.id },
    { familyId: fid, title: "30 minutes extra screen time", emoji: "📱", cost: 30, createdByMemberId: sarah!.id },
    { familyId: fid, title: "$5 allowance", emoji: "💵", cost: 100, cashCents: 500, createdByMemberId: sarah!.id },
    { familyId: fid, title: "Stay up 30 minutes later", emoji: "🌙", cost: 60, forMemberIds: [emma!.id], createdByMemberId: sarah!.id },
  ]);
  const [screen] = await db.select().from(s.rewards).where(and(eq(s.rewards.familyId, fid), eq(s.rewards.cost, 30)));
  await db.insert(s.rewardRedemptions).values({ familyId: fid, rewardId: screen!.id, title: screen!.title, memberId: emma!.id, points: 30 });
  await db.insert(s.pointAdjustments).values({ familyId: fid, memberId: jack!.id, points: 10, reason: "Helped unload the groceries", createdByMemberId: michael!.id });

  // ── Shopping prices, vendors, home inventory ──
  for (const [text, price] of [["Chicken", 899], ["Mozzarella", 449], ["Tomatoes", 329], ["Coffee", 1199]] as const) {
    await db.update(s.listItems).set({ priceCents: price }).where(and(eq(s.listItems.listId, groceries!.id), eq(s.listItems.text, text)));
  }
  const [plumber, garageCo] = await db
    .insert(s.vendors)
    .values([
      { familyId: fid, name: "Blue Ridge Plumbing", trade: "plumber", contactName: "Dana", phone: "828-555-0134", email: "office@blueridgeplumbing.example", rating: 5, isFavorite: true, notes: "Licensed & insured. Fast emergency service." },
      { familyId: fid, name: "Overhead Door Co.", trade: "handyman", phone: "828-555-0161", rating: 4 },
      { familyId: fid, name: "Mountain Air HVAC", trade: "hvac", phone: "828-555-0177", notes: "Annual heat pump service each October." },
      { familyId: fid, name: "Sparkle Cleaners", trade: "cleaner", phone: "828-555-0188", rating: 4 },
    ])
    .returning();
  await db.update(s.homeRepairs).set({ vendorId: plumber!.id }).where(and(eq(s.homeRepairs.familyId, fid), eq(s.homeRepairs.title, "Leaking kitchen faucet")));
  await db.update(s.homeRepairs).set({ vendorId: garageCo!.id }).where(and(eq(s.homeRepairs.familyId, fid), eq(s.homeRepairs.title, "Garage door sticks")));
  await db.insert(s.homeItems).values([
    { familyId: fid, name: "Refrigerator", category: "appliance", roomId: room("Kitchen"), brand: "LG", model: "LRMVS3006S", serialNumber: "907KRCH1J442", purchasedOn: "2022-03-14", purchasedFrom: "Lowe's", purchasePriceCents: 279900, currentValueCents: 190000, warrantyExpiresOn: day(120) },
    { familyId: fid, name: "Dishwasher", category: "appliance", roomId: room("Kitchen"), brand: "Bosch", model: "SHX78CM5N", serialNumber: "FD9912 04563", purchasedOn: "2021-06-02", purchasePriceCents: 109900, currentValueCents: 70000 },
    { familyId: fid, name: "Washer", category: "appliance", roomId: room("Laundry"), brand: "Maytag", model: "MHW5630HW", purchasedOn: "2020-09-20", purchasePriceCents: 89900, currentValueCents: 45000 },
    { familyId: fid, name: "Living room TV", category: "electronics", roomId: room("Living room"), brand: "Sony", model: "XR-65X90L", serialNumber: "4401872", purchasedOn: "2024-11-29", purchasePriceCents: 129900, currentValueCents: 110000 },
    { familyId: fid, name: "Sectional sofa", category: "furniture", roomId: room("Living room"), purchasedFrom: "Local furniture store", purchasePriceCents: 240000, currentValueCents: 150000 },
    { familyId: fid, name: "Upright piano", category: "instrument", roomId: room("Living room"), brand: "Yamaha", model: "U1", purchasePriceCents: 650000, currentValueCents: 700000, notes: "Tuned every spring." },
  ]);

  // ── Announcements & activity ──
  await db.insert(s.announcements).values([
    { familyId: fid, authorMemberId: sarah!.id, body: "Grandma arrives next Saturday! Rooms tidy by Friday, please 💜", pinned: true },
    { familyId: fid, authorMemberId: michael!.id, body: "New egg record: 11 eggs on Tuesday. Way to go, ladies 🐔" },
  ]);
  await db.insert(s.activityLog).values([
    { familyId: fid, actorMemberId: emma!.id, verb: "chore.completed", summary: 'completed "Kitchen reset"', createdAt: at(-1, 19, 10) },
    { familyId: fid, actorMemberId: michael!.id, verb: "farm.production", summary: "collected 11 eggs (added to the kitchen)", createdAt: at(-1, 8, 2) },
    { familyId: fid, actorMemberId: sarah!.id, verb: "meal.planned", summary: "added Chicken Parmesan to today's dinner", createdAt: at(-1, 20, 30) },
    { familyId: fid, actorMemberId: michael!.id, verb: "garden.harvest", summary: "harvested 2 lb of Tomato", createdAt: at(-2, 17) },
    { familyId: fid, actorMemberId: sarah!.id, verb: "recipe.added", summary: 'added the recipe "Garden harvest salad"', createdAt: at(-3, 12) },
    { familyId: fid, actorMemberId: jack!.id, verb: "chore.completed", summary: 'completed "Feed & water the chickens"', createdAt: at(0, 7, 31) },
  ]);

  console.log("Seeded the Vanderbilt family. Sign in as sarah@vanderbilt.family / vanderbilt123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
