import { FAITHS, type Faith } from "./faith-calendar";

export { FAITHS, type Faith };

export type FaithMeta = {
  key: Faith;
  label: string;
  /** Tab label. */
  tab: string;
  emoji: string;
  blurb: string;
  prayersTitle: string;
  prayerNoun: string;
  journalTitle: string;
  journalPrompt: string;
  referenceLabel: string;
};

export const FAITH_META: Record<Faith, FaithMeta> = {
  spiritual: {
    key: "spiritual",
    label: "Spiritual",
    tab: "Spiritual",
    emoji: "🌙",
    blurb: "Moon cycles, the Wheel of the Year, rituals, spells, your grimoire, crystals and herbs.",
    prayersTitle: "Intentions",
    prayerNoun: "intention",
    journalTitle: "Reflections",
    journalPrompt: "What did you notice, feel or receive today?",
    referenceLabel: "Card, ritual or source",
  },
  christian: {
    key: "christian",
    label: "Christian",
    tab: "Christian",
    emoji: "✝️",
    blurb: "The church year, Bible reading, prayer requests, devotions and a prayer journal.",
    prayersTitle: "Prayer requests",
    prayerNoun: "prayer request",
    journalTitle: "Devotional journal",
    journalPrompt: "What spoke to you in today's reading or prayer?",
    referenceLabel: "Scripture (e.g. John 3:16)",
  },
  catholic: {
    key: "catholic",
    label: "Catholic",
    tab: "Catholic",
    emoji: "⛪",
    blurb: "The liturgical year, feasts and holy days, saints, the Rosary, the sacraments, Scripture and the Catechism.",
    prayersTitle: "Prayer intentions",
    prayerNoun: "intention",
    journalTitle: "Prayer journal",
    journalPrompt: "What did God say to you in prayer, at Mass or in today's reading?",
    referenceLabel: "Scripture or source (e.g. Luke 1:28, CCC 27)",
  },
  jewish: {
    key: "jewish",
    label: "Jewish",
    tab: "Jewish",
    emoji: "✡️",
    blurb: "The Hebrew calendar, holidays, Torah and Tanakh study, daily prayers and Shabbat.",
    prayersTitle: "Prayer list",
    prayerNoun: "name for the prayer list",
    journalTitle: "Study journal",
    journalPrompt: "What did you learn or wrestle with in today's study?",
    referenceLabel: "Text (e.g. Genesis 12:1, Pirkei Avot 1:14)",
  },
  hindu: {
    key: "hindu",
    label: "Hindu",
    tab: "Hindu",
    emoji: "🕉️",
    blurb: "Festivals and Ekadashi days, today's tithi, puja, japa, scripture study and sankalpas.",
    prayersTitle: "Prayers & sankalpas",
    prayerNoun: "prayer or sankalpa",
    journalTitle: "Sadhana journal",
    journalPrompt: "How was your sadhana today?",
    referenceLabel: "Text (e.g. Bhagavad Gita 2.47)",
  },
  buddhist: {
    key: "buddhist",
    label: "Buddhist",
    tab: "Buddhist",
    emoji: "☸️",
    blurb: "Uposatha and holy days, meditation, precepts, Dharma study and dedications of merit.",
    prayersTitle: "Dedications & intentions",
    prayerNoun: "dedication",
    journalTitle: "Practice journal",
    journalPrompt: "What did you notice on the cushion today?",
    referenceLabel: "Text (e.g. Dhammapada 1)",
  },
};

export const isFaith = (v: unknown): v is Faith => typeof v === "string" && (FAITHS as readonly string[]).includes(v);

/** A member's paths: null (never chosen) = the Spiritual path, as before; [] = none. */
export function faithPathsOf(member: { faithPaths: string[] | null }): Faith[] {
  if (member.faithPaths === null) return ["spiritual"];
  return FAITHS.filter((f) => member.faithPaths!.includes(f));
}

