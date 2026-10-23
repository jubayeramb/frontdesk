export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <p className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-950">
        Demo business. No real bookings.
      </p>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-3 px-4 py-24">
        <h1 className="text-3xl font-semibold tracking-tight">
          Mopwell Cleaning
        </h1>
        <p className="text-muted-foreground">
          Home cleaning in Austin, TX. The front desk is on its way.
        </p>
      </main>
    </div>
  );
}
