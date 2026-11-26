# AI-Powered RTI Portal

Full-stack Right to Information (RTI) application built with **React (Vite + Tailwind CSS)**, **Node.js (Express)**, **PostgreSQL (`pgvector`)**, and **Google Gemini API**.

## Features
- **AI Semantic Search:** Meaning-based RTI search using `pgvector` cosine similarity and Gemini `text-embedding-004`.
- **AI Duplicate Detection:** Automatically detects similar existing RTIs (`409 Conflict` check) before submission.
- **AI RTI Draft Assistant:** Converts rough citizen queries into formal RTI Act, 2005 applications using Gemini `gemini-2.5-flash`.
- **Role-Based Access Control (JWT):** Separate Citizen and Public Information Officer (PIO) workflows with department-level authorization.