export const faithHref = (f: Faith) => (f === "spiritual" ? "/spiritual" : `/spiritual/faith/${f}`);

// ─── Practices (devotions) ───────────────────────────────────────────────────

export type PracticeDef = { key: string; name: string; emoji: string; unit?: string };

export const PRACTICES: Record<Faith, PracticeDef[]> = {
  spiritual: [
    { key: "meditation", name: "Meditation", emoji: "🧘", unit: "minutes" },
    { key: "card", name: "Daily card pull", emoji: "🃏" },
    { key: "gratitude", name: "Gratitude", emoji: "💛" },
    { key: "journal", name: "Journaling", emoji: "📓" },
    { key: "grounding", name: "Grounding in nature", emoji: "🌳" },
    { key: "altar", name: "Altar tending", emoji: "🕯️" },
    { key: "breath", name: "Breathwork", emoji: "🌬️", unit: "minutes" },
  ],
  christian: [
    { key: "prayer", name: "Prayer", emoji: "🙏" },
    { key: "bible", name: "Bible reading", emoji: "📖", unit: "chapters" },
    { key: "devotional", name: "Devotional", emoji: "📘" },
    { key: "worship", name: "Church / worship", emoji: "⛪" },
    { key: "gratitude", name: "Gratitude", emoji: "💛" },
    { key: "memory_verse", name: "Memory verse", emoji: "🧠" },
    { key: "serve", name: "Served someone", emoji: "🤝" },
    { key: "fasting", name: "Fasting", emoji: "🍞" },
  ],
  catholic: [
    { key: "rosary", name: "Rosary", emoji: "📿" },
    { key: "mass", name: "Mass", emoji: "⛪" },
    { key: "morning_offering", name: "Morning Offering", emoji: "🌅" },
    { key: "angelus", name: "Angelus", emoji: "🔔" },
    { key: "scripture", name: "Scripture reading", emoji: "📖", unit: "chapters" },
    { key: "divine_mercy", name: "Divine Mercy Chaplet", emoji: "❤️‍🔥" },
    { key: "examen", name: "Evening Examen", emoji: "🌙" },
    { key: "adoration", name: "Adoration", emoji: "✨", unit: "minutes" },
    { key: "confession", name: "Confession", emoji: "🙏" },
    { key: "friday_penance", name: "Friday penance / abstinence", emoji: "🐟" },
  ],
  jewish: [
    { key: "modeh_ani", name: "Modeh Ani", emoji: "🌅" },
    { key: "shacharit", name: "Shacharit (morning)", emoji: "☀️" },
    { key: "mincha", name: "Mincha (afternoon)", emoji: "🌤️" },
    { key: "maariv", name: "Maariv (evening)", emoji: "🌙" },
    { key: "shema", name: "Shema at bedtime", emoji: "📜" },
    { key: "torah_study", name: "Torah study", emoji: "📖", unit: "minutes" },
    { key: "tzedakah", name: "Tzedakah", emoji: "🪙" },
    { key: "brachot", name: "Blessings over food", emoji: "🍞" },
    { key: "shabbat", name: "Shabbat candles", emoji: "🕯️" },
  ],
  hindu: [
    { key: "puja", name: "Puja", emoji: "🪔" },
    { key: "japa", name: "Japa", emoji: "📿", unit: "rounds" },
    { key: "aarti", name: "Aarti", emoji: "🔥" },
    { key: "dhyana", name: "Meditation (dhyana)", emoji: "🧘", unit: "minutes" },
    { key: "scripture", name: "Scripture reading", emoji: "📖" },
    { key: "yoga", name: "Yoga / pranayama", emoji: "🕉️", unit: "minutes" },
    { key: "vrat", name: "Fast (vrat)", emoji: "🍃" },
    { key: "temple", name: "Temple visit", emoji: "🛕" },
    { key: "seva", name: "Seva", emoji: "🤝" },
  ],
  buddhist: [
    { key: "meditation", name: "Meditation", emoji: "🧘", unit: "minutes" },
    { key: "chanting", name: "Chanting", emoji: "📿" },
    { key: "precepts", name: "Kept the Five Precepts", emoji: "🪷" },
    { key: "metta", name: "Loving-kindness (metta)", emoji: "💗" },
    { key: "dharma", name: "Dharma study", emoji: "📖" },
    { key: "offering", name: "Shrine offering", emoji: "🕯️" },
    { key: "walking", name: "Walking meditation", emoji: "🚶", unit: "minutes" },
    { key: "generosity", name: "Generosity (dana)", emoji: "🎁" },
  ],
};

