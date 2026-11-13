import { seasonEvent, type SeasonEvent } from "./astro";

/**
 * The Wheel of the Year as celebrated in modern Paganism and Wicca. Dates for
 * the solar festivals come from the real equinox/solstice; the cross-quarter
 * fire festivals use their traditional fixed dates. Families can override any
 * date (sabbat_settings.monthDay). Southern-hemisphere families get the wheel
 * turned six months.
 */
export type SabbatKey = "samhain" | "yule" | "imbolc" | "ostara" | "beltane" | "litha" | "lughnasadh" | "mabon";

export type Sabbat = {
  key: SabbatKey;
  name: string;
  also: string;
  emoji: string;
  kind: "solar" | "fire";
  /** Northern-hemisphere date rule. */
  north: SeasonEvent | `${number}-${number}`;
  /** Short line for the wheel. */
  theme: string;
  meaning: string;
  history: string;
  traditions: string[];
  colors: string[];
  herbs: string[];
  crystals: string[];
  foods: string[];
  altar: string[];
  ritualIdeas: string[];
  family: string[];
};

export const SABBATS: Sabbat[] = [
  {
    key: "samhain",
    name: "Samhain",
    also: "All Hallows' Eve, the Witches' New Year",
    emoji: "🎃",
    kind: "fire",
    north: "10-31",
    theme: "Ancestors, endings, the thinning veil",
    meaning: "The final harvest and the start of the dark half of the year. Many witches treat it as the new year: a time to honor ancestors and loved ones who have died, release what has ended, and reflect.",
    history: "From the Gaelic festival marking summer's end, when herds came in from pasture and the boundary between worlds was said to be thin. Many Halloween customs (guising, lanterns, divination games) grew from it.",
    traditions: ["Ancestor altar with photos and mementos", "Dumb supper: a silent meal with a place set for the departed", "Divination with tarot, scrying or apples", "Carving turnip or pumpkin lanterns"],
    colors: ["Black", "Orange", "Deep purple"],
    herbs: ["Mugwort", "Rosemary (remembrance)", "Sage", "Apple", "Pumpkin seeds"],
    crystals: ["Obsidian", "Smoky quartz", "Jet", "Onyx"],
    foods: ["Apples", "Pumpkin", "Root vegetables", "Soul cakes", "Spiced cider"],
    altar: ["Photos of ancestors", "Candles in black and orange", "Autumn leaves and gourds", "A bowl of apples"],
    ritualIdeas: ["Write what you are releasing and burn it safely", "Light a candle for each ancestor and speak their names", "Make a family memory book"],
    family: ["Tell stories about grandparents and great-grandparents", "Bake soul cakes together", "Carve lanterns", "Leave a candle in the window for loved ones"],
  },
  {
    key: "yule",
    name: "Yule",
    also: "Winter Solstice, Midwinter",
    emoji: "🌲",
    kind: "solar",
    north: "december_solstice",
    theme: "Rebirth of the sun, hope in the dark",
    meaning: "The longest night of the year, after which the days lengthen. Yule celebrates the return of the light, rest, generosity and hope.",
    history: "A Germanic midwinter festival; the Yule log, evergreens, wreaths and wassailing all trace back to midwinter customs absorbed into Christmas.",
    traditions: ["Burning or decorating a Yule log", "Keeping vigil to watch the sunrise", "Evergreens, holly and mistletoe in the home", "Wassailing the apple trees"],
    colors: ["Red", "Green", "Gold", "White"],
    herbs: ["Pine", "Holly", "Cinnamon", "Bay", "Clove", "Orange peel"],
    crystals: ["Garnet", "Ruby", "Bloodstone", "Clear quartz"],
    foods: ["Gingerbread", "Roasted nuts", "Wassail", "Clove-studded oranges", "Hearty stews"],
    altar: ["A Yule log with three candles", "Evergreen boughs", "Pinecones and dried orange slices", "Gold candles for the sun"],
    ritualIdeas: ["Sit in darkness, then light candles one by one to welcome the sun", "Write wishes for the coming year on bay leaves", "Watch the solstice sunrise"],
    family: ["Make dried-orange garlands", "Decorate a Yule log", "Share gifts or kind deeds", "Leave seed and suet for winter birds"],
  },
  {
    key: "imbolc",
    name: "Imbolc",
    also: "Candlemas, Brigid's Day",
    emoji: "🕯️",
    kind: "fire",
    north: "02-01",
    theme: "First stirrings of spring, purification",
    meaning: "Midway between winter solstice and spring equinox: the first signs of spring, lambing season and the quickening of the year. A time for cleansing, new intentions and creativity.",
    history: "A Gaelic festival associated with the goddess (and later saint) Brigid, patron of poetry, healing and smithcraft. Brigid's crosses were woven from rushes to protect the home.",
    traditions: ["Weaving a Brigid's cross", "Spring cleaning the home", "Lighting every lamp or candle", "Leaving cloth outside for Brigid to bless"],
    colors: ["White", "Pale yellow", "Light green"],
    herbs: ["Rosemary", "Bay", "Chamomile", "Snowdrops (decorative only)"],
    crystals: ["Amethyst", "Moonstone", "Garnet"],
    foods: ["Dairy and butter", "Seeded breads", "Oat cakes", "Herbal teas"],
    altar: ["A Brigid's cross", "White candles", "A bowl of milk or seeds", "Early flowers"],
    ritualIdeas: ["Light a candle and name a creative intention", "Bless seeds you will plant this spring", "Cleanse the home with fresh air and sweeping"],
    family: ["Make Brigid's crosses from paper or reeds", "Plan the garden together", "Do a family spring clean"],
  },
  {
    key: "ostara",
    name: "Ostara",
    also: "Spring Equinox",
    emoji: "🌷",
    kind: "solar",
    north: "march_equinox",
    theme: "Balance, fertility, new growth",
    meaning: "Day and night stand equal before the light wins out. A celebration of balance, renewal, fertility and fresh starts.",
    history: "The modern name comes from Ēostre, a goddess mentioned by the 8th-century writer Bede. Eggs and hares were old spring symbols of fertility.",
    traditions: ["Decorating eggs", "Planting seeds", "Balancing an egg on the equinox (for fun)", "Spring walks to find new growth"],
    colors: ["Pastel green", "Yellow", "Lilac", "Pink"],
    herbs: ["Violet", "Lemon balm", "Jasmine", "Daffodil (decorative only)"],
    crystals: ["Rose quartz", "Aquamarine", "Moonstone", "Green aventurine"],
    foods: ["Eggs", "Sprouts and spring greens", "Honey cakes", "Hot cross buns"],
    altar: ["Decorated eggs", "Fresh flowers", "Seed packets", "Pastel candles"],
    ritualIdeas: ["Plant a seed for each intention", "Meditate on what feels balanced and what doesn't", "Decorate eggs with symbols of your goals"],
    family: ["Dye eggs with onion skins or beets", "Start seedlings", "Go on a spring nature hunt"],
  },
  {
    key: "beltane",
    name: "Beltane",
    also: "May Day",
    emoji: "🔥",
    kind: "fire",
    north: "05-01",
    theme: "Fire, passion, abundance, joy",
    meaning: "The start of the light half of the year and the height of spring: fertility, vitality, love and celebration.",
    history: "A Gaelic fire festival when cattle were driven between bonfires for protection before going to summer pasture. Maypoles, May queens and flower crowns come from European May Day customs.",
    traditions: ["Bonfires", "Dancing the maypole", "Flower crowns", "Washing your face in May morning dew"],
    colors: ["Red", "White", "Green", "Bright pink"],
    herbs: ["Hawthorn", "Rose", "Mint", "Woodruff", "Primrose"],
    crystals: ["Carnelian", "Rose quartz", "Emerald", "Malachite"],
    foods: ["Oatcakes", "Fresh berries", "Honey", "Dairy", "Spring salads"],
    altar: ["Flowers and ribbons", "A small maypole", "Red and white candles", "A bowl of water and a candle (balance)"],
    ritualIdeas: ["Jump a small, safe candle flame or bonfire with intentions", "Tie ribbons with wishes to a tree", "Leave flowers on neighbors' doorsteps"],
    family: ["Make flower crowns", "Build a mini maypole", "Have a backyard fire (safely) with s'mores", "Hang May baskets"],
  },
  {
    key: "litha",
    name: "Litha",
    also: "Summer Solstice, Midsummer",
    emoji: "☀️",
    kind: "solar",
    north: "june_solstice",
    theme: "Peak of the sun, power, gratitude",
    meaning: "The longest day of the year, when the sun is at full strength. A time to celebrate abundance and light, and to remember that the days now begin to shorten.",
    history: "Midsummer has been marked across Europe with bonfires, herb gathering and staying up through the short night; St. John's wort was traditionally picked at midsummer.",
    traditions: ["Watching the sunrise or sunset", "Midsummer bonfires", "Gathering herbs at their peak", "Making sun wheels"],
    colors: ["Gold", "Yellow", "Orange", "Sky blue"],
    herbs: ["St. John's wort", "Lavender", "Chamomile", "Calendula", "Sunflower"],
    crystals: ["Citrine", "Sunstone", "Tiger's eye", "Amber"],
    foods: ["Fresh summer fruit", "Grilled vegetables", "Honey", "Lemonade", "Herb breads"],
    altar: ["Sunflowers", "A sun wheel", "Gold candles", "Fresh herbs from the garden"],
    ritualIdeas: ["Charge water or crystals in the sun", "Name what you are grateful for at noon", "Harvest and dry herbs"],
    family: ["Picnic and watch the sunset", "Make sun catchers", "Harvest herbs from the garden together"],
  },
  {
    key: "lughnasadh",
    name: "Lughnasadh",
    also: "Lammas, the First Harvest",
    emoji: "🌾",
    kind: "fire",
    north: "08-01",
    theme: "First harvest, grain, gratitude",
    meaning: "The first of three harvest festivals: the grain harvest. A time of gratitude for abundance, for sharing bread, and for recognizing the fruits of your work.",
    history: "Named for the Irish god Lugh, who is said to have held funeral games for his foster mother Tailtiu. 'Lammas' comes from the Anglo-Saxon 'loaf-mass', when bread from the new grain was blessed.",
    traditions: ["Baking bread from new grain", "Making corn dollies", "Games and contests", "Sharing the harvest"],
    colors: ["Gold", "Orange", "Brown", "Green"],
    herbs: ["Wheat", "Corn", "Sunflower", "Basil", "Calendula"],
    crystals: ["Citrine", "Peridot", "Carnelian", "Aventurine"],
    foods: ["Homemade bread", "Corn", "Berries", "Blackberry pie", "Garden vegetables"],
    altar: ["A loaf of bread", "Wheat sheaves or a corn dolly", "Sunflowers", "Fruits of your garden"],
    ritualIdeas: ["Bake bread and share the first piece in thanks", "Write what you have 'harvested' this year", "Give some of your garden's harvest away"],
    family: ["Bake bread together", "Make corn-husk dolls", "Have backyard games", "Pick berries"],
  },
  {
    key: "mabon",
    name: "Mabon",
    also: "Autumn Equinox, Harvest Home",
    emoji: "🍎",
    kind: "solar",
    north: "september_equinox",
    theme: "Balance, second harvest, thanksgiving",
    meaning: "Day and night are equal again before the dark grows. The second harvest — fruit and nuts — brings thanksgiving, balance and preparation for winter.",
    history: "The name was given in the 1970s after a figure from Welsh mythology; harvest-home suppers and festivals of thanks have long marked this season.",
    traditions: ["A thanksgiving feast", "Apple picking", "Making wine or cider", "Decorating with autumn leaves"],
    colors: ["Deep red", "Orange", "Brown", "Gold"],
    herbs: ["Apple", "Sage", "Cinnamon", "Rosehip", "Marigold"],
    crystals: ["Amber", "Tiger's eye", "Carnelian", "Sapphire"],
    foods: ["Apples", "Squash", "Grapes", "Nuts", "Cornbread", "Cider"],
    altar: ["Apples and gourds", "Autumn leaves", "A cornucopia", "Candles in harvest colors"],
    ritualIdeas: ["List what you are grateful for and what you will let go", "Cut an apple crosswise to reveal the star", "Balance meditation at sunset"],
    family: ["Go apple picking", "Make applesauce or apple butter", "Host a gratitude dinner", "Press autumn leaves"],
  },
];

