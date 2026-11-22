/**
 * Holiday dates for the faith paths in the Spiritual section. Pure and
 * unit-tested (tests/faith-calendar.test.ts).
 *
 *  - Christian: Western computus (Gregorian) and Orthodox (Julian) Easter.
 *  - Jewish: the Hebrew calendar built into the JavaScript runtime (Intl,
 *    calendar "hebrew"). Holidays begin at sundown the evening before.
 *  - Hindu: lunisolar (amanta) months and tithis from the sun's and moon's
 *    positions (Meeus), sidereal signs with the Lahiri ayanamsa, Indian
 *    Standard Time. Each festival uses its customary time of day (sunrise,
 *    midday, afternoon, evening or midnight). Regional calendars can differ
 *    by a day, so families can adjust any date.
 *  - Buddhist: Theravada full-moon days from the same lunar months (Sri
 *    Lankan/Indian reckoning) and Mahayana days from the Chinese calendar
 *    (Intl, calendar "chinese").
 */
import { phasesBetween } from "./astro";

export const FAITHS = ["spiritual", "christian", "catholic", "jewish", "hindu", "buddhist"] as const;
export type Faith = (typeof FAITHS)[number];

export type Holiday = {
  faith: Faith;
  key: string;
  name: string;
  /** First (full) day, YYYY-MM-DD. */
  date: string;
  /** Last day for multi-day holidays. */
  endDate?: string;
  emoji: string;
  /** Short line about the day. */
  about: string;
  /** Main holidays are highlighted; others are observances. */
  major?: boolean;
  /** Tradition label, e.g. "Theravada", "Orthodox". */
  tradition?: string;
  /** Begins at sundown the evening before (Jewish days). */
  eve?: boolean;
};

