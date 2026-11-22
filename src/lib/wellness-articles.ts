/**
 * Short, general wellness reads for the Learn tab. Everyday tips, not medical
 * advice; each ends by pointing to a trusted adult or professional when needed.
 */
export type WellnessArticle = { slug: string; title: string; minutes: number; emoji: string; summary: string; body: string[]; tips: string[] };

export const WELLNESS_ARTICLES: WellnessArticle[] = [
  {
    slug: "sleep-basics",
    title: "Sleep basics",
    minutes: 2,
    emoji: "🌙",
    summary: "Small habits that make it easier to fall asleep and wake up rested.",
    body: [
      "Sleep is when your body and mind recharge. Most adults feel best with around 7 to 9 hours, and children and teens usually need more.",
      "Your body likes rhythm. Going to bed and getting up at about the same time, even on weekends, helps your body know when it's time to wind down.",
    ],
    tips: ["Keep a regular bedtime and wake time.", "Dim screens and lights for the last half hour before bed.", "Keep your room cool, dark and quiet (or use calm background sound).", "Get some daylight in the morning.", "If you can't sleep after a while, get up and do something calm until you feel sleepy."],
  },
  {
    slug: "stress-and-breath",
    title: "Stress and your breath",
    minutes: 2,
    emoji: "🌬️",
    summary: "Why slow breathing can help you feel calmer in the moment.",
    body: [
      "When we're stressed, breathing often gets quick and shallow. Slowing it down, especially making the out-breath a little longer than the in-breath, is a simple way many people find helps them settle.",
      "It only takes a minute or two, and you can do it anywhere: in the car, before a test, or in bed.",
    ],
    tips: ["Try breathing in for 4 and out for 6.", "Put a hand on your belly and feel it rise and fall.", "Pair it with a short pause before reacting.", "Practise when you're calm so it's easier when you're not."],
  },
  {
    slug: "move-your-body",
    title: "Moving your body",
    minutes: 2,
    emoji: "🚶",
    summary: "Movement doesn't have to be a workout to lift your mood.",
    body: ["Any movement counts: a walk, dancing in the kitchen, stretching, playing outside or tidying up. Many people notice they feel brighter and sleep better on days they move more.", "Start small. Five minutes is better than none, and it's easier to keep going when it's something you enjoy."],
    tips: ["Take a short walk after a meal.", "Stretch when you get up from a screen.", "Move with someone else: it's more fun.", "Pick something you enjoy, not something you dread."],
  },
  {
    slug: "gratitude",
    title: "The habit of gratitude",
    minutes: 2,
    emoji: "🙏",
    summary: "Noticing what's going well, even on hard days.",
    body: ["Gratitude is simply noticing good things, big or small: a warm drink, a kind message, a sunny moment. Writing a few down regularly helps many people feel more positive over time.", "It doesn't mean pretending everything is fine. Hard feelings and grateful ones can sit side by side."],
    tips: ["Write three good things before bed.", "Thank someone in a message or note.", "Notice one small pleasure each day.", "Look back at old entries on a tough day."],
  },
  {
    slug: "connection",
    title: "Staying connected",
    minutes: 2,
    emoji: "🤝",
    summary: "People are good for us. Here are easy ways to reach out.",
    body: ["Feeling connected to others is one of the strongest supports for wellbeing. Even short, simple moments of connection count.", "If you're feeling low, it can be tempting to pull away. A small step, like sending a message, is often easier than you expect."],
    tips: ["Send a quick hello to someone you miss.", "Share a meal without phones.", "Join a club, team or group around something you like.", "Ask someone how they're really doing, and listen."],
  },
  {
    slug: "wind-down",
    title: "Screens and winding down",
    minutes: 2,
    emoji: "📱",
    summary: "Giving your mind a break from screens before bed and during the day.",
    body: ["Screens keep our brains busy, and bright light late at night can make it harder to fall asleep. A short break during the day and a screen-free wind-down at night can help you feel calmer.", "Try swapping scrolling for something slow: reading, music, stretching or calm sounds."],
    tips: ["Charge your phone outside the bedroom.", "Set a gentle bedtime reminder.", "Turn off notifications you don't need.", "Swap one scroll session for a walk or a book."],
  },
  {
    slug: "water-and-energy",
    title: "Water, food and energy",
    minutes: 1,
    emoji: "💧",
    summary: "Simple everyday basics that affect how you feel.",
    body: ["Feeling tired, cranky or foggy can sometimes come down to basics: not drinking enough water, skipping meals or running on snacks.", "Regular meals and a water bottle within reach are small habits that can make a real difference to your energy."],
    tips: ["Keep a water bottle nearby.", "Eat something within a couple of hours of waking.", "Pair a snack with some protein.", "Notice how you feel after different foods."],
  },
  {
    slug: "reaching-out",
    title: "When to reach out for help",
    minutes: 2,
    emoji: "💬",
    summary: "Everyone needs support sometimes, and asking is a strength.",
    body: [
      "It's normal to have ups and downs. But if you've been feeling low, worried or not like yourself for a couple of weeks, or it's getting in the way of everyday life, it's a good idea to talk to someone: a trusted adult, a parent, a teacher, a doctor or a counselor.",
      "If you ever feel unsafe or think about hurting yourself, reach out right away. In the US, call or text 988 (Suicide & Crisis Lifeline). Elsewhere, contact local emergency services.",
    ],
    tips: ["Tell one person you trust how you've been feeling.", "Write down what you want to say first if it's hard to start.", "You don't need to have it all figured out to ask for help.", "Use the “Talk to someone” button in Mental Wellness anytime."],
  },
];

export const articleBySlug = (slug: string) => WELLNESS_ARTICLES.find((a) => a.slug === slug);
