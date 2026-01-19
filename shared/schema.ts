import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// HomeFix AI Tasks Schema
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  location: text("location").notNull().default("General"),
  priority: text("priority").notNull().default("Medium"),
  effortScore: integer("effort_score").notNull().default(3),
  status: text("status").notNull().default("Pending"),
  thumbnailUrl: text("thumbnail_url"),
  videoUrl: text("video_url"),
  transcript: text("transcript"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
}).partial();

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;

// Priority and Status types
export const PRIORITIES = ["Low", "Medium", "High"] as const;
export const STATUSES = ["Pending", "Completed"] as const;
export const LOCATIONS = [
  "General",
  "Kitchen",
  "Bathroom",
  "Master Bedroom",
  "Bedroom",
  "Living Room",
  "Dining Room",
  "Garage",
  "Garden",
  "Basement",
  "Attic",
  "Laundry Room",
  "Hallway",
  "Exterior",
] as const;

export type Priority = typeof PRIORITIES[number];
export type Status = typeof STATUSES[number];
export type Location = typeof LOCATIONS[number];
