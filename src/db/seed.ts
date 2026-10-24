// Loads the default Triplone Tours tours and prices.
// Run with `pnpm db:seed`. The data arrives with add-pricing-and-booking-data.
async function main() {
  console.log("Nothing to seed yet.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
