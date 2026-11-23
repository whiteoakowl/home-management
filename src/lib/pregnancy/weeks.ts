/**
 * Week-by-week pregnancy content. EDUCATIONAL ONLY: general information that
 * applies to many pregnancies, not personal medical advice. Kept separate from
 * the app code so it can be reviewed and updated on its own, and the platform
 * admin can override any field for any week (pregnancy_week_content table,
 * /admin/pregnancy). Sizes and weights are typical averages; every baby grows
 * at their own pace.
 */

export type WeekContent = {
  week: number;
  /** Size comparison, e.g. "a lime". */
  size: string;
  emoji: string;
  /** Typical length (cm; crown–rump until week 20, then head to heel) and weight (g). */
  lengthCm: number | null;
  weightG: number | null;
  /** One-line summary of the baby this week. */
  baby: string;
  development: { body?: string; organs?: string; movement?: string; senses?: string };
  milestones: string[];
  bodyChanges: string;
  symptoms: string[];
  /** Appointments and tests commonly offered around now (your provider's plan comes first). */
  care: string[];
  prepare: string[];
  questions: string[];
};

type Base = Omit<WeekContent, "symptoms" | "care" | "prepare" | "questions"> & Partial<Pick<WeekContent, "symptoms" | "care" | "prepare" | "questions">>;

const T1_SYMPTOMS = ["Tiredness", "Nausea or vomiting", "Tender breasts", "Needing to pee more often", "Mood swings", "Food aversions or cravings", "Mild cramping or spotting (call your provider if it's heavy or painful)"];
const T2_SYMPTOMS = ["More energy for many people", "Round ligament twinges", "Heartburn", "Stuffy nose", "Back discomfort", "Leg cramps", "Skin changes"];
const T3_SYMPTOMS = ["Shortness of breath", "Back and pelvic discomfort", "Swollen feet and ankles", "Trouble sleeping", "Braxton Hicks (practice) contractions", "Heartburn", "Needing to pee often again"];

