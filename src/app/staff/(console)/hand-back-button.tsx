"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { handBack } from "./actions";

export function HandBackButton({ conversationId }: { conversationId: string }) {
  return (
    <form action={handBack}>
      <input type="hidden" name="conversationId" value={conversationId} />
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" className="self-start" disabled={pending}>
      {pending ? "Handing back..." : "Hand back to AI"}
    </Button>
  );
}