const RAD = Math.PI / 180;
const sin = (d: number) => Math.sin(d * RAD);
const norm = (d: number) => ((d % 360) + 360) % 360;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const utcDate = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
export const addDaysIso = (isoDate: string, n: number) => iso(new Date(Date.parse(`${isoDate}T00:00:00Z`) + n * 86400000));
const dow = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`).getUTCDay();

// ─── Christian ───────────────────────────────────────────────────────────────

/** Western Easter Sunday (anonymous Gregorian algorithm). */
export function westernEaster(y: number): string {
  const a = y % 19,
    b = Math.floor(y / 100),
    c = y % 100,
    d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451),
    month = Math.floor((h + l - 7 * m + 114) / 31),
    day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(utcDate(y, month, day));
}

/** Orthodox Easter (Julian computus, shown on the Gregorian calendar; 1900–2099). */
export function orthodoxEaster(y: number): string {
  const a = y % 4,
    b = y % 7,
    c = y % 19,
    d = (19 * c + 15) % 30,
    e = (2 * a + 4 * b - d + 34) % 7,
    month = Math.floor((d + e + 114) / 31),
    day = ((d + e + 114) % 31) + 1;
  return addDaysIso(iso(utcDate(y, month, day)), 13);
}

/** First Sunday of Advent: the fourth Sunday before Christmas. */
export function adventSunday(y: number): string {
  const xmas = `${y}-12-25`;
  const back = dow(xmas) === 0 ? 7 : dow(xmas);
  return addDaysIso(xmas, -back - 21);
}

function christianHolidays(y: number): Holiday[] {
  const E = westernEaster(y);
  const O = orthodoxEaster(y);
  const at = (d: number) => addDaysIso(E, d);
  const h = (key: string, name: string, date: string, emoji: string, about: string, major = false, extra: Partial<Holiday> = {}): Holiday => ({ faith: "christian", key, name, date, emoji, about, major, ...extra });
  const list: Holiday[] = [
    h("epiphany", "Epiphany", `${y}-01-06`, "⭐", "The Magi visit the infant Jesus; the end of the Christmas season."),
    h("orthodox_christmas", "Orthodox Christmas", `${y}-01-07`, "🎄", "Christmas for churches that keep the Julian calendar.", false, { tradition: "Orthodox" }),
    h("candlemas", "Presentation of the Lord", `${y}-02-02`, "🕯️", "Candlemas: Jesus presented in the Temple."),
    h("ash_wednesday", "Ash Wednesday", at(-46), "✝️", "The first day of Lent: 40 days of prayer, fasting and giving.", true),
    h("annunciation", "Annunciation", `${y}-03-25`, "🕊️", "The angel Gabriel's announcement to Mary."),
    h("palm_sunday", "Palm Sunday", at(-7), "🌿", "Jesus' entry into Jerusalem; Holy Week begins.", true),
    h("maundy_thursday", "Maundy Thursday", at(-3), "🍷", "The Last Supper."),
    h("good_friday", "Good Friday", at(-2), "✝️", "The crucifixion of Jesus.", true),
    h("easter", "Easter Sunday", E, "🌅", "The resurrection of Jesus, the heart of the Christian year.", true),
    h("ascension", "Ascension Day", at(39), "☁️", "Jesus ascends into heaven, 40 days after Easter."),
    h("pentecost", "Pentecost", at(49), "🔥", "The Holy Spirit comes to the disciples; the birthday of the Church.", true),
    h("trinity", "Trinity Sunday", at(56), "☘️", "Celebrating Father, Son and Holy Spirit."),
    h("all_saints", "All Saints' Day", `${y}-11-01`, "😇", "Honoring all the saints, known and unknown."),
    h("advent", "First Sunday of Advent", adventSunday(y), "🕯️", "Four weeks of waiting and preparing for Christmas.", true),
    h("christmas_eve", "Christmas Eve", `${y}-12-24`, "🌟", "The night before Christmas; candlelight services."),
    h("christmas", "Christmas Day", `${y}-12-25`, "🎄", "The birth of Jesus.", true),
  ];
  if (O !== E) list.push(h("orthodox_easter", "Orthodox Easter (Pascha)", O, "🌅", "Easter for churches that keep the Julian calendar.", false, { tradition: "Orthodox" }));
  return list;
}

function catholicHolidays(y: number): Holiday[] {
  const E = westernEaster(y);
  const at = (d: number) => addDaysIso(E, d);
  const adv = adventSunday(y);
  const h = (key: string, name: string, date: string, emoji: string, about: string, major = false, obligation = false): Holiday => ({ faith: "catholic", key, name, date, emoji, about, major, tradition: obligation ? "Holy Day of Obligation" : undefined });
  // St. Joseph moves off Sundays of Lent / Holy Week; the Annunciation moves out of Holy Week and Easter week.
  let joseph = `${y}-03-19`;
  if (joseph >= at(-7) && joseph <= at(-1)) joseph = at(-8); // in Holy Week: the Saturday before Palm Sunday
  else if (dow(joseph) === 0) joseph = addDaysIso(joseph, 1); // a Sunday of Lent: the Monday after
  let annunciation = `${y}-03-25`;
  if (annunciation >= at(-7) && annunciation <= at(7)) annunciation = at(8);
  else if (dow(annunciation) === 0) annunciation = addDaysIso(annunciation, 1);
  let immaculate = `${y}-12-08`;
  if (dow(immaculate) === 0) immaculate = addDaysIso(immaculate, 1);
  return [
    h("mary_mother_of_god", "Solemnity of Mary, Mother of God", `${y}-01-01`, "👑", "Honoring Mary as the Mother of God on the octave of Christmas.", true, true),
    h("epiphany", "Epiphany of the Lord", `${y}-01-06`, "⭐", "The Magi adore the Christ child. (Kept on the nearest Sunday in the US.)"),
    h("presentation", "Presentation of the Lord (Candlemas)", `${y}-02-02`, "🕯️", "Jesus presented in the Temple; candles are blessed."),
    h("ash_wednesday", "Ash Wednesday", at(-46), "✝️", "Lent begins: ashes, fasting and abstinence.", true),
    h("st_joseph", "St. Joseph, Spouse of Mary", joseph, "🪚", "Solemnity of St. Joseph, protector of the Holy Family."),
    h("annunciation", "Annunciation of the Lord", annunciation, "🕊️", "Gabriel's message to Mary; the Word becomes flesh."),
    h("palm_sunday", "Palm Sunday of the Passion", at(-7), "🌿", "Holy Week begins with blessed palms.", true),
    h("holy_thursday", "Holy Thursday", at(-3), "🍷", "The Mass of the Lord's Supper: the Eucharist and priesthood.", true),
    h("good_friday", "Good Friday", at(-2), "✝️", "The Passion of the Lord; a day of fasting and abstinence.", true),
    h("easter_vigil", "Easter Vigil", at(-1), "🔥", "The great vigil: new fire, baptisms and the first Mass of Easter."),
    h("easter", "Easter Sunday", E, "🌅", "The Resurrection of the Lord.", true, true),
    h("divine_mercy", "Divine Mercy Sunday", at(7), "❤️‍🔥", "The Second Sunday of Easter."),
    h("ascension", "Ascension of the Lord", at(39), "☁️", "Forty days after Easter. (Moved to Sunday in many US dioceses.)", false, true),
    h("pentecost", "Pentecost", at(49), "🔥", "The Holy Spirit descends on the Apostles.", true),
    h("trinity", "Most Holy Trinity", at(56), "☘️", "Father, Son and Holy Spirit."),
    h("corpus_christi", "Corpus Christi", at(60), "🍞", "The Most Holy Body and Blood of Christ. (Kept on Sunday in the US.)"),
    h("sacred_heart", "Sacred Heart of Jesus", at(68), "❤️", "Devotion to the love of Christ's heart."),
    h("sts_peter_paul", "Sts. Peter and Paul", `${y}-06-29`, "🗝️", "The two great Apostles of Rome."),
    h("assumption", "Assumption of Mary", `${y}-08-15`, "🌟", "Mary taken body and soul into heaven.", true, true),
    h("all_saints", "All Saints' Day", `${y}-11-01`, "😇", "Honoring all the saints in heaven.", true, true),
    h("all_souls", "All Souls' Day", `${y}-11-02`, "🕯️", "Praying for all the faithful departed."),
    h("christ_the_king", "Christ the King", addDaysIso(adv, -7), "👑", "The last Sunday of the church year."),
    h("advent", "First Sunday of Advent", adv, "🕯️", "The new church year begins; the Advent wreath is lit.", true),
    h("immaculate_conception", "Immaculate Conception", immaculate, "💙", "Mary conceived without original sin. (Patronal feast of the US.)", true, true),
    h("guadalupe", "Our Lady of Guadalupe", `${y}-12-12`, "🌹", "Mary's appearance to St. Juan Diego in 1531."),
    h("christmas", "Christmas: Nativity of the Lord", `${y}-12-25`, "🎄", "The birth of Jesus.", true, true),
    ...SAINTS.map(([md, name, emoji, about]) => ({ faith: "catholic" as const, key: `saint:${md}`, name, date: `${y}-${md}`, emoji, about, tradition: "Saints" })),
  ];
}

/** Feasts and memorials of saints (General Roman Calendar, plus well-loved US days). */
export const SAINTS: [string, string, string, string][] = [
  ["01-02", "Sts. Basil the Great & Gregory Nazianzen", "📜", "Bishops and Doctors of the Church."],
  ["01-04", "St. Elizabeth Ann Seton", "🏫", "First American-born saint; founded Catholic schools."],
  ["01-17", "St. Anthony of Egypt", "🏜️", "Father of monks."],
  ["01-21", "St. Agnes", "🐑", "Young Roman martyr."],
  ["01-24", "St. Francis de Sales", "✒️", "Patron of writers and journalists."],
  ["01-25", "Conversion of St. Paul", "⚡", "Saul becomes Paul on the road to Damascus."],
  ["01-28", "St. Thomas Aquinas", "📚", "Doctor of the Church; patron of students."],
  ["01-31", "St. John Bosco", "🧒", "Priest who cared for poor boys; patron of youth."],
  ["02-03", "St. Blaise", "🕯️", "Blessing of throats."],
  ["02-05", "St. Agatha", "🌋", "Virgin and martyr of Sicily."],
  ["02-10", "St. Scholastica", "⛪", "Sister of St. Benedict."],
  ["02-11", "Our Lady of Lourdes", "💧", "Mary's appearances to St. Bernadette; World Day of the Sick."],
  ["02-14", "Sts. Cyril & Methodius", "🔤", "Apostles to the Slavs. (Also the day of St. Valentine.)"],
  ["02-22", "Chair of St. Peter", "🗝️", "Peter's authority as shepherd of the Church."],
  ["03-07", "Sts. Perpetua & Felicity", "🦁", "Martyrs of Carthage."],
  ["03-17", "St. Patrick", "☘️", "Apostle of Ireland."],
  ["04-25", "St. Mark, Evangelist", "🦁", "Author of the second Gospel."],
  ["04-29", "St. Catherine of Siena", "🔥", "Doctor of the Church; patron of Italy and Europe."],
  ["05-01", "St. Joseph the Worker", "🔨", "Patron of workers."],
  ["05-03", "Sts. Philip & James", "✝️", "Apostles."],
  ["05-13", "Our Lady of Fatima", "🌹", "Mary's appearances to three children in Portugal, 1917."],
  ["05-14", "St. Matthias", "✝️", "Chosen to replace Judas among the Twelve."],
  ["05-26", "St. Philip Neri", "😄", "The joyful saint of Rome."],
  ["05-31", "Visitation of Mary", "🤰", "Mary visits Elizabeth."],
  ["06-13", "St. Anthony of Padua", "🔎", "Patron of lost things."],
  ["06-24", "Nativity of St. John the Baptist", "🌊", "The birth of the forerunner of the Lord."],
  ["06-29", "Sts. Peter & Paul", "🗝️", "The two great Apostles of Rome."],
  ["07-03", "St. Thomas the Apostle", "✋", "\"My Lord and my God!\""],
  ["07-11", "St. Benedict", "📿", "Father of Western monasticism."],
  ["07-22", "St. Mary Magdalene", "🌸", "Apostle to the Apostles; first witness of the Resurrection."],
  ["07-25", "St. James the Apostle", "🐚", "Patron of pilgrims (Santiago)."],
  ["07-26", "Sts. Joachim & Anne", "👵", "Parents of Mary; patrons of grandparents."],
  ["07-31", "St. Ignatius of Loyola", "🧭", "Founder of the Jesuits; the Spiritual Exercises."],
  ["08-04", "St. John Vianney", "⛪", "Patron of parish priests."],
  ["08-06", "Transfiguration of the Lord", "✨", "Jesus shines in glory on the mountain."],
  ["08-08", "St. Dominic", "🐕", "Founder of the Dominicans; the Rosary."],
  ["08-10", "St. Lawrence", "🔥", "Deacon and martyr."],
  ["08-11", "St. Clare of Assisi", "🌅", "Founder of the Poor Clares."],
  ["08-14", "St. Maximilian Kolbe", "🕊️", "Gave his life for another prisoner at Auschwitz."],
  ["08-22", "Queenship of Mary", "👑", "Mary, Queen of Heaven."],
  ["08-24", "St. Bartholomew", "✝️", "Apostle."],
  ["08-27", "St. Monica", "🙏", "Patron of mothers; prayed for her son Augustine."],
  ["08-28", "St. Augustine", "❤️", "Bishop and Doctor: \"Our heart is restless until it rests in you.\""],
  ["09-03", "St. Gregory the Great", "🎶", "Pope and Doctor; Gregorian chant."],
  ["09-05", "St. Teresa of Calcutta", "🤲", "Served the poorest of the poor."],
  ["09-08", "Nativity of Mary", "🎂", "Mary's birthday."],
  ["09-14", "Exaltation of the Holy Cross", "✝️", "Honoring the Cross of Christ."],
  ["09-15", "Our Lady of Sorrows", "💔", "Mary's seven sorrows."],
  ["09-21", "St. Matthew, Evangelist", "💰", "Tax collector turned Apostle; author of the first Gospel."],
  ["09-23", "St. Padre Pio", "🩹", "Capuchin priest and confessor."],
  ["09-29", "Sts. Michael, Gabriel & Raphael", "🗡️", "The archangels."],
  ["09-30", "St. Jerome", "📖", "Translated the Bible into Latin."],
  ["10-01", "St. Thérèse of Lisieux", "🌹", "The Little Flower; the Little Way."],
  ["10-02", "Guardian Angels", "😇", "The angels who watch over us."],
  ["10-04", "St. Francis of Assisi", "🐦", "Lover of the poor and creation; blessing of animals."],
  ["10-07", "Our Lady of the Rosary", "📿", "The month of the Rosary."],
  ["10-15", "St. Teresa of Ávila", "🏰", "Doctor of the Church; The Interior Castle."],
  ["10-18", "St. Luke, Evangelist", "🩺", "Physician and author of the third Gospel."],
  ["10-22", "St. John Paul II", "🇵🇱", "Pope from 1978 to 2005."],
  ["10-28", "Sts. Simon & Jude", "✝️", "Apostles; Jude is patron of hopeless causes."],
  ["11-04", "St. Charles Borromeo", "⛪", "Reforming bishop of Milan."],
  ["11-11", "St. Martin of Tours", "🧥", "Soldier who shared his cloak with a beggar."],
  ["11-21", "Presentation of Mary", "🕊️", "Mary presented in the Temple."],
  ["11-22", "St. Cecilia", "🎵", "Patron of musicians."],
  ["11-30", "St. Andrew the Apostle", "🎣", "Brother of Peter; first called."],
  ["12-03", "St. Francis Xavier", "🌏", "Missionary to Asia."],
  ["12-06", "St. Nicholas", "🎁", "Bishop of Myra; secret gift-giver."],
  ["12-13", "St. Lucy", "🕯️", "Virgin and martyr; festival of light."],
  ["12-14", "St. John of the Cross", "🌌", "Doctor of the Church; the Dark Night of the Soul."],
  ["12-26", "St. Stephen", "🪨", "The first martyr."],
  ["12-27", "St. John the Apostle", "🦅", "The beloved disciple."],
  ["12-28", "Holy Innocents", "👶", "The children of Bethlehem."],
];

/** Saint(s) whose feast is on this date. */
export const saintsOn = (isoDate: string) => SAINTS.filter(([md]) => md === isoDate.slice(5)).map(([, name, emoji, about]) => ({ name, emoji, about }));

/** The mysteries of the Rosary prayed on each weekday. */
export function rosaryMysteries(isoDate: string) {
  const d = dow(isoDate);
  return d === 1 || d === 6 ? "Joyful" : d === 2 || d === 5 ? "Sorrowful" : d === 4 ? "Luminous" : "Glorious";
}

export type Season = { key: string; name: string; color: string; note: string };

/** Western liturgical season for a date. */
export function liturgicalSeason(date: string): Season {
  const y = Number(date.slice(0, 4));
  const E = westernEaster(y);
  const ash = addDaysIso(E, -46);
  const pent = addDaysIso(E, 49);
  const adv = adventSunday(y);
  if (date >= `${y}-12-25` || date <= `${y}-01-06`) return { key: "christmas", name: "Christmastide", color: "white", note: "Celebrating the birth of Jesus." };
  if (date >= adv) return { key: "advent", name: "Advent", color: "purple", note: "Waiting and preparing for Christmas." };
  if (date >= ash && date < addDaysIso(E, -7)) return { key: "lent", name: "Lent", color: "purple", note: `Day ${daysFrom(ash, date) + 1 - sundaysBetween(ash, date)} of the 40 days of Lent.` };
  if (date >= addDaysIso(E, -7) && date < E) return { key: "holy_week", name: "Holy Week", color: "red", note: "The last week before Easter." };
  if (date >= E && date < pent) return { key: "easter", name: "Eastertide", color: "white", note: `Day ${daysFrom(E, date) + 1} of the 50 days of Easter.` };
  if (date === pent) return { key: "pentecost", name: "Pentecost", color: "red", note: "The coming of the Holy Spirit." };
  return { key: "ordinary", name: "Ordinary Time", color: "green", note: "Growing in faith day by day." };
}
const daysFrom = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const sundaysBetween = (a: string, b: string) => {
  let n = 0;
  for (let d = a; d <= b; d = addDaysIso(d, 1)) if (dow(d) === 0) n++;
  return n;
};

// ─── Jewish ──────────────────────────────────────────────────────────────────

const hebrewFmt = new Intl.DateTimeFormat("en-US-u-ca-hebrew", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
export type HebrewDate = { day: number; month: string; year: number };
export function hebrewDate(isoDate: string): HebrewDate {
  const parts = hebrewFmt.formatToParts(new Date(`${isoDate}T12:00:00Z`));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { day: Number(get("day")), month: get("month"), year: Number(get("year")) };
}
export const hebrewLabel = (isoDate: string) => {
  const h = hebrewDate(isoDate);
  return `${h.day} ${h.month} ${h.year}`;
};

const yearDays = new Map<number, { date: string; h: HebrewDate }[]>();
function hebrewYearMap(y: number) {
  let days = yearDays.get(y);
  if (!days) {
    days = [];
    for (let d = `${y}-01-01`; d <= `${y}-12-31`; d = addDaysIso(d, 1)) days.push({ date: d, h: hebrewDate(d) });
    yearDays.set(y, days);
  }
  return days;
}
/** Gregorian dates in year y that fall on this Hebrew month/day. */
function onHebrew(y: number, months: string[], day: number) {
  return hebrewYearMap(y).filter((x) => x.h.day === day && months.includes(x.h.month)).map((x) => x.date);
}

/** Day of the Omer (1–49) or null. */
export function omerDay(isoDate: string): number | null {
  const h = hebrewDate(isoDate);
  const n = h.month === "Nisan" && h.day >= 16 ? h.day - 15 : h.month === "Iyar" ? h.day + 15 : h.month === "Sivan" && h.day <= 5 ? h.day + 44 : 0;
  return n > 0 && n <= 49 ? n : null;
}

function jewishHolidays(y: number): Holiday[] {
  const out: Holiday[] = [];
  const add = (key: string, name: string, months: string[], day: number, len: number, emoji: string, about: string, major = false, shift?: (d: string) => string) => {
    for (const d0 of onHebrew(y, months, day)) {
      const d = shift ? shift(d0) : d0;
      out.push({ faith: "jewish", key, name, date: d, endDate: len > 1 ? addDaysIso(d, len - 1) : undefined, emoji, about, major, eve: true });
    }
  };
  add("rosh_hashanah", "Rosh Hashanah", ["Tishri"], 1, 2, "🍎", "The Jewish New Year: apples and honey, the shofar, a sweet year ahead.", true);
  add("yom_kippur", "Yom Kippur", ["Tishri"], 10, 1, "🕍", "The Day of Atonement: fasting, prayer and repentance.", true);
  add("sukkot", "Sukkot", ["Tishri"], 15, 7, "🌿", "The Festival of Booths: meals in the sukkah, the lulav and etrog.", true);
  add("shemini_atzeret", "Shemini Atzeret", ["Tishri"], 22, 1, "🙏", "The eighth day of assembly after Sukkot.");
  add("simchat_torah", "Simchat Torah", ["Tishri"], 23, 1, "📜", "Rejoicing with the Torah as the yearly reading starts again.", true);
  add("hanukkah", "Hanukkah", ["Kislev"], 25, 8, "🕎", "The Festival of Lights: eight nights of candles, latkes and dreidels.", true);
  add("tu_bishvat", "Tu BiShvat", ["Shevat"], 15, 1, "🌳", "The New Year of the Trees.");
  add("purim", "Purim", ["Adar", "Adar II"], 14, 1, "🎭", "Esther's story: the Megillah, costumes, gifts of food and charity.", true);
  add("passover", "Passover (Pesach)", ["Nisan"], 15, 8, "🍷", "Freedom from Egypt: the Seder, matzah and the Haggadah.", true);
  add("yom_hashoah", "Yom HaShoah", ["Nisan"], 27, 1, "🕯️", "Holocaust Remembrance Day.", false, (d) => (dow(d) === 5 ? addDaysIso(d, -1) : dow(d) === 0 ? addDaysIso(d, 1) : d));
  add("yom_haatzmaut", "Yom HaAtzmaut", ["Iyar"], 5, 1, "🇮🇱", "Israel Independence Day.", false, (d) => (dow(d) === 5 ? addDaysIso(d, -1) : dow(d) === 6 ? addDaysIso(d, -2) : dow(d) === 1 ? addDaysIso(d, 1) : d));
  add("lag_baomer", "Lag BaOmer", ["Iyar"], 18, 1, "🔥", "The 33rd day of the Omer: bonfires and celebration.");
  add("shavuot", "Shavuot", ["Sivan"], 6, 2, "📜", "The giving of the Torah at Sinai; dairy foods and all-night study.", true);
  add("tisha_bav", "Tisha B'Av", ["Av"], 9, 1, "🕯️", "A fast day mourning the destruction of the Temples.", false, (d) => (dow(d) === 6 ? addDaysIso(d, 1) : d));
  return out;
}

// ─── Sun, moon, tithi (Hindu & Theravada reckoning) ──────────────────────────

const jd = (d: Date) => d.getTime() / 86400000 + 2440587.5;
const centuries = (d: Date) => (jd(d) + 69 / 86400 - 2451545) / 36525;

/** Apparent tropical longitude of the sun (Meeus ch. 25, ~0.01°). */
export function sunLongitude(at: Date) {
  const T = centuries(at);
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sin(M) + (0.019993 - 0.000101 * T) * sin(2 * M) + 0.000289 * sin(3 * M);
  return norm(L0 + C - 0.00569 - 0.00478 * sin(125.04 - 1934.136 * T));
}

// Meeus table 47.A: D, M, M', F, coefficient (1e-6 degrees).
const MOON: [number, number, number, number, number][] = [
  [0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314], [0, 0, 2, 0, 213618], [0, 1, 0, 0, -185116],
  [0, 0, 0, 2, -114332], [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066], [2, 0, 1, 0, 53322], [2, -1, 0, 0, 45758],
  [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720], [0, 1, 1, 0, -30383], [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528],
  [0, 0, 1, -2, 10980], [4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034], [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888],
  [2, 1, 0, 0, -6766], [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036], [2, 0, 2, 0, 3994],
  [4, 0, 0, 0, 3861], [2, 0, -3, 0, 3665], [0, 1, -2, 0, -2689], [2, 0, -1, 2, -2602], [2, -1, -2, 0, 2390],
  [1, 0, 1, 0, -2348], [2, -2, 0, 0, 2236], [0, 1, 2, 0, -2120], [0, 2, 0, 0, -2069], [2, -2, -1, 0, 2048],
  [2, 0, 1, -2, -1773], [2, 0, 0, 2, -1595], [4, -1, -1, 0, 1215], [0, 0, 2, 2, -1110], [3, 0, -1, 0, -892],
];

/** Apparent-enough tropical longitude of the moon (Meeus ch. 47, ~0.01°). */
export function moonLongitudeFine(at: Date) {
  const T = centuries(at);
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T;
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T;
  const F = 93.272095 + 483202.0175233 * T - 0.0036539 * T * T;
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  let s = 0;
  for (const [d, m, mp, f, c] of MOON) s += c * (Math.abs(m) === 1 ? E : m ? E * E : 1) * sin(d * D + m * M + mp * Mp + f * F);
  const A1 = 119.75 + 131.849 * T;
  const A2 = 53.09 + 479264.29 * T;
  s += 3958 * sin(A1) + 1962 * sin(Lp - F) + 318 * sin(A2);
  return norm(Lp + s / 1e6 - 0.00478 * sin(125.04 - 1934.136 * T));
}

/** Tithi (lunar day) 1–30 at an instant: 1–15 bright half (shukla), 16–30 dark half (krishna). */
export function tithiAt(at: Date) {
  return Math.floor(norm(moonLongitudeFine(at) - sunLongitude(at)) / 12) + 1;
}

/** Lahiri ayanamsa (degrees). */
const ayanamsa = (at: Date) => 23.853 + ((at.getTime() - Date.UTC(2000, 0, 1)) / (365.25 * 86400000)) * 0.013969;
const siderealSun = (at: Date) => norm(sunLongitude(at) - ayanamsa(at));

export const HINDU_MONTHS = ["Chaitra", "Vaishakha", "Jyeshtha", "Ashadha", "Shravana", "Bhadrapada", "Ashvin", "Kartika", "Margashirsha", "Pausha", "Magha", "Phalguna"] as const;
export type HinduMonth = (typeof HINDU_MONTHS)[number];
type LunarMonth = { name: HinduMonth; adhika: boolean; start: Date; end: Date };

const IST = 330; // minutes
/** Amanta lunar months whose new moons fall from late in y-1 through early y+1. */
function lunarMonths(y: number): LunarMonth[] {
  const news = phasesBetween(new Date(Date.UTC(y - 1, 10, 1)), new Date(Date.UTC(y + 1, 2, 1)))
    .filter((e) => e.phase === "new")
    .map((e) => e.at);
  const sign = (d: Date) => Math.floor(siderealSun(d) / 30);
  const out: LunarMonth[] = [];
  for (let i = 0; i + 1 < news.length; i++) {
    const s = sign(news[i]!);
    out.push({ name: HINDU_MONTHS[(s + 1) % 12]!, adhika: sign(news[i + 1]!) === s, start: news[i]!, end: news[i + 1]! });
  }
  return out;
}

const istDate = (at: Date) => iso(new Date(at.getTime() + IST * 60000));
const istInstant = (isoDate: string, hours: number) => new Date(Date.parse(`${isoDate}T00:00:00Z`) + (hours * 60 - IST) * 60000);

/**
 * The civil (IST) date a tithi is kept in a lunar month: the first day on which
 * the tithi is current at the customary hour (6 = sunrise, 12 = midday,
 * 14.5 = afternoon, 18.75 = evening, 24 = the following midnight). A tithi that
 * begins and ends between two of those moments is kept on the day it begins.
 */
function tithiDay(m: LunarMonth, tithi: number, hours: number): string | null {
  let prev: string | null = null;
  for (let d = addDaysIso(istDate(m.start), -1); d <= addDaysIso(istDate(m.end), 1); d = addDaysIso(d, 1)) {
    const at = istInstant(d, hours);
    if (at < m.start || at >= m.end) {
      if (at >= m.end) break;
      continue;
    }
    const t = tithiAt(at);
    if (t === tithi) return d;
    if (t > tithi) return prev ?? d;
    prev = d;
  }
  return null;
}

function monthNamed(months: LunarMonth[], y: number, name: HinduMonth): LunarMonth[] {
  return months.filter((m) => m.name === name && !m.adhika);
}

/** Day the sidereal sun enters a sign (0 = Aries … 9 = Capricorn), as an IST date in year y. */
function sankranti(y: number, sign: number): string {
  let lo = Date.UTC(y, 0, 1),
    hi = Date.UTC(y + 1, 0, 1);
  const target = sign * 30;
  // Find a bracket where sidereal longitude passes target.
  const diff = (t: number) => {
    const v = norm(siderealSun(new Date(t)) - target);
    return v > 180 ? v - 360 : v;
  };
  let t = lo;
  for (; t < hi; t += 86400000) if (diff(t) < 0 && diff(t + 86400000) >= 0) break;
  lo = t;
  hi = t + 86400000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (diff(mid) < 0) lo = mid;
    else hi = mid;
  }
  return istDate(new Date(hi));
}

type LunarRule = { key: string; name: string; month: HinduMonth; tithi: number; hours: number; emoji: string; about: string; major?: boolean; offset?: number; len?: number };

const HINDU_RULES: LunarRule[] = [
  { key: "vasant_panchami", name: "Vasant Panchami", month: "Magha", tithi: 5, hours: 6, emoji: "🪷", about: "Honoring Saraswati, goddess of learning and the arts; the start of spring." },
  { key: "maha_shivaratri", name: "Maha Shivaratri", month: "Magha", tithi: 29, hours: 24, emoji: "🔱", about: "The great night of Shiva: fasting, night-long worship and meditation.", major: true },
  { key: "holika_dahan", name: "Holika Dahan", month: "Phalguna", tithi: 15, hours: 18.75, emoji: "🔥", about: "The bonfire on the eve of Holi: good over evil." },
  { key: "holi", name: "Holi", month: "Phalguna", tithi: 15, hours: 18.75, offset: 1, emoji: "🎨", about: "The festival of colors and spring.", major: true },
  { key: "ugadi", name: "Ugadi / Gudi Padwa (New Year)", month: "Chaitra", tithi: 1, hours: 6, emoji: "🌸", about: "The lunar new year in much of India." },
  { key: "chaitra_navaratri", name: "Chaitra Navaratri", month: "Chaitra", tithi: 1, hours: 6, len: 9, emoji: "🪔", about: "Nine nights honoring the Goddess in spring." },
  { key: "ram_navami", name: "Rama Navami", month: "Chaitra", tithi: 9, hours: 12, emoji: "🏹", about: "The birth of Lord Rama.", major: true },
  { key: "hanuman_jayanti", name: "Hanuman Jayanti", month: "Chaitra", tithi: 15, hours: 6, emoji: "🐒", about: "The birth of Hanuman." },
  { key: "akshaya_tritiya", name: "Akshaya Tritiya", month: "Vaishakha", tithi: 3, hours: 6, emoji: "✨", about: "An auspicious day for new beginnings and giving." },
  { key: "guru_purnima", name: "Guru Purnima", month: "Ashadha", tithi: 15, hours: 6, emoji: "🙏", about: "Gratitude to one's teachers and gurus." },
  { key: "raksha_bandhan", name: "Raksha Bandhan", month: "Shravana", tithi: 15, hours: 6, emoji: "🧵", about: "Sisters tie a rakhi on their brothers' wrists; a bond of protection." },
  { key: "janmashtami", name: "Krishna Janmashtami", month: "Shravana", tithi: 23, hours: 6, emoji: "🦚", about: "The birth of Lord Krishna, celebrated at midnight.", major: true },
  { key: "ganesh_chaturthi", name: "Ganesh Chaturthi", month: "Bhadrapada", tithi: 4, hours: 12, emoji: "🐘", about: "The birth of Ganesha, remover of obstacles.", major: true },
  { key: "navaratri", name: "Sharad Navaratri", month: "Ashvin", tithi: 1, hours: 6, len: 9, emoji: "🪔", about: "Nine nights honoring Durga and the Goddess.", major: true },
  { key: "dussehra", name: "Dussehra (Vijayadashami)", month: "Ashvin", tithi: 10, hours: 14.5, emoji: "🏹", about: "Victory of good over evil: Rama over Ravana, Durga over Mahishasura.", major: true },
  { key: "karva_chauth", name: "Karva Chauth", month: "Ashvin", tithi: 19, hours: 6, emoji: "🌕", about: "A day-long fast for one's spouse, broken at moonrise." },
  { key: "dhanteras", name: "Dhanteras", month: "Ashvin", tithi: 28, hours: 18.75, emoji: "🪙", about: "The first day of Diwali; honoring Lakshmi and Dhanvantari." },
  { key: "diwali", name: "Diwali", month: "Ashvin", tithi: 30, hours: 18.75, emoji: "🪔", about: "The festival of lights and Lakshmi Puja.", major: true },
  { key: "govardhan_puja", name: "Govardhan Puja", month: "Kartika", tithi: 1, hours: 6, emoji: "⛰️", about: "Krishna lifts Govardhan hill; the day after Diwali." },
  { key: "bhai_dooj", name: "Bhai Dooj", month: "Kartika", tithi: 2, hours: 14.5, emoji: "🤝", about: "Celebrating the bond between brothers and sisters." },
  { key: "chhath", name: "Chhath Puja", month: "Kartika", tithi: 6, hours: 6, emoji: "🌅", about: "Offerings to the setting and rising sun." },
];

const lunarCache = new Map<string, Holiday[]>();
function lunarHolidays(faith: Faith, y: number, rules: LunarRule[], tradition?: string): Holiday[] {
  const months = lunarMonths(y);
  const out: Holiday[] = [];
  for (const r of rules) {
    for (const m of monthNamed(months, y, r.month)) {
      const d0 = tithiDay(m, r.tithi, r.hours);
      if (!d0) continue;
      const d = r.offset ? addDaysIso(d0, r.offset) : d0;
      if (d.slice(0, 4) !== String(y)) continue;
      out.push({ faith, key: r.key, name: r.name, date: d, endDate: r.len ? addDaysIso(d, r.len - 1) : undefined, emoji: r.emoji, about: r.about, major: r.major, tradition });
    }
  }
  return out;
}

function hinduHolidays(y: number): Holiday[] {
  return [
    { faith: "hindu", key: "makar_sankranti", name: "Makar Sankranti / Pongal", date: sankranti(y, 9), emoji: "🪁", about: "The sun enters Capricorn: harvest, kites and sweets.", major: true },
    ...lunarHolidays("hindu", y, HINDU_RULES),
  ];
}

/** Ekadashi fasting days (11th tithi of each half-month) between two dates. */
export function ekadashis(from: string, to: string): { date: string; paksha: "Shukla" | "Krishna"; month: HinduMonth }[] {
  const out: { date: string; paksha: "Shukla" | "Krishna"; month: HinduMonth }[] = [];
  const y0 = Number(from.slice(0, 4)),
    y1 = Number(to.slice(0, 4));
  const seen = new Set<string>();
  for (let y = y0; y <= y1; y++)
    for (const m of lunarMonths(y))
      for (const t of [11, 26]) {
        const d = tithiDay(m, t, 6);
        if (d && d >= from && d <= to && !seen.has(d)) {
          seen.add(d);
          out.push({ date: d, paksha: t === 11 ? "Shukla" : "Krishna", month: m.name });
        }
      }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Today's Hindu calendar: lunar month, half and tithi at sunrise (IST). */
export function panchang(isoDate: string) {
  const at = istInstant(isoDate, 6);
  const t = tithiAt(at);
  const y = Number(isoDate.slice(0, 4));
  const m = [...lunarMonths(y), ...lunarMonths(y + 1)].find((x) => at >= x.start && at < x.end);
  const n = t > 15 ? t - 15 : t;
  return {
    tithi: t,
    paksha: t <= 15 ? ("Shukla" as const) : ("Krishna" as const),
    name: t === 15 ? "Purnima (full moon)" : t === 30 ? "Amavasya (new moon)" : TITHI_NAMES[n - 1]!,
    month: m ? `${m.adhika ? "Adhika " : ""}${m.name}` : "",
  };
}
const TITHI_NAMES = ["Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Purnima"];

// ─── Buddhist ────────────────────────────────────────────────────────────────

const THERAVADA: LunarRule[] = [
  { key: "magha_puja", name: "Magha Puja (Sangha Day)", month: "Magha", tithi: 15, hours: 6, emoji: "🪷", about: "1,250 disciples gathered spontaneously to hear the Buddha.", major: true },
  { key: "vesak", name: "Vesak (Buddha Day)", month: "Vaishakha", tithi: 15, hours: 6, emoji: "☸️", about: "The Buddha's birth, enlightenment and passing away.", major: true },
  { key: "poson", name: "Poson", month: "Jyeshtha", tithi: 15, hours: 6, emoji: "🌕", about: "Buddhism comes to Sri Lanka." },
  { key: "asalha_puja", name: "Asalha Puja (Dhamma Day)", month: "Ashadha", tithi: 15, hours: 6, emoji: "☸️", about: "The Buddha's first teaching: the Four Noble Truths.", major: true },
  { key: "vassa", name: "Vassa begins (Rains Retreat)", month: "Ashadha", tithi: 15, hours: 6, offset: 1, emoji: "🌧️", about: "Three months of retreat and deeper practice." },
  { key: "pavarana", name: "Pavarana (end of Vassa)", month: "Ashvin", tithi: 15, hours: 6, emoji: "🪔", about: "The rains retreat ends; Kathina robe offerings follow.", major: true },
];

const chineseFmt = new Intl.DateTimeFormat("en-US-u-ca-chinese", { month: "numeric", day: "numeric", timeZone: "UTC" });
function chineseDays(y: number) {
  const out: { date: string; month: string; day: number }[] = [];
  for (let d = `${y}-01-01`; d <= `${y}-12-31`; d = addDaysIso(d, 1)) {
    const p = chineseFmt.formatToParts(new Date(`${d}T12:00:00Z`));
    out.push({ date: d, month: p.find((x) => x.type === "month")!.value, day: Number(p.find((x) => x.type === "day")!.value) });
  }
  return out;
}
const MAHAYANA: { key: string; name: string; month: string; day: number; emoji: string; about: string; major?: boolean }[] = [
  { key: "lunar_new_year", name: "Lunar New Year", month: "1", day: 1, emoji: "🧧", about: "New Year blessings and temple visits." },
  { key: "guanyin_birth", name: "Guanyin's Birthday", month: "2", day: 19, emoji: "🪷", about: "Honoring the bodhisattva of compassion." },
  { key: "buddha_birthday", name: "Buddha's Birthday", month: "4", day: 8, emoji: "👶", about: "Bathing the baby Buddha; lanterns and offerings.", major: true },
  { key: "guanyin_enlightenment", name: "Guanyin's Enlightenment", month: "6", day: 19, emoji: "🪷", about: "Guanyin's attainment of enlightenment." },
  { key: "ullambana", name: "Ullambana (Ghost Festival)", month: "7", day: 15, emoji: "🏮", about: "Offerings for ancestors and beings in suffering.", major: true },
  { key: "guanyin_renunciation", name: "Guanyin's Renunciation", month: "9", day: 19, emoji: "🪷", about: "Guanyin leaves home for the spiritual life." },
  { key: "amitabha", name: "Amitabha Buddha Day", month: "11", day: 17, emoji: "🙏", about: "Honoring Amitabha, the Buddha of Infinite Light." },
  { key: "laba", name: "Bodhi Day (Laba)", month: "12", day: 8, emoji: "🌳", about: "The Buddha's enlightenment; Laba congee.", major: true },
];

function buddhistHolidays(y: number): Holiday[] {
  const days = chineseDays(y);
  const mahayana = MAHAYANA.flatMap((r) => days.filter((d) => d.month === r.month && d.day === r.day).map((d) => ({ faith: "buddhist" as const, key: r.key, name: r.name, date: d.date, emoji: r.emoji, about: r.about, major: r.major, tradition: "Mahayana" })));
  return [
    ...lunarHolidays("buddhist", y, THERAVADA, "Theravada"),
    ...mahayana,
    { faith: "buddhist", key: "nirvana_day", name: "Nirvana Day (Parinirvana)", date: `${y}-02-15`, emoji: "🕊️", about: "Remembering the Buddha's passing into final nirvana.", tradition: "Mahayana" },
    { faith: "buddhist", key: "bodhi_day", name: "Bodhi Day", date: `${y}-12-08`, emoji: "🌳", about: "The Buddha's enlightenment under the Bodhi tree.", tradition: "Zen / Japan" },
  ];
}

/** Uposatha observance days (new, first-quarter, full and last-quarter moons) as local dates. */
export function uposathaDays(from: string, to: string, tzOffsetMinutes = 0) {
  return phasesBetween(new Date(`${from}T00:00:00Z`), new Date(Date.parse(`${to}T00:00:00Z`) + 2 * 86400000))
    .map((e) => ({ phase: e.phase, date: iso(new Date(e.at.getTime() + tzOffsetMinutes * 60000)) }))
    .filter((e) => e.date >= from && e.date <= to);
}

// ─── All ─────────────────────────────────────────────────────────────────────

/** Built-in holidays of a faith in a Gregorian year, sorted by date. */
export function holidaysFor(faith: Faith, y: number): Holiday[] {
  const k = `${faith}:${y}`;
  let list = lunarCache.get(k);
  if (!list) {
    list = faith === "christian" ? christianHolidays(y) : faith === "catholic" ? catholicHolidays(y) : faith === "jewish" ? jewishHolidays(y) : faith === "hindu" ? hinduHolidays(y) : faith === "buddhist" ? buddhistHolidays(y) : [];
    list.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
    lunarCache.set(k, list);
  }
  return list;
}

/** Holidays of a faith overlapping [from, to]. */
export function holidaysBetween(faith: Faith, from: string, to: string): Holiday[] {
  const out: Holiday[] = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) for (const h of holidaysFor(faith, y)) if ((h.endDate ?? h.date) >= from && h.date <= to) out.push(h);
  return out;
}
