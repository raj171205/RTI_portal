import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "./db.js";
import { generateEmbedding, draftRTIWithAI } from "./embedding.js";
import { verifyToken, requireOfficer } from "./middleware/auth.js";

dotenv.config();

const app = express();
const PORT = 5001;

app.use(cors());
app.use(express.json());

// --- AUTH ROUTES ---

// Register (Citizen or Officer)
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email aur password zaroori hain." });
    }

    const userRole = role === "OFFICER" ? "OFFICER" : "CITIZEN";
    if (userRole === "OFFICER" && !department) {
      return res.status(400).json({ error: "Officer ke liye department select karna zaroori hai." });
    }

    const existing = await pool.query("SELECT id FROM users WHERE email = $1;", [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Yeh email pehle se registered hai." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, department)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, department;`,
      [name.trim(), email.toLowerCase().trim(), passwordHash, userRole, userRole === "OFFICER" ? department : null]
    );

    const user = result.rows[0];
    const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({ token, user });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed." });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email aur password daalein." });
    }

    const result = await pool.query("SELECT * FROM users WHERE email = $1;", [email.toLowerCase().trim()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Galat email ya password." });
    }

    const dbUser = result.rows[0];
    const valid = await bcrypt.compare(password, dbUser.password_hash || "");
    if (!valid) {
      return res.status(401).json({ error: "Galat email ya password." });
    }

    const user = {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      department: dbUser.department,
    };
    const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({ token, user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed." });
  }
});

// --- RTI ROUTES ---

// 1. GET /api/rti - Public Feed + Stats + Citizen/Department Filter
app.get("/api/rti", async (req, res) => {
  try {
    const { status, mine, department } = req.query;
    let userId = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
        userId = decoded.id;
      } catch {
        // Public access allowed if token is expired/invalid
      }
    }

    const statsResult = await pool.query(`
      SELECT 
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'RESPONDED')::int AS responded
      FROM rti_applications;
    `);

    let listQuery = `
      SELECT a.id, a.application_no, a.subject, a.description, a.category, a.status, a.created_at,
             u.name AS citizen_name
      FROM rti_applications a
      LEFT JOIN users u ON a.citizen_id = u.id
    `;

    const conditions = [];
    const params = [];

    if (status && ["PENDING", "RESPONDED"].includes(status.toUpperCase())) {
      params.push(status.toUpperCase());
      conditions.push(`a.status = $${params.length}`);
    }

    if (mine === "true" && userId) {
      params.push(userId);
      conditions.push(`a.citizen_id = $${params.length}`);
    }

    if (department) {
      params.push(department);
      conditions.push(`a.category = $${params.length}`);
    }

    if (conditions.length > 0) {
      listQuery += ` WHERE ` + conditions.join(" AND ");
    }

    listQuery += ` ORDER BY a.created_at DESC LIMIT 30;`;
    const listResult = await pool.query(listQuery, params);

    res.json({ stats: statsResult.rows[0], applications: listResult.rows });
  } catch (err) {
    console.error("GET /api/rti error:", err);
    res.status(500).json({ error: "RTI list fetch nahi ho payi." });
  }
});

// 2. GET /api/rti/search - Public Semantic Search
app.get("/api/rti/search", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: "Query kam se kam 2 characters ki honi chahiye." });
    }

    const queryEmbedding = await generateEmbedding(query.trim());
    const vectorString = `[${queryEmbedding.join(",")}]`;

    const result = await pool.query(
      `SELECT id, application_no, subject, description, category, status, created_at,
        ROUND(((1 - (embedding <=> $1::vector)) * 100)::numeric, 2) AS similarity_score
       FROM rti_applications
       WHERE embedding IS NOT NULL AND (embedding <=> $1::vector) < 0.65
       ORDER BY (embedding <=> $1::vector) ASC LIMIT 10;`,
      [vectorString]
    );

    res.json({ results: result.rows });
  } catch (err) {
    console.error("GET /api/rti/search error:", err);
    res.status(500).json({ error: "Semantic search me error aaya." });
  }
});

// 3. POST /api/rti/draft - AI RTI Draft Assistant (Protected)
app.post("/api/rti/draft", verifyToken, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || prompt.trim().length < 10) {
      return res.status(400).json({ error: "Kam se kam 10 characters me apni samasya likhein." });
    }

    const draft = await draftRTIWithAI(prompt.trim());
    res.json({ draft });
  } catch (err) {
    console.error("POST /api/rti/draft error:", err);
    res.status(500).json({ error: "AI draft generate nahi ho paya. Dobara try karein." });
  }
});

