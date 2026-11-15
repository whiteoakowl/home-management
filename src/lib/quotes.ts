/**
 * Daily quotes. Original lines written for this app, plus short passages from
 * public-domain works (authors who died long ago / translations published before 1929).
 * Pure module.
 */
export const QUOTE_CATEGORIES = ["Motivation", "Confidence", "Gratitude", "Growth", "Resilience", "Calm", "Self-compassion", "Encouragement", "Friendship", "Family", "Personal goals"] as const;
export type QuoteCategory = (typeof QUOTE_CATEGORIES)[number];
export type Quote = { id: string; text: string; author: string | null; category: QuoteCategory };

const q = (id: string, category: QuoteCategory, text: string, author: string | null = null): Quote => ({ id, text, author, category });

export const QUOTES: Quote[] = [
  // Motivation
  q("m1", "Motivation", "Small steps still move you forward."),
  q("m2", "Motivation", "You don't have to feel ready to begin. Beginning is how you get ready."),
  q("m3", "Motivation", "Well done is better than well said.", "Benjamin Franklin"),
  q("m4", "Motivation", "Today counts, even if it's a quiet day."),
  q("m5", "Motivation", "The journey of a thousand li commences with a single step.", "Lao Tzu (tr. James Legge)"),
  q("m6", "Motivation", "Write it on your heart that every day is the best day in the year.", "Ralph Waldo Emerson"),
  // Confidence
  q("c1", "Confidence", "You are allowed to take up space."),
  q("c2", "Confidence", "Your voice matters, even when it shakes."),
  q("c3", "Confidence", "I am no bird; and no net ensnares me.", "Charlotte Brontë, Jane Eyre"),
  q("c4", "Confidence", "You've handled hard things before. You can trust yourself with this one."),
  q("c5", "Confidence", "Being yourself is not a mistake to fix."),
  // Gratitude
  q("g1", "Gratitude", "Noticing the good doesn't ignore the hard. It helps you carry it."),
  q("g2", "Gratitude", "Very little indeed is necessary for living a happy life.", "Marcus Aurelius (tr. George Long)"),
  q("g3", "Gratitude", "Look for one small good thing today. It's usually there."),
  q("g4", "Gratitude", "A thank-you costs nothing and can change someone's whole day."),
  q("g5", "Gratitude", "Ordinary moments are often the ones we end up treasuring."),
  // Growth
  q("gr1", "Growth", "Mistakes are proof that you're trying."),
  q("gr2", "Growth", "You are a work in progress, and that's exactly how it should be."),
  q("gr3", "Growth", "I am not afraid of storms, for I am learning how to sail my ship.", "Louisa May Alcott, Little Women"),
  q("gr4", "Growth", "Every expert was once a beginner who didn't quit."),
  q("gr5", "Growth", "Learning something new is a gift you give your future self."),
  // Resilience
  q("r1", "Resilience", "Hard days don't last forever. You've already made it through every one so far."),
  q("r2", "Resilience", "“Hope” is the thing with feathers – that perches in the soul.", "Emily Dickinson"),
  q("r3", "Resilience", "Bending is not the same as breaking."),
  q("r4", "Resilience", "Finish each day and be done with it. You have done what you could.", "Ralph Waldo Emerson"),
  q("r5", "Resilience", "Rest is part of being strong, not the opposite of it."),
  q("r6", "Resilience", "Tomorrow is a fresh page, and you get to write on it."),
  // Calm
  q("ca1", "Calm", "Breathe in slowly. Breathe out slowly. Right now, that's enough."),
  q("ca2", "Calm", "You don't have to solve everything today."),
  q("ca3", "Calm", "While we are postponing, life speeds by.", "Seneca (tr. Richard M. Gummere)"),
  q("ca4", "Calm", "Quiet moments are not wasted moments."),
  q("ca5", "Calm", "Let one thing be simple today."),
  // Self-compassion
  q("s1", "Self-compassion", "Talk to yourself the way you'd talk to someone you love."),
  q("s2", "Self-compassion", "You're doing better than you think."),
  q("s3", "Self-compassion", "It's okay to not be okay. It's also okay to ask for help."),
  q("s4", "Self-compassion", "Your worth isn't measured by how much you get done."),
  q("s5", "Self-compassion", "Be as patient with yourself as you are with others."),
  // Encouragement
  q("e1", "Encouragement", "Keep going. The good parts are often just ahead."),
  q("e2", "Encouragement", "You don't have to be perfect to be wonderful."),
  q("e3", "Encouragement", "If one advances confidently in the direction of his dreams, he will meet with a success unexpected in common hours.", "Henry David Thoreau, Walden"),
  q("e4", "Encouragement", "Someone is proud of you, even if they haven't said it yet."),
  q("e5", "Encouragement", "Your effort counts, even when the result isn't what you hoped."),
  // Friendship
  q("f1", "Friendship", "A good friend listens to understand, not to answer."),
  q("f2", "Friendship", "There is no charm equal to tenderness of heart.", "Jane Austen, Emma"),
  q("f3", "Friendship", "Reach out today. A short message can mean a lot."),
  q("f4", "Friendship", "Kindness is a language everyone understands."),
  q("f5", "Friendship", "The people who make you feel at home are treasures."),
  // Family
  q("fa1", "Family", "Home is where you're loved on your hard days too."),
  q("fa2", "Family", "The little things we do for each other add up to everything."),
  q("fa3", "Family", "Family isn't about being the same. It's about showing up."),
  q("fa4", "Family", "A shared laugh at the dinner table is a kind of medicine."),
  q("fa5", "Family", "Say thank you to someone at home today."),
  // Personal goals
  q("p1", "Personal goals", "A goal is a dream with a first step attached."),
  q("p2", "Personal goals", "Progress, not perfection."),
  q("p3", "Personal goals", "Habits are built one ordinary day at a time."),
  q("p4", "Personal goals", "Celebrate the small wins. They're how big things happen."),
  q("p5", "Personal goals", "Choose one thing that matters today, and give it your best."),
];

export const quoteById = (id: string) => QUOTES.find((x) => x.id === id);

const dayNumber = (iso: string) => Math.floor(Date.parse(`${iso}T12:00:00Z`) / 86_400_000);

/** The quote for a date (same all day), optionally limited to preferred categories. */
export function quoteFor(date: string, categories: string[] = []): Quote {
  const pool = categories.length ? QUOTES.filter((x) => categories.includes(x.category)) : QUOTES;
  const list = pool.length ? pool : QUOTES;
  // Spread consecutive days across the list (not just +1) so it doesn't feel repetitive.
  return list[(dayNumber(date) * 7) % list.length]!;
}