const W: Base[] = [
  { week: 1, size: "not yet", emoji: "🌱", lengthCm: null, weightG: null, baby: "Pregnancy is counted from the first day of your last period, so there's no baby yet this week.", development: { body: "Your body is getting ready to release an egg." }, milestones: ["Pregnancy week 1 starts on the first day of the last period"], bodyChanges: "This is your period week. Many providers suggest starting a prenatal vitamin with folic acid before conception.", care: ["A preconception check-up if you're planning"], prepare: ["Ask about a prenatal vitamin with folic acid"], questions: ["Should I start a prenatal vitamin now?"] },
  { week: 2, size: "not yet", emoji: "🌱", lengthCm: null, weightG: null, baby: "Ovulation usually happens around the end of this week. Conception may happen now.", development: { body: "An egg is released and can be fertilized within about a day." }, milestones: ["Ovulation", "Possible conception"], bodyChanges: "Some people notice ovulation signs like clear, stretchy discharge.", prepare: ["Keep taking folic acid if you've started"], questions: [] },
  { week: 3, size: "a pinhead", emoji: "🔬", lengthCm: 0.01, weightG: null, baby: "A fertilized egg is dividing into a ball of cells and travels to the uterus.", development: { body: "The ball of cells (blastocyst) is growing fast." }, milestones: ["Fertilization", "Cells divide quickly"], bodyChanges: "Usually no signs yet. Some notice light implantation spotting.", questions: [] },
  { week: 4, size: "a poppy seed", emoji: "🌰", lengthCm: 0.1, weightG: null, baby: "The embryo has implanted in the uterus. The placenta and amniotic sac are starting to form.", development: { body: "Cells are separating into layers that will become every part of the body.", organs: "The early placenta begins to form." }, milestones: ["Implantation", "A home pregnancy test may turn positive around now"], bodyChanges: "A missed period is often the first sign. Pregnancy hormones are rising.", care: ["Call your provider to book a first prenatal visit"], prepare: ["Start a list of medicines you take to ask about", "Book your first prenatal appointment"], questions: ["When should my first appointment be?", "Are my current medicines okay to continue?"] },
  { week: 5, size: "a sesame seed", emoji: "🫘", lengthCm: 0.2, weightG: null, baby: "The neural tube (future brain and spinal cord) is forming and the heart is starting to develop.", development: { organs: "A simple heart tube forms and may begin to beat.", body: "The neural tube forms; folic acid helps it close normally." }, milestones: ["Heart begins forming", "Neural tube forming"], bodyChanges: "Tiredness and tender breasts are common. Nausea may start." },
  { week: 6, size: "a lentil", emoji: "🫛", lengthCm: 0.4, weightG: null, baby: "Tiny buds that will become arms and legs appear. Cardiac activity may be seen on an early ultrasound.", development: { body: "Arm and leg buds appear.", organs: "The heart is beating fast; early ultrasound may show it." }, milestones: ["Arm and leg buds", "Heartbeat may be visible on ultrasound"], bodyChanges: "Morning sickness (which can happen any time of day) often begins or increases." },
  { week: 7, size: "a blueberry", emoji: "🫐", lengthCm: 1.0, weightG: 1, baby: "The brain is growing quickly and the face is beginning to take shape.", development: { body: "Facial features begin to form.", organs: "The brain, liver and kidneys are developing." }, milestones: ["Rapid brain growth"], bodyChanges: "You might need to pee more often and feel very tired." },
  { week: 8, size: "a raspberry", emoji: "🫐", lengthCm: 1.6, weightG: 1, baby: "Fingers and toes are starting to form, and the baby is making tiny movements you can't feel yet.", development: { body: "Fingers and toes begin to form; the tail is disappearing.", movement: "Tiny spontaneous movements begin (too small to feel)." }, milestones: ["Fingers and toes forming", "First tiny movements"], bodyChanges: "Your uterus is growing; clothes may feel tighter at the waist.", care: ["First prenatal visit (often weeks 8–10): health history, blood tests, maybe a dating ultrasound"], prepare: ["Write down questions for your first visit", "Gather your health history"], questions: ["How was my due date worked out?", "Which screening tests are offered, and when?", "What symptoms mean I should call you?"] },
  { week: 9, size: "a cherry", emoji: "🍒", lengthCm: 2.3, weightG: 2, baby: "All the essential organs have begun to form. Little earlobes are forming.", development: { organs: "The heart has divided into four chambers.", body: "Muscles are forming; the embryo begins to look more like a baby." }, milestones: ["Four-chambered heart"], bodyChanges: "Nausea and fatigue often peak around weeks 9–11." },
  { week: 10, size: "a strawberry", emoji: "🍓", lengthCm: 3.1, weightG: 4, baby: "The embryo is now called a fetus. Bones and cartilage are forming, and tiny nails are starting.", development: { body: "Bones and cartilage form; knees and elbows can bend.", organs: "Kidneys begin making urine." }, milestones: ["Now a fetus", "Bones forming"], bodyChanges: "Visible veins and a growing waistline are common.", care: ["Cell-free DNA (NIPT) blood screening may be offered from 10 weeks"], questions: ["Is NIPT screening right for me?"] },
  { week: 11, size: "a fig", emoji: "🟣", lengthCm: 4.1, weightG: 7, baby: "The baby is kicking and stretching, and hair follicles and tooth buds are forming.", development: { movement: "Kicking and stretching movements.", body: "Tooth buds and hair follicles form." }, milestones: ["Tooth buds form"], bodyChanges: "Some people start to feel a little less nauseous.", care: ["Nuchal translucency (NT) ultrasound may be offered between weeks 11 and 14"] },
  { week: 12, size: "a lime", emoji: "🍋‍🟩", lengthCm: 5.4, weightG: 14, baby: "Reflexes are developing: fingers open and close and the baby may suck. The intestines are moving into the belly.", development: { movement: "Reflexes like opening fingers and sucking.", organs: "The intestines move into the abdomen; the pancreas makes insulin." }, milestones: ["Reflexes developing"], bodyChanges: "The risk of miscarriage drops considerably by the end of the first trimester." },
  { week: 13, size: "a lemon", emoji: "🍋", lengthCm: 7.4, weightG: 23, baby: "Vocal cords are forming and the baby's fingerprints are beginning to develop.", development: { body: "Fingerprints are forming.", organs: "Vocal cords develop." }, milestones: ["Last week of the first trimester", "Fingerprints forming"], bodyChanges: "Energy often starts coming back. The uterus is rising above the pelvic bone.", prepare: ["Think about when and how you'd like to share your news"], questions: [] },
  { week: 14, size: "a peach", emoji: "🍑", lengthCm: 8.7, weightG: 43, baby: "The baby can squint, frown and grimace. Fine hair (lanugo) begins to cover the body.", development: { body: "Lanugo hair begins to grow.", movement: "Facial expressions like squinting and frowning." }, milestones: ["Second trimester begins", "Facial expressions"], bodyChanges: "Many people feel more energy and less nausea in the second trimester." },
  { week: 15, size: "an apple", emoji: "🍎", lengthCm: 10.1, weightG: 70, baby: "Bones are getting harder, and the baby may sense light through closed eyelids.", development: { body: "The skeleton is hardening.", senses: "The eyes may sense light." }, milestones: ["Bones hardening"], bodyChanges: "A stuffy nose or nosebleeds can happen from increased blood flow.", care: ["Quad/maternal serum screening may be offered between weeks 15 and 22"] },
  { week: 16, size: "an avocado", emoji: "🥑", lengthCm: 11.6, weightG: 100, baby: "The baby's heart pumps a lot of blood every day, and the eyes can move.", development: { organs: "The heart pumps about 25 quarts of blood a day.", senses: "Eyes can make small movements." }, milestones: ["Eyes move"], bodyChanges: "Some people feel the first flutters (quickening) between weeks 16 and 25, often later in a first pregnancy." },
  { week: 17, size: "a pear", emoji: "🍐", lengthCm: 13.0, weightG: 140, baby: "Fat is starting to form under the skin, and the umbilical cord is getting stronger.", development: { body: "Fat stores begin to build." }, milestones: ["Fat forming"], bodyChanges: "Your center of gravity is shifting; you may feel round ligament twinges." },
  { week: 18, size: "a bell pepper", emoji: "🫑", lengthCm: 14.2, weightG: 190, baby: "Ears are in their final position and the baby may hear sounds.", development: { senses: "The baby may begin to hear sounds, like your heartbeat.", movement: "Yawning and hiccups may begin." }, milestones: ["Hearing begins"], bodyChanges: "Back aches and trouble finding a comfy sleeping position are common.", care: ["The anatomy (mid-pregnancy) ultrasound is often between weeks 18 and 22"], prepare: ["Decide whether you'd like to know the baby's sex at the anatomy scan"], questions: ["What will the anatomy scan look at?"] },
  { week: 19, size: "a mango", emoji: "🥭", lengthCm: 15.3, weightG: 240, baby: "A protective coating (vernix) covers the skin, and the senses are developing quickly.", development: { body: "Vernix forms to protect the skin.", senses: "Areas of the brain for smell, taste, hearing, sight and touch are developing." }, milestones: ["Vernix forms"], bodyChanges: "Leg cramps and dizziness can happen. Stand up slowly." },
  { week: 20, size: "a banana", emoji: "🍌", lengthCm: 25.6, weightG: 300, baby: "Halfway there! The baby is swallowing and practicing digestion.", development: { organs: "Swallowing amniotic fluid helps the digestive system develop.", movement: "Movements are getting stronger." }, milestones: ["Halfway point", "From now, length is measured head to heel"], bodyChanges: "Your uterus is around your belly button.", prepare: ["Start thinking about childbirth classes", "Start a baby registry or wish list"] },
  { week: 21, size: "a carrot", emoji: "🥕", lengthCm: 26.7, weightG: 360, baby: "Movements are becoming more coordinated, and the baby has sleep and wake cycles.", development: { movement: "More coordinated kicks and jabs.", senses: "Taste buds are working." }, milestones: ["Sleep–wake cycles"], bodyChanges: "Stretch marks and skin changes are common and normal." },
  { week: 22, size: "a papaya", emoji: "🍈", lengthCm: 27.8, weightG: 430, baby: "Lips, eyelids and eyebrows are more distinct, and the baby may grasp.", development: { body: "Eyebrows and eyelids are distinct.", senses: "Touch is developing; the baby may grasp the cord." }, milestones: ["Grasp reflex"], bodyChanges: "Swollen feet and an outie belly button can start." },
  { week: 23, size: "a grapefruit", emoji: "🍊", lengthCm: 28.9, weightG: 500, baby: "The lungs are developing the branches that will fill with air after birth.", development: { organs: "The lungs develop blood vessels for breathing.", senses: "The baby may respond to loud sounds." }, milestones: ["Responds to sound"], bodyChanges: "Practice (Braxton Hicks) contractions may begin." },
  { week: 24, size: "an ear of corn", emoji: "🌽", lengthCm: 30.0, weightG: 600, baby: "The baby's face is nearly fully formed, and the lungs are making surfactant.", development: { organs: "The lungs begin making surfactant, which helps them inflate.", body: "Skin is thin and see-through but filling out." }, milestones: ["Lungs make surfactant"], bodyChanges: "You may notice your skin itching as it stretches.", care: ["Glucose screening for gestational diabetes is usually between weeks 24 and 28"], questions: ["When should I do the glucose test, and do I need to fast?"] },
  { week: 25, size: "a cauliflower", emoji: "🥦", lengthCm: 34.6, weightG: 660, baby: "The baby is gaining fat and hair is growing, with its color and texture.", development: { body: "Hair grows and skin smooths as fat builds." }, milestones: ["Hair growing"], bodyChanges: "Sleep may get harder. A pillow between the knees can help." },
  { week: 26, size: "a head of lettuce", emoji: "🥬", lengthCm: 35.6, weightG: 760, baby: "The eyes begin to open, and the baby may startle at noises.", development: { senses: "Eyes start to open and blink.", movement: "Startle reflex to sounds." }, milestones: ["Eyes open"], bodyChanges: "Some people get headaches or swelling; tell your provider about sudden swelling or a bad headache." },
  { week: 27, size: "a head of cabbage", emoji: "🥬", lengthCm: 36.6, weightG: 875, baby: "The brain is very active, and the baby may hiccup (you might feel rhythmic taps).", development: { organs: "Brain activity increases a lot.", movement: "Hiccups are common." }, milestones: ["Last week of the second trimester"], bodyChanges: "Leg cramps and back aches are common.", care: ["Tdap (whooping cough) vaccine is often given between weeks 27 and 36", "Rh immune globulin around 28 weeks if you're Rh-negative"], prepare: ["Tour the hospital or birth center", "Sign up for childbirth and infant CPR classes"], questions: ["Which vaccines do you recommend in pregnancy?"] },
  { week: 28, size: "an eggplant", emoji: "🍆", lengthCm: 37.6, weightG: 1000, baby: "The baby can blink, has eyelashes, and may be practicing breathing movements.", development: { senses: "Blinking; eyelashes have grown.", movement: "Practice breathing movements." }, milestones: ["Third trimester begins"], bodyChanges: "Visits often become every 2 weeks from now.", care: ["Prenatal visits often every two weeks from 28 to 36 weeks"], prepare: ["Ask how your provider would like you to count kicks", "Start your birth preferences"], questions: ["How should I keep track of the baby's movements?", "What should I do if movements change?"] },
  { week: 29, size: "a butternut squash", emoji: "🎃", lengthCm: 38.6, weightG: 1200, baby: "Muscles and lungs are maturing, and the head is growing to make room for the brain.", development: { body: "Muscles and lungs keep maturing." }, milestones: ["Rapid brain growth"], bodyChanges: "Constipation and hemorrhoids are common. Drink water and talk to your provider about what's safe to take." },
  { week: 30, size: "a cucumber", emoji: "🥒", lengthCm: 39.9, weightG: 1300, baby: "The baby can tell light from dark, and lanugo hair starts to disappear.", development: { senses: "Can tell light from dark." }, milestones: ["Lanugo hair thinning"], bodyChanges: "Tiredness often returns in the third trimester.", prepare: ["Plan childcare for older children and pets during the birth", "Install the car seat (many fire stations check them)"] },
  { week: 31, size: "a coconut", emoji: "🥥", lengthCm: 41.1, weightG: 1500, baby: "The baby can turn their head from side to side, and the brain is making connections fast.", development: { movement: "Turns head side to side.", organs: "Rapid brain connections." }, milestones: ["Turns head"], bodyChanges: "Leaking a little colostrum (early milk) is common." },
  { week: 32, size: "a squash", emoji: "🎃", lengthCm: 42.4, weightG: 1700, baby: "Toenails and fingernails have grown, and the baby is practicing breathing, swallowing and sucking.", development: { body: "Nails have grown in.", movement: "Practicing breathing, swallowing and sucking." }, milestones: ["Practicing breathing"], bodyChanges: "Shortness of breath is common as the uterus presses up.", prepare: ["Pack your hospital bag", "Plan freezer meals for after the birth"] },
  { week: 33, size: "a pineapple", emoji: "🍍", lengthCm: 43.7, weightG: 1900, baby: "The bones are hardening, except the skull, which stays soft to help with birth.", development: { body: "Bones harden; the skull stays flexible." }, milestones: ["Bones hardening"], bodyChanges: "Swelling and trouble sleeping are common." },
  { week: 34, size: "a cantaloupe", emoji: "🍈", lengthCm: 45.0, weightG: 2100, baby: "The central nervous system and lungs keep maturing. Many babies settle head-down around now.", development: { organs: "Lungs and nervous system mature.", movement: "Many babies settle head-down." }, milestones: ["Many babies turn head-down"], bodyChanges: "You might feel more pelvic pressure.", prepare: ["Finish your birth preferences and share them with your provider", "Pre-register at the hospital"] },
  { week: 35, size: "a honeydew melon", emoji: "🍈", lengthCm: 46.2, weightG: 2400, baby: "Kidneys are fully developed and the liver can process some waste. Most growth now is fat.", development: { organs: "Kidneys are fully developed." }, milestones: ["Gaining fat quickly"], bodyChanges: "Movements may feel more like rolls and stretches than kicks.", care: ["Group B strep (GBS) swab is usually between weeks 36 and 37"], prepare: ["Know the signs that mean call your provider or go in", "Save your provider and hospital numbers"] },
  { week: 36, size: "a head of romaine", emoji: "🥬", lengthCm: 47.4, weightG: 2600, baby: "The baby is shedding most of the lanugo and vernix and may drop lower into the pelvis.", development: { body: "Lanugo and vernix shed.", movement: "May drop lower (lightening)." }, milestones: ["May drop lower"], bodyChanges: "Breathing may get easier if the baby drops, but you may pee more.", care: ["Prenatal visits often weekly from 36 weeks"], prepare: ["Hospital bag packed and by the door", "Practice the route to the hospital"], questions: ["When should I come in or call during labor?", "What if my water breaks?"] },
  { week: 37, size: "a winter melon", emoji: "🍈", lengthCm: 48.6, weightG: 2900, baby: "The baby is practicing breathing, sucking and blinking, and is considered early term.", development: { movement: "Practicing for life outside." }, milestones: ["Early term"], bodyChanges: "Practice contractions may be more frequent. Follow your provider's advice on when to call." },
  { week: 38, size: "a pumpkin", emoji: "🎃", lengthCm: 49.8, weightG: 3100, baby: "Organs are ready to work on their own, and the baby has a firm grasp.", development: { organs: "Organs are ready for life outside.", movement: "Strong grasp." }, milestones: ["Organs ready"], bodyChanges: "Losing the mucus plug can happen days or hours before labor." },
  { week: 39, size: "a small watermelon", emoji: "🍉", lengthCm: 50.7, weightG: 3300, baby: "Full term. The brain and lungs keep maturing right up to birth.", development: { organs: "Brain and lungs keep maturing." }, milestones: ["Full term"], bodyChanges: "Rest when you can, and keep your bag and car seat ready." },
  { week: 40, size: "a watermelon", emoji: "🍉", lengthCm: 51.2, weightG: 3500, baby: "Your estimated due date week. Only a small share of babies arrive on their exact due date.", development: { body: "Ready to meet you." }, milestones: ["Estimated due date"], bodyChanges: "It's very normal to go past the due date. Your provider will talk about next steps.", care: ["Your provider may discuss monitoring or induction if you go past your due date"], questions: ["What happens if I go past my due date?"] },
  { week: 41, size: "a watermelon", emoji: "🍉", lengthCm: 51.5, weightG: 3600, baby: "Late term. The baby keeps growing and may have longer nails and less vernix.", development: { body: "Longer nails, less vernix." }, milestones: ["Late term"], bodyChanges: "Your provider will likely want to see you more often now.", care: ["Extra monitoring (non-stress tests or ultrasounds) is common after 40 weeks"] },
  { week: 42, size: "a watermelon", emoji: "🍉", lengthCm: 52.0, weightG: 3700, baby: "Post-term. Your provider will be closely involved in planning the birth.", development: {}, milestones: ["Post-term"], bodyChanges: "Follow your provider's plan closely this week.", care: ["Follow your provider's plan for the birth"] },
];