// 4. POST /api/rti/submit - Protected (Logged-in User)
app.post("/api/rti/submit", verifyToken, async (req, res) => {
  try {
    const { subject, description, category, force_submit } = req.body;
    if (!subject || !description || !category) {
      return res.status(400).json({ error: "Saari fields zaroori hain." });
    }

    const cleanSubject = subject.trim();
    const cleanDescription = description.trim();
    const embedding = await generateEmbedding(`${cleanSubject}. ${cleanDescription}`);
    const vectorString = `[${embedding.join(",")}]`;

    if (!force_submit) {
      const dupCheck = await pool.query(
        `SELECT id, application_no, subject, status,
          ROUND(((1 - (embedding <=> $1::vector)) * 100)::numeric, 2) AS similarity_score
         FROM rti_applications
         WHERE embedding IS NOT NULL AND (embedding <=> $1::vector) < 0.22
         ORDER BY (embedding <=> $1::vector) ASC LIMIT 3;`,
        [vectorString]
      );

      if (dupCheck.rows.length > 0) {
        return res.status(409).json({
          duplicate_found: true,
          message: "Is topic se milti-julti RTI pehle se maujood hai.",
          similar_rtis: dupCheck.rows,
        });
      }
    }

    const applicationNo = `RTI-${Date.now()}`;
    const result = await pool.query(
      `INSERT INTO rti_applications (application_no, citizen_id, subject, description, category, embedding)
       VALUES ($1, $2, $3, $4, $5, $6::vector)
       RETURNING id, application_no, subject, category, status, created_at;`,
      [applicationNo, req.user.id, cleanSubject, cleanDescription, category, vectorString]
    );

    res.status(201).json({ message: "RTI submitted!", data: result.rows[0] });
  } catch (err) {
    console.error("POST /api/rti/submit error:", err);
    res.status(500).json({ error: "RTI save nahi ho payi." });
  }
});

// 5. GET /api/rti/:id - Public Single RTI Details
app.get("/api/rti/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, 
              c.name AS citizen_name,
              r.id AS response_id, r.response_text, r.responded_at,
              o.name AS officer_name, o.department AS officer_department
       FROM rti_applications a
       LEFT JOIN users c ON a.citizen_id = c.id
       LEFT JOIN rti_responses r ON a.id = r.application_id
       LEFT JOIN users o ON r.officer_id = o.id
       WHERE a.id = $1;`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "RTI nahi mili." });
    }

    const row = result.rows[0];
    res.json({
      data: {
        ...row,
        official_response: row.response_id
          ? {
              id: row.response_id,
              response_text: row.response_text,
              responded_at: row.responded_at,
              officer_name: row.officer_name || "Public Information Officer",
              officer_department: row.officer_department || row.category,
            }
          : null,
      },
    });
  } catch (err) {
    console.error("GET /api/rti/:id error:", err);
    res.status(500).json({ error: "Details fetch nahi ho payi." });
  }
});

// 6. POST /api/rti/:id/response - Protected (OFFICER ONLY + Department Guard)
app.post("/api/rti/:id/response", verifyToken, requireOfficer, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { response_text } = req.body;

    if (!response_text || response_text.trim().length < 10) {
      return res.status(400).json({ error: "Response kam se kam 10 characters ka ho." });
    }

    await client.query("BEGIN");
    const check = await client.query(
      "SELECT status, category FROM rti_applications WHERE id = $1 FOR UPDATE;",
      [id]
    );

    if (check.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "RTI nahi mili." });
    }
    if (check.rows[0].category !== req.user.department) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        error: `Access Denied: Yeh RTI "${check.rows[0].category}" ki hai, aapke department ki nahi.`,
      });
    }
    if (check.rows[0].status === "RESPONDED") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Jawab pehle hi darj ho chuka hai." });
    }

    const insert = await client.query(
      `INSERT INTO rti_responses (application_id, officer_id, response_text) VALUES ($1, $2, $3) RETURNING *;`,
      [id, req.user.id, response_text.trim()]
    );
    await client.query(
      "UPDATE rti_applications SET status = 'RESPONDED' WHERE id = $1;",
      [id]
    );
    await client.query("COMMIT");

    res.status(201).json({ data: insert.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST /api/rti/:id/response error:", err);
    res.status(500).json({ error: "Response save nahi ho paya." });
  } finally {
    client.release();
  }
});

app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));