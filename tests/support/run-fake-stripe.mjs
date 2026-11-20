import { startFakeStripe } from "./fake-stripe.mjs";

const { url } = await startFakeStripe(Number(process.argv[2] ?? 12111));
console.log(`Fake Stripe listening on ${url}`);
