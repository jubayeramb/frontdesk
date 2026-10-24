// Departure dates as the model writes them: "28 Oct", "Wed 28 Oct",
// "Wednesday, 28 October 2026".
const MONTH = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*";
const WEEKDAY = "(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\\s)?";
const DATE = `${WEEKDAY}\\d{1,2}\\s${MONTH}(?:\\s\\d{4})?`;
const SEPARATOR = "\\s*(?:,\\s*(?:or\\s+|and\\s+)?|\\s+(?:or|and)\\s+)";
const LIST = `${DATE}(?:${SEPARATOR}${DATE})+`;

export function mentionsDate(text: string): boolean {
  return new RegExp(`\\b${DATE}\\b`).test(text);
}

// A reply that names dates or asks the customer to pick one ("Which departure
// would you like?", "Pick a date"). Offering to show them ("Want to see
// departures?") is not a pick, so the customer can say no.
export function asksForDeparture(text: string): boolean {
  return mentionsDate(text) || /\b(?:which|pick|choose|select)\b[^.?!]*\b(?:departures?|dates?)\b/i.test(text);
}

// When the departures go out as options, a list of dates in brackets or after
// a colon only repeats them: "Which departure (28 Oct, 31 Oct) would you like?"
// reads as "Which departure would you like?". Dates inside a sentence stay.
export function stripDateLists(text: string): string {
  return text
    .replace(new RegExp(`\\s*\\(${LIST}\\)`, "g"), "")
    .replace(new RegExp(`:\\s*${LIST}`, "g"), "");
}