const forTrimester = (week: number, key: "symptoms" | "prepare" | "questions" | "care"): string[] => {
  const t = week <= 13 ? 1 : week <= 27 ? 2 : 3;
  const defaults = {
    symptoms: { 1: T1_SYMPTOMS, 2: T2_SYMPTOMS, 3: T3_SYMPTOMS },
    prepare: {
      1: ["Keep taking your prenatal vitamin", "Rest when you can"],
      2: ["Look into childbirth and baby care classes", "Plan parental leave"],
      3: ["Keep your hospital bag and car seat ready", "Line up help for the first weeks home"],
    },
    questions: {
      1: ["Which symptoms should I call you about?", "Is it okay to keep exercising the way I do now?"],
      2: ["Is my weight gain on track for me?", "What exercise is good for me now?"],
      3: ["What are the signs of labor I should watch for?", "Who do I call after hours?"],
    },
    care: {
      1: ["A first prenatal visit is usually booked in the first trimester. Ask your provider when to come in"],
      2: ["Routine prenatal visits, often every four weeks"],
      3: ["Visits often become every two weeks, then weekly near the end. Your provider will set the schedule"],
    },
  } as const;
  return [...defaults[key][t]];
};

/** Built-in content for a week (1–42). */
export function builtInWeek(week: number): WeekContent {
  const w = Math.min(42, Math.max(1, Math.round(week)));
  const b = W[w - 1]!;
  return {
    ...b,
    symptoms: b.symptoms?.length ? b.symptoms : forTrimester(w, "symptoms"),
    care: b.care?.length ? b.care : forTrimester(w, "care"),
    prepare: b.prepare?.length ? b.prepare : forTrimester(w, "prepare"),
    questions: b.questions?.length ? b.questions : forTrimester(w, "questions"),
  };
}

