/** Built-in reference plant data (pure module: usable by the app and the seed script). */
type Seed = {
  name: string;
  variety?: string;
  category: "Vegetable" | "Herb" | "Fruit" | "Flower";
  emoji: string;
  sun: "full_sun" | "partial_sun" | "partial_shade" | "full_shade";
  water: string;
  soil: string;
  depth: number;
  spacing: number;
  germ: string;
  maturity: string;
  companions: string[];
  avoid: string[];
  plant: string;
  harvest: string;
  zones: string;
  fertilizer?: string;
  amendments?: string;
  notes?: string;
};

/** Built-in reference plants (family_id NULL). Images are emoji illustrations; families can add photos to their own plants. */
export const REFERENCE_PLANTS: Seed[] = [
  { name: "Tomato", variety: "Cherokee Purple", category: "Vegetable", emoji: "🍅", sun: "full_sun", water: "1–2 in/week, deep & even", soil: "Loamy, well-drained, pH 6.2–6.8", depth: 0.25, spacing: 24, germ: "5–10 days", maturity: "70–85 days", companions: ["Basil", "Marigold", "Carrot", "Onion"], avoid: ["Potato", "Fennel", "Corn"], plant: "Transplant after last frost", harvest: "Mid-summer to frost", zones: "3–11", fertilizer: "Balanced at planting, low-nitrogen once fruiting", amendments: "Compost; crushed eggshells for calcium" },
  { name: "Cherry tomato", variety: "Sungold", category: "Vegetable", emoji: "🍅", sun: "full_sun", water: "1–2 in/week", soil: "Rich, well-drained", depth: 0.25, spacing: 24, germ: "5–10 days", maturity: "55–65 days", companions: ["Basil", "Marigold"], avoid: ["Potato", "Fennel"], plant: "Transplant after last frost", harvest: "Summer to frost", zones: "3–11" },
  { name: "Basil", variety: "Genovese", category: "Herb", emoji: "🌿", sun: "full_sun", water: "Keep evenly moist", soil: "Rich, well-drained", depth: 0.25, spacing: 12, germ: "5–10 days", maturity: "60 days", companions: ["Tomato", "Pepper"], avoid: ["Sage", "Rue"], plant: "After last frost", harvest: "Pinch leaves all summer", zones: "4–10", notes: "Pinch flowers to keep leaves coming." },
  { name: "Marigold", variety: "French", category: "Flower", emoji: "🌼", sun: "full_sun", water: "Moderate", soil: "Average, well-drained", depth: 0.25, spacing: 10, germ: "4–14 days", maturity: "50 days to bloom", companions: ["Tomato", "Squash", "Bean"], avoid: [], plant: "After last frost", harvest: "Blooms summer to frost", zones: "2–11", notes: "Repels many garden pests." },
  { name: "Carrot", variety: "Nantes", category: "Vegetable", emoji: "🥕", sun: "full_sun", water: "1 in/week, consistent", soil: "Loose, sandy, stone-free", depth: 0.25, spacing: 3, germ: "10–21 days", maturity: "65–75 days", companions: ["Onion", "Lettuce", "Tomato"], avoid: ["Dill", "Parsnip"], plant: "Early spring & late summer", harvest: "When shoulders are ~1 in wide", zones: "3–10", amendments: "Avoid fresh manure (causes forking)" },
  { name: "Onion", variety: "Yellow Spanish", category: "Vegetable", emoji: "🧅", sun: "full_sun", water: "1 in/week", soil: "Loose, fertile, pH 6–7", depth: 1, spacing: 4, germ: "7–10 days", maturity: "100–120 days", companions: ["Carrot", "Lettuce", "Tomato"], avoid: ["Bean", "Pea"], plant: "Early spring (sets or transplants)", harvest: "When tops fall over", zones: "3–9" },
  { name: "Lettuce", variety: "Buttercrunch", category: "Vegetable", emoji: "🥬", sun: "partial_sun", water: "Keep moist", soil: "Rich, moist, well-drained", depth: 0.25, spacing: 8, germ: "7–10 days", maturity: "45–55 days", companions: ["Carrot", "Radish", "Onion"], avoid: ["Celery"], plant: "Early spring & fall; succession sow", harvest: "Cut outer leaves or whole heads", zones: "4–9", notes: "Bolts in heat. Give afternoon shade in summer." },
  { name: "Spinach", variety: "Bloomsdale", category: "Vegetable", emoji: "🥬", sun: "partial_sun", water: "Keep moist", soil: "Rich, pH 6.5–7", depth: 0.5, spacing: 4, germ: "7–14 days", maturity: "40–50 days", companions: ["Strawberry", "Pea"], avoid: [], plant: "Early spring & fall", harvest: "Baby leaves from 25 days", zones: "2–9" },
  { name: "Kale", variety: "Lacinato", category: "Vegetable", emoji: "🥬", sun: "full_sun", water: "1–1.5 in/week", soil: "Rich, pH 6–7.5", depth: 0.5, spacing: 18, germ: "5–8 days", maturity: "55–65 days", companions: ["Onion", "Beet"], avoid: ["Strawberry"], plant: "Spring & late summer", harvest: "Lower leaves continually; sweeter after frost", zones: "3–9" },
  { name: "Pepper", variety: "Bell, California Wonder", category: "Vegetable", emoji: "🫑", sun: "full_sun", water: "1–2 in/week", soil: "Well-drained, pH 6–6.8", depth: 0.25, spacing: 18, germ: "7–14 days", maturity: "70–80 days", companions: ["Basil", "Onion", "Tomato"], avoid: ["Fennel", "Kohlrabi"], plant: "Transplant when soil is warm", harvest: "Green or fully colored", zones: "4–11" },
  { name: "Jalapeño", category: "Vegetable", emoji: "🌶️", sun: "full_sun", water: "1 in/week", soil: "Well-drained", depth: 0.25, spacing: 18, germ: "7–14 days", maturity: "70–80 days", companions: ["Basil", "Tomato"], avoid: ["Fennel"], plant: "After soil warms", harvest: "Firm & glossy green, or red", zones: "5–11" },
  { name: "Cucumber", variety: "Marketmore", category: "Vegetable", emoji: "🥒", sun: "full_sun", water: "1–2 in/week, consistent", soil: "Rich, well-drained", depth: 1, spacing: 12, germ: "3–10 days", maturity: "55–65 days", companions: ["Bean", "Pea", "Radish", "Dill"], avoid: ["Potato", "Sage"], plant: "After last frost; trellis", harvest: "Pick young & often", zones: "4–11" },
  { name: "Zucchini", variety: "Black Beauty", category: "Vegetable", emoji: "🥒", sun: "full_sun", water: "1–2 in/week", soil: "Rich with compost", depth: 1, spacing: 36, germ: "5–10 days", maturity: "45–55 days", companions: ["Bean", "Corn", "Nasturtium"], avoid: ["Potato"], plant: "After last frost", harvest: "At 6–8 inches", zones: "3–10" },
  { name: "Winter squash", variety: "Butternut", category: "Vegetable", emoji: "🎃", sun: "full_sun", water: "1–2 in/week", soil: "Rich, well-drained", depth: 1, spacing: 48, germ: "5–10 days", maturity: "100–110 days", companions: ["Corn", "Bean"], avoid: ["Potato"], plant: "After last frost", harvest: "When rind is hard", zones: "3–10" },
  { name: "Pumpkin", variety: "Howden", category: "Vegetable", emoji: "🎃", sun: "full_sun", water: "1–2 in/week", soil: "Rich, well-drained", depth: 1, spacing: 60, germ: "5–10 days", maturity: "110–120 days", companions: ["Corn", "Bean"], avoid: ["Potato"], plant: "Late spring", harvest: "Early fall", zones: "3–9" },
  { name: "Green bean", variety: "Provider (bush)", category: "Vegetable", emoji: "🫛", sun: "full_sun", water: "1 in/week", soil: "Well-drained, pH 6–7", depth: 1, spacing: 4, germ: "7–10 days", maturity: "50–55 days", companions: ["Carrot", "Cucumber", "Corn", "Squash"], avoid: ["Onion", "Garlic"], plant: "After last frost; succession sow", harvest: "Pick before seeds bulge", zones: "3–10", notes: "Fixes nitrogen in the soil." },
  { name: "Pea", variety: "Sugar Snap", category: "Vegetable", emoji: "🫛", sun: "full_sun", water: "1 in/week", soil: "Well-drained", depth: 1, spacing: 2, germ: "7–14 days", maturity: "60–70 days", companions: ["Carrot", "Radish", "Spinach"], avoid: ["Onion", "Garlic"], plant: "Early spring as soon as soil can be worked", harvest: "When pods are plump", zones: "3–11" },
  { name: "Sweet corn", variety: "Silver Queen", category: "Vegetable", emoji: "🌽", sun: "full_sun", water: "1–2 in/week", soil: "Rich, nitrogen-heavy", depth: 1.5, spacing: 10, germ: "7–10 days", maturity: "85–95 days", companions: ["Bean", "Squash", "Pumpkin"], avoid: ["Tomato"], plant: "After soil reaches 60°F; plant in blocks", harvest: "When silks brown", zones: "4–11" },
  { name: "Potato", variety: "Yukon Gold", category: "Vegetable", emoji: "🥔", sun: "full_sun", water: "1–2 in/week", soil: "Loose, acidic pH 5–6", depth: 4, spacing: 12, germ: "14–28 days (sprouts)", maturity: "80–100 days", companions: ["Bean", "Corn", "Marigold"], avoid: ["Tomato", "Squash", "Cucumber"], plant: "2–4 weeks before last frost", harvest: "After vines die back", zones: "3–10" },
  { name: "Garlic", variety: "Music (hardneck)", category: "Vegetable", emoji: "🧄", sun: "full_sun", water: "Moderate; stop when leaves yellow", soil: "Loose, rich", depth: 2, spacing: 6, germ: "Shoots in 2–4 weeks", maturity: "~240 days (fall planted)", companions: ["Tomato", "Carrot"], avoid: ["Bean", "Pea"], plant: "Fall, 4–6 weeks before ground freezes", harvest: "Early summer when ⅓ of leaves brown", zones: "3–8" },
  { name: "Radish", variety: "Cherry Belle", category: "Vegetable", emoji: "🌱", sun: "full_sun", water: "Keep moist", soil: "Loose", depth: 0.5, spacing: 2, germ: "3–7 days", maturity: "22–30 days", companions: ["Lettuce", "Pea", "Cucumber"], avoid: [], plant: "Spring & fall; succession sow", harvest: "Quickly once mature", zones: "2–10" },
  { name: "Beet", variety: "Detroit Dark Red", category: "Vegetable", emoji: "🫚", sun: "full_sun", water: "1 in/week", soil: "Loose, pH 6–7.5", depth: 0.5, spacing: 4, germ: "5–10 days", maturity: "55–60 days", companions: ["Onion", "Lettuce", "Kale"], avoid: ["Pole bean"], plant: "Early spring to mid-summer", harvest: "1.5–3 inch roots", zones: "2–10" },
  { name: "Broccoli", variety: "Calabrese", category: "Vegetable", emoji: "🥦", sun: "full_sun", water: "1–1.5 in/week", soil: "Rich, pH 6–7", depth: 0.5, spacing: 18, germ: "5–10 days", maturity: "60–70 days", companions: ["Onion", "Beet", "Dill"], avoid: ["Strawberry", "Tomato"], plant: "Early spring & late summer", harvest: "Before flower buds open", zones: "3–10" },
  { name: "Cabbage", variety: "Golden Acre", category: "Vegetable", emoji: "🥬", sun: "full_sun", water: "1–1.5 in/week", soil: "Rich", depth: 0.5, spacing: 18, germ: "5–10 days", maturity: "60–70 days", companions: ["Onion", "Dill", "Celery"], avoid: ["Strawberry", "Tomato"], plant: "Spring & late summer", harvest: "When heads are firm", zones: "1–9" },
  { name: "Strawberry", variety: "Everbearing", category: "Fruit", emoji: "🍓", sun: "full_sun", water: "1–2 in/week", soil: "Rich, slightly acidic", depth: 0, spacing: 12, germ: "Crowns", maturity: "Fruit 2nd year (June-bearing)", companions: ["Spinach", "Lettuce", "Onion"], avoid: ["Cabbage", "Broccoli"], plant: "Early spring (crowns at soil level)", harvest: "Late spring–summer", zones: "4–9", amendments: "Mulch with straw" },
  { name: "Blueberry", variety: "Bluecrop", category: "Fruit", emoji: "🫐", sun: "full_sun", water: "1–2 in/week", soil: "Acidic pH 4.5–5.5", depth: 0, spacing: 60, germ: "Bare-root/potted", maturity: "Fruit in 2–3 years", companions: ["Strawberry"], avoid: [], plant: "Early spring", harvest: "Mid-summer", zones: "4–7", amendments: "Sulfur & pine needles to acidify" },
  { name: "Apple tree", variety: "Honeycrisp", category: "Fruit", emoji: "🍎", sun: "full_sun", water: "Deep weekly first year", soil: "Well-drained loam", depth: 0, spacing: 180, germ: "Grafted tree", maturity: "Fruit in 3–5 years", companions: ["Chive", "Nasturtium"], avoid: ["Walnut"], plant: "Early spring, bare-root", harvest: "Late summer–fall", zones: "3–8", notes: "Needs a pollination partner." },
  { name: "Cilantro", category: "Herb", emoji: "🌿", sun: "partial_sun", water: "Keep moist", soil: "Well-drained", depth: 0.25, spacing: 6, germ: "7–10 days", maturity: "45–70 days", companions: ["Tomato", "Pepper"], avoid: ["Fennel"], plant: "Cool season; succession sow", harvest: "Leaves before bolting; seeds = coriander", zones: "2–11" },
  { name: "Parsley", variety: "Italian flat-leaf", category: "Herb", emoji: "🌿", sun: "partial_sun", water: "Keep moist", soil: "Rich", depth: 0.25, spacing: 8, germ: "14–28 days", maturity: "70–90 days", companions: ["Tomato", "Carrot"], avoid: ["Lettuce"], plant: "Spring (soak seeds overnight)", harvest: "Outer stems as needed", zones: "4–9" },
  { name: "Dill", category: "Herb", emoji: "🌿", sun: "full_sun", water: "Moderate", soil: "Well-drained", depth: 0.25, spacing: 12, germ: "7–21 days", maturity: "40–60 days", companions: ["Cucumber", "Cabbage", "Lettuce"], avoid: ["Carrot", "Tomato"], plant: "After last frost", harvest: "Leaves anytime; heads for pickling", zones: "2–11" },
  { name: "Mint", category: "Herb", emoji: "🌱", sun: "partial_shade", water: "Keep moist", soil: "Rich, moist", depth: 0.25, spacing: 18, germ: "10–15 days", maturity: "90 days", companions: ["Cabbage", "Tomato"], avoid: ["Parsley"], plant: "Spring, in a container", harvest: "Often to keep bushy", zones: "3–8", notes: "Spreads aggressively; grow in pots." },
  { name: "Rosemary", category: "Herb", emoji: "🌿", sun: "full_sun", water: "Let dry between waterings", soil: "Sandy, well-drained", depth: 0.25, spacing: 24, germ: "14–21 days (slow)", maturity: "~90 days from transplant", companions: ["Bean", "Cabbage", "Carrot"], avoid: [], plant: "Spring transplant", harvest: "Sprigs year-round", zones: "7–10" },
  { name: "Sunflower", variety: "Mammoth", category: "Flower", emoji: "🌻", sun: "full_sun", water: "Moderate", soil: "Average, well-drained", depth: 1, spacing: 18, germ: "7–10 days", maturity: "80–95 days", companions: ["Cucumber", "Corn"], avoid: ["Potato"], plant: "After last frost", harvest: "When back of head turns brown", zones: "2–11" },
  { name: "Zinnia", variety: "Benary's Giant", category: "Flower", emoji: "🌸", sun: "full_sun", water: "Moderate", soil: "Average, well-drained", depth: 0.25, spacing: 12, germ: "4–7 days", maturity: "75–90 days", companions: ["Tomato", "Squash"], avoid: [], plant: "After last frost", harvest: "Cut-and-come-again", zones: "3–10", notes: "Brings pollinators." },
  { name: "Nasturtium", category: "Flower", emoji: "🌺", sun: "full_sun", water: "Light", soil: "Poor to average", depth: 0.5, spacing: 12, germ: "7–12 days", maturity: "50 days", companions: ["Squash", "Cucumber", "Bean"], avoid: [], plant: "After last frost", harvest: "Edible leaves & flowers", zones: "2–11", notes: "Trap crop for aphids." },
  { name: "Lavender", variety: "Munstead", category: "Flower", emoji: "💜", sun: "full_sun", water: "Low", soil: "Sandy, alkaline, very well-drained", depth: 0.125, spacing: 18, germ: "14–28 days", maturity: "Blooms 2nd year", companions: ["Rosemary"], avoid: [], plant: "Spring", harvest: "When half the buds open", zones: "5–9" },
];


export function referencePlantRows() {
  return REFERENCE_PLANTS.map((s) => ({
    familyId: null,
    name: s.name,
    variety: s.variety ?? null,
    category: s.category,
    imageUrl: `emoji:${s.emoji}`,
    growingZones: s.zones,
    sun: s.sun,
    soil: s.soil,
    water: s.water,
    plantingDepthIn: String(s.depth),
    spacingIn: String(s.spacing),
    germinationDays: s.germ,
    daysToMaturity: s.maturity,
    companionPlants: s.companions,
    avoidPlants: s.avoid,
    plantingWindow: s.plant,
    harvestWindow: s.harvest,
    fertilizer: s.fertilizer ?? null,
    soilAmendments: s.amendments ?? null,
    seedInfo: null,
    notes: s.notes ?? null,
  }));
}
