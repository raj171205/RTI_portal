import pg from 'pg';

const {Pool} = pg;

let pool;

if(!global._pgPool){
    global._pgPool = new Pool({
        user: process.env.PGUSER || 'rajpatel',
        host: process.env.PGHOST || '/tmp',
        database: process.env.PGDATABASE || 'rti_db',
        port: parseInt(process.env.PGPORT|| '5433',10)
    })
}

pool = global._pgPool;
export default pool;