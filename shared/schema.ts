import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
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

// Households Schema
export const households = pgTable("households", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertHouseholdSchema = createInsertSchema(households).omit({
  id: true,
  createdAt: true,
});

export type Household = typeof households.$inferSelect;
export type InsertHousehold = z.infer<typeof insertHouseholdSchema>;

// Household Members Schema (optional email auth)
export const householdMembers = pgTable("household_members", {
  id: serial("id").primaryKey(),
  householdId: integer("household_id").notNull(),
  name: text("name").notNull(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertHouseholdMemberSchema = createInsertSchema(householdMembers).omit({
  id: true,
  createdAt: true,
});

export type HouseholdMember = typeof householdMembers.$inferSelect;
export type InsertHouseholdMember = z.infer<typeof insertHouseholdMemberSchema>;

// Home DIY Tracker Tasks Schema
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
  householdId: integer("household_id"),
  assignedToId: integer("assigned_to_id"),
  estimatedMinutes: integer("estimated_minutes"),
  subtasks: jsonb("subtasks").$type<{ title: string; completed: boolean }[]>(),
  shoppingList: jsonb("shopping_list").$type<{ item: string; checked: boolean }[]>(),
  completedAt: timestamp("completed_at"),
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

// Saved Plans Schema
export const savedPlans = pgTable("saved_plans", {
  id: serial("id").primaryKey(),
  householdId: integer("household_id").notNull(),
  name: text("name").notNull().default("My Plan"),
  planData: jsonb("plan_data").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type SavedPlan = typeof savedPlans.$inferSelect;

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
