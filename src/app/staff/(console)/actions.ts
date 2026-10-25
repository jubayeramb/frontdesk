"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { transition } from "@/lib/ownership";
import { requireStaff } from "@/lib/staff/auth";

const conversationId = z.uuid();

// No message goes to the customer: staff can say goodbye in the inbox first.
export async function handBack(formData: FormData): Promise<void> {
  await requireStaff("/staff");
  const id = conversationId.parse(formData.get("conversationId"));
  await transition(db, { conversationId: id, event: "handed_back" });
  revalidatePath("/staff");
}
