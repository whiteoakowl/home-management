# Free and Premium plans

The rules live in `src/lib/plan-tiers.ts` (pure, unit-tested in `tests/plan-tiers.test.ts`).

## How a family's plan is decided (`familyAccess` in `src/lib/billing.ts`)

| Situation | Plan |
| --- | --- |
| Payments not set up (no Stripe keys, or billing switched off in Admin) | Premium for everyone |
| Complimentary, active, Stripe trial, or past due (while Stripe retries) | Premium |
| No paid plan, family created less than `trialDays` ago (Admin setting, default 7) | Premium trial, no card needed |
| Otherwise | Free |

Choosing a plan during the trial gives Stripe the trial's remaining days, so the card is only charged when the trial would have ended. Cancelling or a failed payment that never recovers moves the family to Free. Nobody is locked out of the app any more.

## Free, forever

Calendar, Grocery Shopping, Chores (and tasks), Lists, Family Chat, Contacts, Important Info, Memories & Photos, and every personal area (Personal Health, Period Tracker, Food Journal, Mental Wellness, Privacy Center). Data downloads and the Help Center are free.

Limits (`FREE_LIMITS`): 6 family members, 5 lists (the grocery list doesn't count), 200 photos.

## Premium

Every other section. On Free, these sections stay in the menu with a lock and are **view-only**: `resolveViewer` caps their access at View, so add/edit buttons disappear and server actions refuse changes (`requireModule` gives the Premium message). Private spaces of Premium sections (My Pantry, My Recipes, My Meal Plans, My Budget, My Vehicles, My Home Projects) are view-only too. Nothing is deleted.

Premium extras inside free sections: event templates, timed event reminders, calendar sync (feed and imports), chore rewards, chore rotation, and the automations for Premium sections (`FREE_AUTOMATIONS` lists the ones that keep running).

## Where people see it

- Lock icons in the menu; a notice on Premium pages; a Free-plan note on Home for parents; a trial countdown for parents.
- `/billing`: Free vs Premium comparison and checkout (account holder). "Continue with Free" goes back to the app.
- Account settings → Subscription: "Free plan" or "Premium free trial · N days left".
- Website: Pricing (Free, Monthly, Yearly), Features (Free/Premium badges), FAQ, Terms §2.
- Help: "Free and Premium plans" article and FAQs.

## Testing locally

With dummy `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY`, payments count as set up, so a family older than the trial without a paid status is on Free.
