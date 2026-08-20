"use client";
import { openDB } from "idb";

type PendingMutation = {
  key: string;
  table: string;
  match: { column: string; value: string };
  payload: Record<string, unknown>;
  createdAt: number;
};
const database = () =>
  openDB("vm-training", 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("mutations"))
        db.createObjectStore("mutations", { keyPath: "key" });
    },
  });
export async function enqueueMutation(
  mutation: Omit<PendingMutation, "createdAt">,
) {
  const db = await database();
  await db.put("mutations", { ...mutation, createdAt: Date.now() });
}
export async function pendingMutations() {
  const db = await database();
  return db.getAll("mutations") as Promise<PendingMutation[]>;
}
export async function removeMutation(key: string) {
  const db = await database();
  await db.delete("mutations", key);
}
