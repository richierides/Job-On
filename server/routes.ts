import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";
import OpenAI, { toFile } from "openai";
import { tasks, insertTaskSchema, updateTaskSchema, households, householdMembers, insertHouseholdSchema, insertHouseholdMemberSchema } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

// OpenAI client for AI Integrations
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Increase JSON body limit for base64 videos
  app.use((req, res, next) => {
    if (req.path === "/api/tasks/process-video") {
      // Skip default body parser for this route
      next();
    } else {
      next();
    }
  });

  // ============ Task CRUD Endpoints ============

  // Get all tasks (optionally filter by householdId)
  app.get("/api/tasks", async (req: Request, res: Response) => {
    try {
      const householdId = req.query.householdId ? parseInt(req.query.householdId as string) : null;
      let allTasks;
      if (householdId) {
        allTasks = await db.select().from(tasks).where(eq(tasks.householdId, householdId)).orderBy(desc(tasks.createdAt));
      } else {
        allTasks = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
      }
      res.json(allTasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  // Get single task
  app.get("/api/tasks/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Error fetching task:", error);
      res.status(500).json({ error: "Failed to fetch task" });
    }
  });

  // Create task
  app.post("/api/tasks", async (req: Request, res: Response) => {
    try {
      const validated = insertTaskSchema.parse(req.body);
      const [task] = await db.insert(tasks).values(validated).returning();
      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(400).json({ error: "Failed to create task" });
    }
  });

  // Update task
  app.patch("/api/tasks/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      const validated = updateTaskSchema.parse(req.body);
      const [task] = await db
        .update(tasks)
        .set({ ...validated, updatedAt: new Date() })
        .where(eq(tasks.id, id))
        .returning();
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(400).json({ error: "Failed to update task" });
    }
  });

  // Delete task
  app.delete("/api/tasks/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      await db.delete(tasks).where(eq(tasks.id, id));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // ============ Household Endpoints ============

  // Generate a random invite code
  const generateInviteCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Create household
  app.post("/api/households", async (req: Request, res: Response) => {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Household name is required" });
      }
      const inviteCode = generateInviteCode();
      const [household] = await db.insert(households).values({ name, inviteCode }).returning();
      res.status(201).json(household);
    } catch (error) {
      console.error("Error creating household:", error);
      res.status(500).json({ error: "Failed to create household" });
    }
  });

  // Get household by ID
  app.get("/api/households/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const [household] = await db.select().from(households).where(eq(households.id, id));
      if (!household) {
        return res.status(404).json({ error: "Household not found" });
      }
      res.json(household);
    } catch (error) {
      console.error("Error fetching household:", error);
      res.status(500).json({ error: "Failed to fetch household" });
    }
  });

  // Get household by invite code
  app.get("/api/households/code/:code", async (req: Request, res: Response) => {
    try {
      const code = req.params.code.toUpperCase();
      const [household] = await db.select().from(households).where(eq(households.inviteCode, code));
      if (!household) {
        return res.status(404).json({ error: "Invalid invite code" });
      }
      res.json(household);
    } catch (error) {
      console.error("Error fetching household by code:", error);
      res.status(500).json({ error: "Failed to fetch household" });
    }
  });

  // ============ Household Member Endpoints ============

  // Add member to household
  app.post("/api/households/:id/members", async (req: Request, res: Response) => {
    try {
      const householdId = parseInt(req.params.id);
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Member name is required" });
      }
      const [member] = await db.insert(householdMembers).values({ householdId, name }).returning();
      res.status(201).json(member);
    } catch (error) {
      console.error("Error adding member:", error);
      res.status(500).json({ error: "Failed to add member" });
    }
  });

  // Get all members of a household
  app.get("/api/households/:id/members", async (req: Request, res: Response) => {
    try {
      const householdId = parseInt(req.params.id);
      const members = await db.select().from(householdMembers).where(eq(householdMembers.householdId, householdId));
      res.json(members);
    } catch (error) {
      console.error("Error fetching members:", error);
      res.status(500).json({ error: "Failed to fetch members" });
    }
  });

  // Get single member
  app.get("/api/members/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const [member] = await db.select().from(householdMembers).where(eq(householdMembers.id, id));
      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }
      res.json(member);
    } catch (error) {
      console.error("Error fetching member:", error);
      res.status(500).json({ error: "Failed to fetch member" });
    }
  });

  // ============ Video Processing Endpoint ============

  // Process video and create task using AI
  app.post(
    "/api/tasks/process-video",
    async (req: Request, res: Response) => {
      try {
        const { video, thumbnail, householdId } = req.body;

        if (!video) {
          return res.status(400).json({ error: "Video data is required" });
        }

        // Convert base64 video to buffer for audio extraction
        const videoBuffer = Buffer.from(video, "base64");

        // Save video temporarily for ffmpeg processing
        const tempVideoPath = path.join("/tmp", `video_${uuidv4()}.mp4`);
        const tempAudioPath = path.join("/tmp", `audio_${uuidv4()}.wav`);

        fs.writeFileSync(tempVideoPath, videoBuffer);

        // Extract audio from video using ffmpeg
        const { spawn } = require("child_process");
        await new Promise<void>((resolve, reject) => {
          const ffmpeg = spawn("ffmpeg", [
            "-i", tempVideoPath,
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            tempAudioPath,
          ]);

          ffmpeg.on("close", (code: number) => {
            if (code === 0) resolve();
            else reject(new Error(`ffmpeg exited with code ${code}`));
          });
          ffmpeg.on("error", reject);
        });

        // Read audio file
        const audioBuffer = fs.readFileSync(tempAudioPath);

        // Transcribe audio using OpenAI Whisper
        const audioFile = await toFile(audioBuffer, "audio.wav");
        const transcription = await openai.audio.transcriptions.create({
          file: audioFile,
          model: "gpt-4o-mini-transcribe",
        });

        const transcript = transcription.text;

        // Clean up temp files
        fs.unlinkSync(tempVideoPath);
        fs.unlinkSync(tempAudioPath);

        // Use GPT-4o to structure the transcript into a job card
        const structuringPrompt = `You are an AI assistant that analyzes home maintenance task descriptions.

Given this transcript from a homeowner describing a maintenance issue, extract the following information:

Transcript: "${transcript}"

Respond with a JSON object containing:
1. "title": A concise, professional title for this maintenance task (e.g., "Replace leaky kitchen U-bend", "Fix squeaky bedroom door")
2. "effortScore": A number from 1-5 indicating the complexity/effort required (1=trivial, 5=major project)
3. "location": The room or area mentioned (choose from: General, Kitchen, Bathroom, Master Bedroom, Bedroom, Living Room, Dining Room, Garage, Garden, Basement, Attic, Laundry Room, Hallway, Exterior). Default to "General" if no clear location.
4. "priority": Either "Low", "Medium", or "High" based on urgency implied in the transcript. Default to "Medium".

Respond ONLY with valid JSON, no markdown or explanation.`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: "You are a helpful assistant that outputs only valid JSON." },
            { role: "user", content: structuringPrompt },
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 500,
        });

        const aiResponse = completion.choices[0]?.message?.content || "{}";
        let taskData;

        try {
          taskData = JSON.parse(aiResponse);
        } catch (parseError) {
          console.error("Failed to parse AI response:", aiResponse);
          taskData = {
            title: "New Maintenance Task",
            effortScore: 3,
            location: "General",
            priority: "Medium",
          };
        }

        // Save thumbnail as data URL if provided
        const thumbnailUrl = thumbnail
          ? `data:image/png;base64,${thumbnail}`
          : null;

        // Create task in database
        const [newTask] = await db
          .insert(tasks)
          .values({
            title: taskData.title || "New Maintenance Task",
            effortScore: Math.min(5, Math.max(1, taskData.effortScore || 3)),
            location: taskData.location || "General",
            priority: taskData.priority || "Medium",
            status: "Pending",
            thumbnailUrl,
            transcript,
            householdId: householdId || null,
          })
          .returning();

        res.status(201).json(newTask);
      } catch (error) {
        console.error("Error processing video:", error);
        res.status(500).json({ error: "Failed to process video" });
      }
    }
  );

  const httpServer = createServer(app);
  return httpServer;
}
