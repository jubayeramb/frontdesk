// Loads the default Mopwell price list and services.
// Run with `pnpm db:seed`. The data arrives with add-pricing-and-booking-data.
async function main() {
  console.log("Nothing to seed yet.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
