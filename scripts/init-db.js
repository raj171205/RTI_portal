import { Pool } from 'pg';
const pool = new Pool({
    user: 'rajpatel',
    host: '/tmp',
    database : 'rti_db',
    password :'',
    port :5433
});

async function initDB(){
    let client;

    try{
        client = await pool.connect();
        console.log("🔩 setting up RTI Database Schema....")
        await client.query('BEGIN');
        await client.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
        await client.query(`
            DO $$ BEGIN
            CREATE TYPE user_role AS ENUM ('CITIZEN', 'OFFICER', 'ADMIN');
            EXCEPTION
            WHEN duplicate_object THEN null;
            END $$;
    `);
        await client.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(150) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role user_role DEFAULT 'CITIZEN',
            department VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        `);



        await client.query(
            `CREATE TABLE IF NOT EXISTS rti_applications(
                id SERIAL PRIMARY KEY,
                application_no VARCHAR(50) UNIQUE NOT NULL,
                citizen_name VARCHAR(100) NOT NULL,
                subject VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                category VARCHAR(100) NOT NULL,
                status VARCHAR(50) DEFAULT 'PENDING',
                embedding vector(768),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            `
        )

    await client.query(
        `CREATE TABLE IF NOT EXISTS rti_responses(
            id SERIAL PRIMARY KEY,
            application_id INTEGER REFERENCES rti_applications(id) ON DELETE CASCADE,
            officer_name VARCHAR(100) NOT NULL,
            final_response TEXT NOT NULL,
            responded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    );

    await client.query(`
      CREATE INDEX IF NOT EXISTS rti_embedding_hnsw_idx 
      ON rti_applications 
      USING hnsw (embedding vector_cosine_ops);
    `);

    await client.query('COMMIT');
    console.log('✅ Tables aur HNSW Vector Index successfully create ho gaye!');
    }catch(error){
        if(client){
            await client.query('ROLLBACK');
        }
        console.error(' ❌ Sechma initaliation fail ho gya hai: ', error);

    }finally{
       if(client){
         client.release();
       }
        await pool.end();
    }
}
 
initDB();