export const PRACTICE_UNITS = ["minutes", "rounds", "chapters", "pages", "times"] as const;

// ─── Texts to read ───────────────────────────────────────────────────────────

export type TextDef = { key: string; title: string; group: string; sections: number; sectionLabel: string; names?: string[]; about?: string };

const bible = (prefix: string, group: string, rows: [string, number][]): TextDef[] => rows.map(([title, n]) => ({ key: `${prefix}:${title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, title, group, sections: n, sectionLabel: "Chapter" }));

const OT: [string, number][] = [
  ["Genesis", 50], ["Exodus", 40], ["Leviticus", 27], ["Numbers", 36], ["Deuteronomy", 34], ["Joshua", 24], ["Judges", 21], ["Ruth", 4], ["1 Samuel", 31], ["2 Samuel", 24],
  ["1 Kings", 22], ["2 Kings", 25], ["1 Chronicles", 29], ["2 Chronicles", 36], ["Ezra", 10], ["Nehemiah", 13], ["Esther", 10], ["Job", 42], ["Psalms", 150], ["Proverbs", 31],
  ["Ecclesiastes", 12], ["Song of Songs", 8], ["Isaiah", 66], ["Jeremiah", 52], ["Lamentations", 5], ["Ezekiel", 48], ["Daniel", 12], ["Hosea", 14], ["Joel", 3], ["Amos", 9],
  ["Obadiah", 1], ["Jonah", 4], ["Micah", 7], ["Nahum", 3], ["Habakkuk", 3], ["Zephaniah", 3], ["Haggai", 2], ["Zechariah", 14], ["Malachi", 4],
];
const NT: [string, number][] = [
  ["Matthew", 28], ["Mark", 16], ["Luke", 24], ["John", 21], ["Acts", 28], ["Romans", 16], ["1 Corinthians", 16], ["2 Corinthians", 13], ["Galatians", 6], ["Ephesians", 6],
  ["Philippians", 4], ["Colossians", 4], ["1 Thessalonians", 5], ["2 Thessalonians", 3], ["1 Timothy", 6], ["2 Timothy", 4], ["Titus", 3], ["Philemon", 1], ["Hebrews", 13], ["James", 5],
  ["1 Peter", 5], ["2 Peter", 3], ["1 John", 5], ["2 John", 1], ["3 John", 1], ["Jude", 1], ["Revelation", 22],
];
const ch = (o: [string, number][]) => Object.fromEntries(o);
const otc = ch(OT);
const TORAH: [string, number][] = [["Genesis", 50], ["Exodus", 40], ["Leviticus", 27], ["Numbers", 36], ["Deuteronomy", 34]];
const NEVIIM: [string, number][] = [
  ["Joshua", 24], ["Judges", 21], ["1 Samuel", 31], ["2 Samuel", 24], ["1 Kings", 22], ["2 Kings", 25], ["Isaiah", 66], ["Jeremiah", 52], ["Ezekiel", 48],
  ["Hosea", 14], ["Joel", 4], ["Amos", 9], ["Obadiah", 1], ["Jonah", 4], ["Micah", 7], ["Nahum", 3], ["Habakkuk", 3], ["Zephaniah", 3], ["Haggai", 2], ["Zechariah", 14], ["Malachi", 3],
];
const KETUVIM: [string, number][] = (["Psalms", "Proverbs", "Job", "Song of Songs", "Ruth", "Lamentations", "Ecclesiastes", "Esther", "Daniel", "Ezra", "Nehemiah", "1 Chronicles", "2 Chronicles"] as const).map((b) => [b, otc[b]!]);

const PARASHIYOT = [
  "Bereshit", "Noach", "Lech-Lecha", "Vayera", "Chayei Sarah", "Toldot", "Vayetzei", "Vayishlach", "Vayeshev", "Miketz", "Vayigash", "Vayechi",
  "Shemot", "Vaera", "Bo", "Beshalach", "Yitro", "Mishpatim", "Terumah", "Tetzaveh", "Ki Tisa", "Vayakhel", "Pekudei",
  "Vayikra", "Tzav", "Shmini", "Tazria", "Metzora", "Achrei Mot", "Kedoshim", "Emor", "Behar", "Bechukotai",
  "Bamidbar", "Nasso", "Beha'alotcha", "Sh'lach", "Korach", "Chukat", "Balak", "Pinchas", "Matot", "Masei",
  "Devarim", "Vaetchanan", "Eikev", "Re'eh", "Shoftim", "Ki Teitzei", "Ki Tavo", "Nitzavim", "Vayeilech", "Ha'azinu", "V'Zot HaBerachah",
];

const UPANISHADS = ["Isha", "Kena", "Katha", "Prashna", "Mundaka", "Mandukya", "Taittiriya", "Aitareya", "Chandogya", "Brihadaranyaka", "Shvetashvatara"];
const DHAMMAPADA = [
  "Pairs", "Heedfulness", "The Mind", "Flowers", "The Fool", "The Wise", "The Arahant", "The Thousands", "Evil", "Violence", "Old Age", "The Self", "The World",
  "The Buddha", "Happiness", "Affection", "Anger", "Impurity", "The Just", "The Path", "Miscellaneous", "Hell", "The Elephant", "Craving", "The Monk", "The Brahmin",
];

const CATHOLIC_OT: [string, number][] = [
  ...OT.slice(0, 16), ["Tobit", 14], ["Judith", 16], ["Esther", 10], ["1 Maccabees", 16], ["2 Maccabees", 15], ["Job", 42], ["Psalms", 150], ["Proverbs", 31], ["Ecclesiastes", 12],
  ["Song of Songs", 8], ["Wisdom", 19], ["Sirach", 51], ["Isaiah", 66], ["Jeremiah", 52], ["Lamentations", 5], ["Baruch", 6], ["Ezekiel", 48], ["Daniel", 14], ...OT.slice(27),
];

export const TEXTS: Record<Faith, TextDef[]> = {
  christian: [...bible("bible", "Old Testament", OT), ...bible("bible", "New Testament", NT)],
  catholic: [
    ...bible("catholic", "Old Testament", CATHOLIC_OT),
    ...bible("catholic", "New Testament", NT),
    { key: "catholic:catechism", title: "Catechism of the Catholic Church", group: "Teaching", sections: 4, sectionLabel: "Part", names: ["The Profession of Faith", "The Celebration of the Christian Mystery", "Life in Christ", "Christian Prayer"], about: "2,865 paragraphs in four parts: the Creed, the sacraments, the commandments and prayer." },
    { key: "catholic:imitation", title: "The Imitation of Christ", group: "Spiritual classics", sections: 4, sectionLabel: "Book", about: "Thomas à Kempis." },
    { key: "catholic:confessions", title: "Confessions of St. Augustine", group: "Spiritual classics", sections: 13, sectionLabel: "Book" },
    { key: "catholic:story_of_a_soul", title: "Story of a Soul (St. Thérèse)", group: "Spiritual classics", sections: 11, sectionLabel: "Chapter" },
    { key: "catholic:introduction_devout", title: "Introduction to the Devout Life", group: "Spiritual classics", sections: 5, sectionLabel: "Part", about: "St. Francis de Sales." },
  ],
  jewish: [
    { key: "jewish:parashah", title: "Weekly Torah portions", group: "Parashat HaShavua", sections: 54, sectionLabel: "Portion", names: PARASHIYOT, about: "The 54 weekly portions read through the year, from Bereshit to V'Zot HaBerachah." },
    ...bible("tanakh", "Torah", TORAH),
    ...bible("tanakh", "Nevi'im (Prophets)", NEVIIM),
    ...bible("tanakh", "Ketuvim (Writings)", KETUVIM),
    { key: "jewish:pirkei_avot", title: "Pirkei Avot", group: "Mishnah", sections: 6, sectionLabel: "Chapter", about: "Ethics of the Fathers; traditionally studied on Shabbat afternoons between Passover and Rosh Hashanah." },
  ],
  hindu: [
    { key: "hindu:gita", title: "Bhagavad Gita", group: "Scripture", sections: 18, sectionLabel: "Chapter", about: "Krishna's teaching to Arjuna: 18 chapters, 700 verses." },
    { key: "hindu:upanishads", title: "Principal Upanishads", group: "Scripture", sections: UPANISHADS.length, sectionLabel: "Upanishad", names: UPANISHADS },
    { key: "hindu:yoga_sutras", title: "Yoga Sutras of Patanjali", group: "Scripture", sections: 4, sectionLabel: "Pada", names: ["Samadhi", "Sadhana", "Vibhuti", "Kaivalya"] },
    { key: "hindu:ramayana", title: "Ramayana (Valmiki)", group: "Epics", sections: 7, sectionLabel: "Kanda", names: ["Bala", "Ayodhya", "Aranya", "Kishkindha", "Sundara", "Yuddha", "Uttara"] },
    { key: "hindu:ramcharitmanas", title: "Ramcharitmanas (Tulsidas)", group: "Epics", sections: 7, sectionLabel: "Kand", names: ["Bal", "Ayodhya", "Aranya", "Kishkindha", "Sundar", "Lanka", "Uttar"] },
    {
      key: "hindu:mahabharata",
      title: "Mahabharata",
      group: "Epics",
      sections: 18,
      sectionLabel: "Parva",
      names: ["Adi", "Sabha", "Vana", "Virata", "Udyoga", "Bhishma", "Drona", "Karna", "Shalya", "Sauptika", "Stri", "Shanti", "Anushasana", "Ashvamedhika", "Ashramavasika", "Mausala", "Mahaprasthanika", "Svargarohana"],
    },
  ],
  buddhist: [
    { key: "buddhist:dhammapada", title: "Dhammapada", group: "Pali Canon", sections: 26, sectionLabel: "Chapter", names: DHAMMAPADA, about: "423 verses of the Buddha's teaching in 26 chapters." },
    { key: "buddhist:sutta_nipata", title: "Sutta Nipata", group: "Pali Canon", sections: 5, sectionLabel: "Chapter", names: ["The Snake", "The Lesser Chapter", "The Great Chapter", "The Octets", "The Way to the Beyond"] },
    { key: "buddhist:heart", title: "Heart Sutra", group: "Mahayana sutras", sections: 1, sectionLabel: "Reading" },
    { key: "buddhist:diamond", title: "Diamond Sutra", group: "Mahayana sutras", sections: 32, sectionLabel: "Section" },
    { key: "buddhist:lotus", title: "Lotus Sutra", group: "Mahayana sutras", sections: 28, sectionLabel: "Chapter" },
    { key: "buddhist:platform", title: "Platform Sutra", group: "Mahayana sutras", sections: 10, sectionLabel: "Chapter" },
    { key: "buddhist:bodhicharyavatara", title: "The Way of the Bodhisattva", group: "Teachings", sections: 10, sectionLabel: "Chapter", about: "Shantideva's Bodhicharyavatara." },
  ],
  spiritual: [{ key: "spiritual:tao", title: "Tao Te Ching", group: "Wisdom", sections: 81, sectionLabel: "Chapter" }],
};

export const textByKey = (key: string) => Object.values(TEXTS).flat().find((t) => t.key === key);
export const sectionName = (t: { sectionLabel: string; names?: string[] }, n: number) => (t.names?.[n - 1] ? t.names[n - 1]! : `${t.sectionLabel} ${n}`);

// ─── Daily words (public-domain translations) ───────────────────────────────

export const DAILY_WORDS: Record<Faith, { text: string; ref: string }[]> = {
  christian: [
    { text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.", ref: "John 3:16 (KJV)" },
    { text: "The Lord is my shepherd; I shall not want.", ref: "Psalm 23:1 (KJV)" },
    { text: "I can do all things through Christ which strengtheneth me.", ref: "Philippians 4:13 (KJV)" },
    { text: "Trust in the Lord with all thine heart; and lean not unto thine own understanding.", ref: "Proverbs 3:5 (KJV)" },
    { text: "Be still, and know that I am God.", ref: "Psalm 46:10 (KJV)" },
    { text: "And we know that all things work together for good to them that love God.", ref: "Romans 8:28 (KJV)" },
    { text: "Thy word is a lamp unto my feet, and a light unto my path.", ref: "Psalm 119:105 (KJV)" },
    { text: "Come unto me, all ye that labour and are heavy laden, and I will give you rest.", ref: "Matthew 11:28 (KJV)" },
    { text: "This is the day which the Lord hath made; we will rejoice and be glad in it.", ref: "Psalm 118:24 (KJV)" },
    { text: "Be strong and of a good courage; be not afraid, neither be thou dismayed: for the Lord thy God is with thee whithersoever thou goest.", ref: "Joshua 1:9 (KJV)" },
    { text: "Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up.", ref: "1 Corinthians 13:4 (KJV)" },
    { text: "Rejoice in the Lord alway: and again I say, Rejoice.", ref: "Philippians 4:4 (KJV)" },
    { text: "Casting all your care upon him; for he careth for you.", ref: "1 Peter 5:7 (KJV)" },
    { text: "Let all your things be done with charity.", ref: "1 Corinthians 16:14 (KJV)" },
  ],
  catholic: [
    { text: "Hail, full of grace, the Lord is with thee: blessed art thou among women.", ref: "Luke 1:28 (Douay-Rheims)" },
    { text: "Thou hast made us for thyself, O Lord, and our heart is restless until it rests in thee.", ref: "St. Augustine, Confessions 1.1" },
    { text: "Be it done to me according to thy word.", ref: "Luke 1:38 (Douay-Rheims)" },
    { text: "Whatsoever he shall say to you, do ye.", ref: "John 2:5 (Douay-Rheims)" },
    { text: "Thou art Peter; and upon this rock I will build my church.", ref: "Matthew 16:18 (Douay-Rheims)" },
    { text: "I am the bread of life: he that cometh to me shall not hunger.", ref: "John 6:35 (Douay-Rheims)" },
    { text: "Let nothing disturb you, let nothing frighten you; all things are passing; God never changes.", ref: "St. Teresa of Ávila" },
    { text: "Pray, hope, and don't worry.", ref: "St. Padre Pio" },
    { text: "Do small things with great love.", ref: "In the spirit of St. Thérèse and St. Teresa of Calcutta" },
    { text: "Jesus, I trust in you.", ref: "Divine Mercy devotion" },
  ],
  jewish: [
    { text: "Hear, O Israel: the Lord our God, the Lord is one.", ref: "Deuteronomy 6:4" },
    { text: "If I am not for myself, who will be for me? But if I am only for myself, what am I? And if not now, when?", ref: "Pirkei Avot 1:14 (Hillel)" },
    { text: "The world stands on three things: on Torah, on service, and on acts of loving-kindness.", ref: "Pirkei Avot 1:2" },
    { text: "Thou shalt love thy neighbour as thyself.", ref: "Leviticus 19:18" },
    { text: "It is not your duty to finish the work, but neither are you free to desist from it.", ref: "Pirkei Avot 2:16 (Rabbi Tarfon)" },
    { text: "Who is wise? One who learns from every person.", ref: "Pirkei Avot 4:1 (Ben Zoma)" },
    { text: "It hath been told thee, O man, what is good: only to do justly, and to love mercy, and to walk humbly with thy God.", ref: "Micah 6:8" },
    { text: "Behold, how good and how pleasant it is for brethren to dwell together in unity!", ref: "Psalm 133:1" },
    { text: "Justice, justice shalt thou follow.", ref: "Deuteronomy 16:20" },
  ],
  hindu: [
    { text: "You have a right to your actions, but never to the fruits of your actions.", ref: "Bhagavad Gita 2.47" },
    { text: "Whenever righteousness declines and unrighteousness rises, I manifest myself.", ref: "Bhagavad Gita 4.7" },
    { text: "The soul is never born and never dies.", ref: "Bhagavad Gita 2.20" },
    { text: "Lead me from the unreal to the real, from darkness to light, from death to immortality.", ref: "Brihadaranyaka Upanishad 1.3.28" },
    { text: "Truth is one; the wise call it by many names.", ref: "Rig Veda 1.164.46" },
    { text: "Yoga is the stilling of the movements of the mind.", ref: "Yoga Sutras 1.2" },
    { text: "Arise, awake, and learn by approaching the wise.", ref: "Katha Upanishad 1.3.14" },
    { text: "Whoever offers me with devotion a leaf, a flower, a fruit or water, that I accept.", ref: "Bhagavad Gita 9.26" },
  ],
  buddhist: [
    { text: "Hatred never ceases by hatred; by love alone does it cease. This is an eternal law.", ref: "Dhammapada 5" },
    { text: "All that we are is the result of what we have thought.", ref: "Dhammapada 1" },
    { text: "Better than a thousand hollow words is one word that brings peace.", ref: "Dhammapada 100" },
    { text: "Conquer anger with non-anger, evil with good, stinginess with giving, and a liar with truth.", ref: "Dhammapada 223" },
    { text: "May all beings be happy; may all beings be at ease.", ref: "Metta Sutta" },
    { text: "Health is the greatest gift, contentment the greatest wealth.", ref: "Dhammapada 204" },
    { text: "You yourselves must strive; the Buddhas only point the way.", ref: "Dhammapada 276" },
    { text: "Form is emptiness, emptiness is form.", ref: "Heart Sutra" },
  ],
  spiritual: [
    { text: "The journey of a thousand miles begins beneath one's feet.", ref: "Tao Te Ching 64" },
    { text: "As above, so below.", ref: "The Emerald Tablet" },
    { text: "Knowing others is intelligence; knowing yourself is true wisdom.", ref: "Tao Te Ching 33" },
    { text: "Nature does not hurry, yet everything is accomplished.", ref: "Attributed to Lao Tzu" },
  ],
};

export function wordOfDay(faith: Faith, isoDate: string) {
  const list = DAILY_WORDS[faith];
  const n = Math.floor(Date.parse(`${isoDate}T00:00:00Z`) / 86400000);
  return list[n % list.length]!;
}

export const BUDDHIST_PRECEPTS = [
  "I undertake to refrain from harming living beings.",
  "I undertake to refrain from taking what is not given.",
  "I undertake to refrain from sexual misconduct.",
  "I undertake to refrain from false speech.",
  "I undertake to refrain from intoxicants that cloud the mind.",
];