/** Merge an admin override (only known fields, right types) over the built-in content. */
export function mergeWeek(base: WeekContent, override: Record<string, unknown> | null | undefined): WeekContent {
  if (!override) return base;
  const out: WeekContent = { ...base, development: { ...base.development } };
  for (const k of ["size", "emoji", "baby", "bodyChanges"] as const) if (typeof override[k] === "string" && override[k]) out[k] = override[k] as string;
  for (const k of ["lengthCm", "weightG"] as const) if (typeof override[k] === "number") out[k] = override[k] as number;
  for (const k of ["milestones", "symptoms", "care", "prepare", "questions"] as const) {
    const v = override[k];
    if (Array.isArray(v) && v.every((x) => typeof x === "string")) out[k] = v as string[];
  }
  const dev = override.development;
  if (dev && typeof dev === "object") for (const k of ["body", "organs", "movement", "senses"] as const) if (typeof (dev as Record<string, unknown>)[k] === "string") out.development[k] = (dev as Record<string, string>)[k];
  return out;
}

export const WEEKS_COUNT = 42;

/** "about 30 cm (11.8 in)" / "about 600 g (1 lb 5 oz)". */
export const lengthText = (cm: number | null) => (cm === null ? null : cm < 1 ? `about ${Math.round(cm * 10)} mm` : `about ${cm} cm (${Math.round((cm / 2.54) * 10) / 10} in)`);
export function weightText(g: number | null) {
  if (g === null) return null;
  const oz = g / 28.3495;
  if (oz < 16) return `about ${g} g (${Math.round(oz * 10) / 10} oz)`;
  const lb = Math.floor(oz / 16);
  return `about ${g >= 1000 ? `${Math.round(g / 100) / 10} kg` : `${g} g`} (${lb} lb ${Math.round(oz - lb * 16)} oz)`;
}

export const EDUCATION_NOTE = "General information for learning, not medical advice. Every pregnancy is different: your healthcare provider's guidance comes first.";
export const URGENT_NOTE = "Call your provider or go to labor & delivery right away for bleeding, fluid leaking, severe pain or headache, vision changes, a fever, sudden swelling, or if the baby is moving less than usual. In an emergency, call 911.";
