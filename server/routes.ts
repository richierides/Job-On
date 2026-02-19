import express, { type Express, type Request, type Response } from "express";
import { createServer, type Server } from "node:http";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";
import bcrypt from "bcryptjs";
import OpenAI, { toFile } from "openai";
import { tasks, insertTaskSchema, updateTaskSchema, households, householdMembers, insertHouseholdSchema, insertHouseholdMemberSchema, savedPlans } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, isNotNull } from "drizzle-orm";

// Configure multer for file uploads (disk storage for large video files)
const uploadTmpDir = path.join("/tmp", "uploads");
if (!fs.existsSync(uploadTmpDir)) {
  fs.mkdirSync(uploadTmpDir, { recursive: true });
}
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadTmpDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".mov";
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

// OpenAI client for AI Integrations
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "videos");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function moveFile(src: string, dest: string) {
  try {
    fs.renameSync(src, dest);
  } catch (err: any) {
    if (err.code === "EXDEV") {
      fs.copyFileSync(src, dest);
      fs.unlinkSync(src);
    } else {
      throw err;
    }
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

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
      const id = parseInt(req.params.id as string);
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
      const code = (req.params.code as string).toUpperCase();
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

  // Add member to household (or link existing authenticated member)
  app.post("/api/households/:id/members", async (req: Request, res: Response) => {
    try {
      const householdId = parseInt(req.params.id as string);
      const { name, existingMemberId } = req.body;

      if (existingMemberId) {
        const [updated] = await db.update(householdMembers)
          .set({ householdId })
          .where(eq(householdMembers.id, existingMemberId))
          .returning();
        if (!updated) {
          return res.status(404).json({ error: "Member not found" });
        }
        return res.status(200).json(updated);
      }

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
      const householdId = parseInt(req.params.id as string);
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
      const id = parseInt(req.params.id as string);
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

  // Update member (auth info linkage)
  app.patch("/api/members/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      const { email, authProvider, authProviderId } = req.body;
      const updates: any = {};
      if (email) updates.email = email;
      if (authProvider) updates.authProvider = authProvider;
      if (authProviderId) updates.authProviderId = authProviderId;

      const [updated] = await db.update(householdMembers)
        .set(updates)
        .where(eq(householdMembers.id, id))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: "Member not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating member:", error);
      res.status(500).json({ error: "Failed to update member" });
    }
  });

  // Get all households a member belongs to (by shared auth identity)
  app.get("/api/members/:id/households", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string);
      const [member] = await db.select().from(householdMembers).where(eq(householdMembers.id, id));
      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }

      let allMembers: typeof member[] = [];

      if (member.email) {
        allMembers = await db.select().from(householdMembers)
          .where(eq(householdMembers.email, member.email));
      } else if (member.authProvider && member.authProviderId) {
        allMembers = await db.select().from(householdMembers)
          .where(and(
            eq(householdMembers.authProvider, member.authProvider),
            eq(householdMembers.authProviderId, member.authProviderId),
          ));
      } else {
        allMembers = [member];
      }

      const results = [];
      for (const m of allMembers) {
        if (m.householdId) {
          const [h] = await db.select().from(households).where(eq(households.id, m.householdId));
          if (h) {
            results.push({
              memberId: m.id,
              memberName: m.name,
              householdId: h.id,
              householdName: h.name,
              inviteCode: h.inviteCode,
            });
          }
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Error fetching member households:", error);
      res.status(500).json({ error: "Failed to fetch households" });
    }
  });

  // ============ Video Processing Endpoint ============

  // Process video and create task using AI
  const videoUpload = upload.fields([
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]);

  app.post(
    "/api/tasks/process-video",
    videoUpload,
    async (req: Request, res: Response) => {
      try {
        const timings: Record<string, number> = {};
        const totalStart = Date.now();
        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        const videoFile = files?.video?.[0];
        const thumbnailFile = files?.thumbnail?.[0];
        const householdId = req.body.householdId;

        if (!videoFile) {
          return res.status(400).json({ error: "Video file is required" });
        }

        console.log("Video upload received:", {
          originalname: videoFile.originalname,
          mimetype: videoFile.mimetype,
          size: videoFile.size,
          path: videoFile.path,
        });

        timings.uploadSizeMB = Math.round((videoFile.size / (1024 * 1024)) * 100) / 100;

        const tempVideoPath = videoFile.path;
        const tempAudioPath = path.join("/tmp", `audio_${uuidv4()}.mp3`);

        // Extract audio from video using ffmpeg (compressed MP3 for faster upload)
        let phaseStart = Date.now();
        const { spawn } = require("child_process");
        await new Promise<void>((resolve, reject) => {
          const ffmpeg = spawn("ffmpeg", [
            "-y",
            "-i", tempVideoPath,
            "-vn",
            "-acodec", "libmp3lame",
            "-ar", "16000",
            "-ac", "1",
            "-q:a", "6",
            tempAudioPath,
          ]);

          let stderrData = "";
          ffmpeg.stderr.on("data", (data: Buffer) => {
            stderrData += data.toString();
          });

          ffmpeg.on("close", (code: number) => {
            if (code === 0) resolve();
            else {
              console.error("ffmpeg stderr:", stderrData);
              reject(new Error(`ffmpeg exited with code ${code}`));
            }
          });
          ffmpeg.on("error", reject);
        });

        timings.audioExtractionMs = Date.now() - phaseStart;

        // Read audio file
        const audioBuffer = fs.readFileSync(tempAudioPath);

        // Transcribe audio using OpenAI Whisper
        phaseStart = Date.now();
        const audioFile = await toFile(audioBuffer, "audio.mp3");
        const transcription = await openai.audio.transcriptions.create({
          file: audioFile,
          model: "gpt-4o-mini-transcribe",
        });

        const transcript = transcription.text;
        timings.whisperTranscriptionMs = Date.now() - phaseStart;

        // Clean up temp audio file
        fs.unlinkSync(tempAudioPath);

        // Save video and thumbnail to permanent storage while GPT structures the task (parallel)
        const videoFilename = `${uuidv4()}.mp4`;
        const permanentVideoPath = path.join(UPLOADS_DIR, videoFilename);
        const videoUrl = `/uploads/videos/${videoFilename}`;

        let thumbnailUrl: string | null = null;
        const saveFilesPromise = (async () => {
          moveFile(tempVideoPath, permanentVideoPath);
          if (thumbnailFile) {
            const thumbFilename = `${uuidv4()}.jpg`;
            const thumbDir = path.join(process.cwd(), "uploads", "thumbnails");
            if (!fs.existsSync(thumbDir)) {
              fs.mkdirSync(thumbDir, { recursive: true });
            }
            moveFile(thumbnailFile.path, path.join(thumbDir, thumbFilename));
            thumbnailUrl = `/uploads/thumbnails/${thumbFilename}`;
          }
        })();

        const structuringPrompt = `You are an AI assistant that analyzes home maintenance task descriptions.

Given this transcript from a homeowner describing a maintenance issue, extract the following information:

Transcript: "${transcript}"

Respond with a JSON object containing:
1. "title": A concise, professional title for this maintenance task (e.g., "Replace leaky kitchen U-bend", "Fix squeaky bedroom door")
2. "effortScore": A number from 1-5 indicating the complexity/effort required (1=trivial, 5=major project)
3. "location": The room or area mentioned (choose from: General, Kitchen, Bathroom, Master Bedroom, Bedroom, Living Room, Dining Room, Garage, Garden, Basement, Attic, Laundry Room, Hallway, Exterior). Default to "General" if no clear location.
4. "priority": Either "Low", "Medium", or "High" based on urgency implied in the transcript. Default to "Medium".
5. "estimatedMinutes": Your best estimate for how long this task will take in minutes (e.g., 15, 30, 60, 120, 240). Consider the complexity and scope described.
6. "subtasks": An array of step-by-step actions needed to complete the task. Each item is an object with "title" (string) and "completed" (always false). Derive these from the transcript description. Include 2-6 clear, actionable steps.
7. "shoppingList": An array of materials or supplies the homeowner mentioned needing to buy or that are clearly required for this job. Each item is an object with "item" (string) and "checked" (always false). If no materials are mentioned or implied, use an empty array.

Respond ONLY with valid JSON, no markdown or explanation.`;

        phaseStart = Date.now();
        const [completion] = await Promise.all([
          openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "You are a helpful assistant that outputs only valid JSON." },
              { role: "user", content: structuringPrompt },
            ],
            response_format: { type: "json_object" },
            max_completion_tokens: 1500,
          }),
          saveFilesPromise,
        ]);

        timings.structuringMs = Date.now() - phaseStart;

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
            estimatedMinutes: 30,
            subtasks: [],
            shoppingList: [],
          };
        }

        const subtasks = Array.isArray(taskData.subtasks)
          ? taskData.subtasks.map((s: any) => ({ title: String(s.title || ""), completed: false }))
          : [];
        const shoppingList = Array.isArray(taskData.shoppingList)
          ? taskData.shoppingList.map((s: any) => ({ item: String(s.item || ""), checked: false }))
          : [];

        const [newTask] = await db
          .insert(tasks)
          .values({
            title: taskData.title || "New Maintenance Task",
            effortScore: Math.min(5, Math.max(1, taskData.effortScore || 3)),
            location: taskData.location || "General",
            priority: taskData.priority || "Medium",
            status: "Pending",
            thumbnailUrl,
            videoUrl,
            transcript,
            householdId: householdId || null,
            estimatedMinutes: taskData.estimatedMinutes ? Math.max(5, Math.round(taskData.estimatedMinutes)) : null,
            subtasks,
            shoppingList,
          })
          .returning();

        timings.totalMs = Date.now() - totalStart;

        console.log("Task generation timing:", {
          uploadSizeMB: timings.uploadSizeMB,
          audioExtractionMs: timings.audioExtractionMs,
          whisperTranscriptionMs: timings.whisperTranscriptionMs,
          structuringMs: timings.structuringMs,
          totalMs: timings.totalMs,
        });

        res.status(201).json({ ...newTask, _timings: timings });
      } catch (error: any) {
        console.error("Error processing video:", error?.message || error);
        console.error("Stack:", error?.stack);
        res.status(500).json({ error: "Failed to process video", details: error?.message || "Unknown error" });
      }
    }
  );

  // ============ Plan Chat Endpoint ============

  app.post("/api/plan/chat", async (req: Request, res: Response) => {
    try {
      const { messages, tasks: pendingTasks, members: availableMembers, householdName } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array is required" });
      }

      const taskSummary = (pendingTasks || [])
        .map((t: any) => `- "${t.title}" (${t.location}, ${t.priority} priority, effort ${t.effortScore}/5, ~${t.estimatedMinutes || '?'}min)`)
        .join("\n");

      const memberList = (availableMembers || [])
        .map((m: any) => m.name)
        .join(", ");

      const systemPrompt = `You are a friendly home maintenance planning assistant for the Home DIY Tracker app. You help homeowners create a sensible weekly plan for their pending tasks.

You have access to these pending tasks:
${taskSummary || "No tasks yet."}

${householdName ? `Household name: "${householdName}" — this is the NAME OF THE HOUSE/HOUSEHOLD, NOT a person. Do not assign tasks to the household name.\n\n` : ""}People in the household who can be assigned tasks: ${memberList || "Just the homeowner."}
IMPORTANT: Only assign tasks to people listed above. Never assign tasks to the household name itself.

Your job is to have a SHORT conversation (2-3 questions max) to understand:
1. When they want to start (e.g. "this weekend", "next Monday")
2. How much time each person has available per week (e.g. "weekends only, about 4 hours", "a couple of evenings, 2 hours each")

Then generate a structured weekly plan. When generating the plan, respond with a JSON block wrapped in \`\`\`json ... \`\`\` containing:
{
  "plan": {
    "startDate": "YYYY-MM-DD",
    "weeks": [
      {
        "weekNumber": 1,
        "label": "Week 1 - Feb 10-16",
        "tasks": [
          {
            "taskTitle": "Fix bathroom tap",
            "assignee": "Person name or null",
            "estimatedMinutes": 60,
            "day": "Saturday"
          }
        ],
        "totalMinutes": 120
      }
    ]
  }
}

Guidelines for planning:
- Group tasks by location when possible (do all kitchen jobs together)
- Put high priority tasks first
- Respect the time budget each person has
- Keep each week's total within available hours
- Add a brief friendly message before the JSON explaining the plan
- If the user asks to adjust the plan, regenerate the full JSON with changes
- Keep responses concise and conversational`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m: any) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ],
        max_completion_tokens: 2000,
      });

      const reply = completion.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";
      res.json({ reply });
    } catch (error) {
      console.error("Error in plan chat:", error);
      res.status(500).json({ error: "Failed to generate plan response" });
    }
  });

  // ============ Auth Endpoints ============

  async function findOrCreateSSOUser(provider: string, providerId: string, email: string | null, name: string) {
    const [existing] = await db.select().from(householdMembers)
      .where(and(eq(householdMembers.authProvider, provider), eq(householdMembers.authProviderId, providerId)));
    if (existing) {
      const household = existing.householdId
        ? (await db.select().from(households).where(eq(households.id, existing.householdId)))[0]
        : null;
      return { member: existing, household, isNew: false };
    }

    if (email) {
      const [byEmail] = await db.select().from(householdMembers).where(eq(householdMembers.email, email.toLowerCase().trim()));
      if (byEmail) {
        const [updated] = await db.update(householdMembers)
          .set({ authProvider: provider, authProviderId: providerId })
          .where(eq(householdMembers.id, byEmail.id))
          .returning();
        const household = updated.householdId
          ? (await db.select().from(households).where(eq(households.id, updated.householdId)))[0]
          : null;
        return { member: updated, household, isNew: false };
      }
    }

    const [newMember] = await db.insert(householdMembers).values({
      name,
      email: email ? email.toLowerCase().trim() : null,
      authProvider: provider,
      authProviderId: providerId,
      householdId: null,
    }).returning();
    return { member: newMember, household: null, isNew: true };
  }

  app.post("/api/auth/apple", async (req: Request, res: Response) => {
    try {
      const { identityToken, user, fullName, email } = req.body;
      if (!identityToken || !user) {
        return res.status(400).json({ error: "Identity token and user ID are required" });
      }

      const name = fullName
        ? [fullName.givenName, fullName.familyName].filter(Boolean).join(" ") || "User"
        : "User";

      const result = await findOrCreateSSOUser("apple", user, email || null, name);

      res.json({
        member: {
          id: result.member.id,
          name: result.member.name,
          email: result.member.email,
          householdId: result.member.householdId,
          authProvider: result.member.authProvider,
        },
        household: result.household,
        isNew: result.isNew,
      });
    } catch (error) {
      console.error("Error with Apple sign in:", error);
      res.status(500).json({ error: "Failed to sign in with Apple" });
    }
  });

  app.post("/api/auth/google", async (req: Request, res: Response) => {
    try {
      const { idToken } = req.body;
      if (!idToken) {
        return res.status(400).json({ error: "ID token is required" });
      }

      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
      if (!response.ok) {
        return res.status(401).json({ error: "Invalid Google token" });
      }
      const tokenData = await response.json();
      const { sub: googleId, email, name } = tokenData;

      if (!googleId) {
        return res.status(401).json({ error: "Invalid Google token data" });
      }

      const result = await findOrCreateSSOUser("google", googleId, email || null, name || "User");

      res.json({
        member: {
          id: result.member.id,
          name: result.member.name,
          email: result.member.email,
          householdId: result.member.householdId,
          authProvider: result.member.authProvider,
        },
        household: result.household,
        isNew: result.isNew,
      });
    } catch (error) {
      console.error("Error with Google sign in:", error);
      res.status(500).json({ error: "Failed to sign in with Google" });
    }
  });

  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ error: "Name, email, and password are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const [existing] = await db.select().from(householdMembers).where(eq(householdMembers.email, normalizedEmail));
      if (existing) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const [newMember] = await db.insert(householdMembers).values({
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        authProvider: "email",
        householdId: null,
      }).returning();

      res.json({
        member: {
          id: newMember.id,
          name: newMember.name,
          email: newMember.email,
          householdId: newMember.householdId,
          authProvider: newMember.authProvider,
        },
        household: null,
        isNew: true,
      });
    } catch (error) {
      console.error("Error signing up:", error);
      res.status(500).json({ error: "Failed to create account" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const [member] = await db.select().from(householdMembers).where(eq(householdMembers.email, email.toLowerCase().trim()));
      if (!member || !member.passwordHash) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, member.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const household = member.householdId
        ? (await db.select().from(households).where(eq(households.id, member.householdId)))[0]
        : null;

      res.json({
        member: {
          id: member.id,
          name: member.name,
          email: member.email,
          householdId: member.householdId,
          authProvider: member.authProvider,
        },
        household: household || null,
        isNew: false,
      });
    } catch (error) {
      console.error("Error logging in:", error);
      res.status(500).json({ error: "Failed to log in" });
    }
  });

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { memberId, email, password } = req.body;
      if (!memberId || !email || !password) {
        return res.status(400).json({ error: "Member ID, email, and password are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      const [existingMember] = await db.select().from(householdMembers).where(eq(householdMembers.id, memberId));
      if (!existingMember) {
        return res.status(404).json({ error: "Member not found" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const [emailTaken] = await db.select().from(householdMembers).where(eq(householdMembers.email, normalizedEmail));
      if (emailTaken && emailTaken.id !== memberId) {
        return res.status(409).json({ error: "This email is already registered" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const [updated] = await db
        .update(householdMembers)
        .set({ email: normalizedEmail, passwordHash, authProvider: "email" })
        .where(eq(householdMembers.id, memberId))
        .returning();

      res.json({ success: true, member: { id: updated.id, name: updated.name, email: updated.email, householdId: updated.householdId } });
    } catch (error) {
      console.error("Error registering:", error);
      res.status(500).json({ error: "Failed to register account" });
    }
  });

  // ============ Saved Plans Endpoints ============

  app.get("/api/plans", async (req: Request, res: Response) => {
    try {
      const householdId = req.query.householdId ? parseInt(req.query.householdId as string) : null;
      if (!householdId) {
        return res.status(400).json({ error: "householdId is required" });
      }
      const plans = await db.select().from(savedPlans).where(eq(savedPlans.householdId, householdId)).orderBy(desc(savedPlans.createdAt));
      res.json(plans);
    } catch (error) {
      console.error("Error fetching plans:", error);
      res.status(500).json({ error: "Failed to fetch plans" });
    }
  });

  app.post("/api/plans", async (req: Request, res: Response) => {
    try {
      const { householdId, name, planData } = req.body;
      if (!householdId || !planData) {
        return res.status(400).json({ error: "householdId and planData are required" });
      }
      const [newPlan] = await db.insert(savedPlans).values({
        householdId,
        name: name || "My Plan",
        planData,
      }).returning();
      res.status(201).json(newPlan);
    } catch (error) {
      console.error("Error saving plan:", error);
      res.status(500).json({ error: "Failed to save plan" });
    }
  });

  app.delete("/api/plans/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await db.delete(savedPlans).where(eq(savedPlans.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting plan:", error);
      res.status(500).json({ error: "Failed to delete plan" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