export const SABBAT_ORDER: SabbatKey[] = SABBATS.map((s) => s.key);
export const sabbatByKey = (k: string) => SABBATS.find((s) => s.key === k);

const FLIP: Record<SeasonEvent, SeasonEvent> = {
  march_equinox: "september_equinox",
  september_equinox: "march_equinox",
  june_solstice: "december_solstice",
  december_solstice: "june_solstice",
};
/** Southern-hemisphere dates for the fire festivals (the wheel turned six months). */
const SOUTH_FIXED: Partial<Record<SabbatKey, `${number}-${number}`>> = { samhain: "04-30", imbolc: "08-01", beltane: "10-31", lughnasadh: "02-01" };

/** Local yyyy-mm-dd of an instant in an IANA zone. */
function localDate(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export type SabbatDate = { key: SabbatKey; date: string; exact?: Date; overridden: boolean };

/** Date of a sabbat in a given year for a family (hemisphere + optional MM-DD override). */
export function sabbatDate(s: Sabbat, year: number, opts: { tz: string; southern?: boolean; override?: string | null }): SabbatDate {
  if (opts.override && /^\d{2}-\d{2}$/.test(opts.override)) return { key: s.key, date: `${year}-${opts.override}`, overridden: true };
  let rule = s.north;
  if (opts.southern) rule = /^\d/.test(rule) ? SOUTH_FIXED[s.key]! : FLIP[rule as SeasonEvent];
  if (/^\d/.test(rule)) return { key: s.key, date: `${year}-${rule}`, overridden: false };
  const at = seasonEvent(year, rule as SeasonEvent);
  return { key: s.key, date: localDate(at, opts.tz), exact: at, overridden: false };
}

/** All eight sabbats for a year, sorted by date. */
export function wheelForYear(year: number, opts: { tz: string; southern?: boolean; overrides?: Record<string, string | null> }) {
  return SABBATS.map((s) => ({ s, ...sabbatDate(s, year, { ...opts, override: opts.overrides?.[s.key] }) })).sort((a, b) => a.date.localeCompare(b.date));
}

/** Upcoming sabbats from a date (spanning into next year). */
export function upcomingSabbats(today: string, opts: { tz: string; southern?: boolean; overrides?: Record<string, string | null> }, count = 8) {
  const y = Number(today.slice(0, 4));
  return [...wheelForYear(y, opts), ...wheelForYear(y + 1, opts)].filter((x) => x.date >= today).slice(0, count);
}
