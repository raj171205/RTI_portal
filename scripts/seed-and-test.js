import pool from '../lib/db.js';
import { generateEmbedding } from '../lib/embedding.js';

const sampleData = [
  {
    citizen: { name: 'Aarav Sharma', email: 'aarav@example.com' },
    officer: { name: 'Vikram Singh', email: 'vikram@mcd.gov.in', department: 'Public Works' },
    application: {
      application_no: 'RTI-2026-PWD-001',
      subject: 'Delay in road resurfacing and pothole repairs in Sector 14',
      description: 'Requesting tender details, assigned contractor name, sanctioned budget, and expected completion date for Sector 14 main road reconstruction.',
      category: 'Public Works',
      status: 'ANSWERED',
    },
    response: {
      final_response: 'Tender No. PWD/2025/892 was awarded to InfraBuild Ltd. Sanctioned budget is ₹42.5 Lakhs. Expected completion date is November 30, 2026. Delay was caused by monsoon drainage pipeline shifting.',
    },
  },
  {
    citizen: { name: 'Pooja Verma', email: 'pooja@example.com' },
    officer: { name: 'Sunita Rao', email: 'sunita@edu.gov.in', department: 'Education' },
    application: {
      application_no: 'RTI-2026-EDU-045',
      subject: 'Merit-cum-means college scholarship disbursement status',
      description: 'Seeking verification list of students eligible for the 2025-2026 higher education state scholarship and reason for fund release delay.',
      category: 'Higher Education',
      status: 'ANSWERED',
    },
    response: {
      final_response: 'Scrutiny of 1,240 applications is complete. The treasury sanctioned ₹1.8 Crore on October 12, 2026. Direct bank transfers (DBT) will be credited by October 31, 2026.',
    },
  },
  {
    citizen: { name: 'Rohan Mehta', email: 'rohan@example.com' },
    officer: { name: 'Anil Gupta', email: 'anil@jal.gov.in', department: 'Water Supply' },
    application: {
      application_no: 'RTI-2026-JAL-108',
      subject: 'Low water pressure and contamination complaints in Ward 7',
      description: 'Requesting daily water quality test reports for October 2026 and timeline for water treatment plant filter replacement in Ward 7.',
      category: 'Water Board',
      status: 'ANSWERED',
    },
    response: {
      final_response: 'Water quality tests dated Oct 1-20 indicate TDS within permissible limits (180-220 ppm). Primary carbon filtration replacement work commenced on Oct 22 and will conclude by Oct 28.',
    },
  },
];

async function seedAndTest() {
  let client;
  try {
    client = await pool.connect();
    console.log('🌱 Seeding sample users, RTI records, and embeddings...');

    for (const item of sampleData) {
      // 1. Citizen User Insert
      const citizenRes = await client.query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, 'dummy_hash', 'CITIZEN')
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [item.citizen.name, item.citizen.email]
      );
      const citizenId = citizenRes.rows[0].id;

      // 2. Officer User Insert
      const officerRes = await client.query(
        `INSERT INTO users (name, email, password_hash, role, department)
         VALUES ($1, $2, 'dummy_hash', 'OFFICER', $3)
         ON CONFLICT (email) DO UPDATE SET department = EXCLUDED.department
         RETURNING id`,
        [item.officer.name, item.officer.email, item.officer.department]
      );
      const officerId = officerRes.rows[0].id;

      // 3. Generate Gemini Vector Embedding
      const fullText = `${item.application.subject}: ${item.application.description}`;
      console.log(`🤖 Generating embedding for: "${item.application.subject}"...`);
      const embedding = await generateEmbedding(fullText);
      const embeddingString = `[${embedding.join(',')}]`;

      // 4. RTI Application Insert
      const appRes = await client.query(
        `INSERT INTO rti_applications 
         (application_no, citizen_id, subject, description, category, status, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
         ON CONFLICT (application_no) DO UPDATE SET embedding = EXCLUDED.embedding
         RETURNING id`,
        [
          item.application.application_no,
          citizenId,
          item.application.subject,
          item.application.description,
          item.application.category,
          item.application.status,
          embeddingString,
        ]
      );
      const appId = appRes.rows[0].id;

      // 5. Clean & insert response (Avoid ON CONFLICT error without unique index)
      await client.query(`DELETE FROM rti_responses WHERE application_id = $1`, [appId]);
      await client.query(
        `INSERT INTO rti_responses (application_id, officer_id, final_response)
         VALUES ($1, $2, $3)`,
        [appId, officerId, item.response.final_response]
      );
    }

    console.log('\n✅ Data seeding completed successfully!\n');

    // -------------------------------------------------------------
    // TEST SEMANTIC SEARCH
    // -------------------------------------------------------------
    const testQuery = 'When will the broken street be paved and repaired?';
    console.log(`🔍 Testing Semantic Search with Query: "${testQuery}"`);

    const queryVector = await generateEmbedding(testQuery);
    const queryVectorString = `[${queryVector.join(',')}]`;

    const searchResult = await client.query(
      `
      SELECT 
        a.application_no,
        a.subject,
        a.description,
        r.final_response,
        ROUND((1 - (a.embedding <=> $1::vector))::numeric, 4) AS similarity_score
      FROM rti_applications a
      LEFT JOIN rti_responses r ON a.id = r.application_id
      ORDER BY a.embedding <=> $1::vector ASC
      LIMIT 1;
      `,
      [queryVectorString]
    );

    console.log('\n🎯 Closest Match Found:');
    console.table(searchResult.rows);

  } catch (error) {
    console.error('❌ Seeding/Search test failed:', error);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

seedAndTest();