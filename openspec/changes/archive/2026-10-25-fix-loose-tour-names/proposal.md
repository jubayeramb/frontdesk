# Proposal

## Why

A replay on the fallback model (`openai/gpt-oss-20b`) asked "How much is the Sylhet tour for 2?" six times.
In 2 runs the model passed "Sylhet tour" as the tour, `getQuote` found no tour by that exact slug, and the customer was told the tour does not exist.
In another run the model retried after the failure, so the reply held both the total and "I couldn't find a tour named Sylhet".
The tools trust the model to copy the slug exactly, and the smaller model often does not.
After the matching fix, one run wrote "(₹8,500 per person)": the right amount with the Indian rupee sign, which the price guard does not even recognize as a currency.

## What Changes

- `getQuote` and `listDepartures` match the tour the model names loosely: an exact slug, or text that contains exactly one tour's slug as a word ("Sylhet tour", "sylhet-tea-gardens").
- Text that matches no tour, or more than one, is still an unknown tour.
- Amounts written with ₹, ₨ or Rs are rewritten with ৳, and the price guard checks amounts with ₹ like any other.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

front-desk-agent

## Impact

- `src/lib/pricing/quote.ts` gains the matcher; `computeQuote` and `offerDepartures` use it.
- `src/lib/agent/price-guard.ts` gains the currency rewrite, applied to every agent text reply.
