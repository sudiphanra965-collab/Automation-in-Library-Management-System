// PostgreSQL Database Connection Module
// Optimized for high performance and scalability

require('dotenv').config();
const { Pool } = require('pg');

// ==================== CONNECTION POOL CONFIGURATION ====================
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'library_system',
  user: process.env.DB_USER || 'library_admin',
  password: process.env.DB_PASSWORD || 'your_password',
  
  // Connection pool settings for high performance
  max: 20, // Maximum number of clients in the pool
  min: 5,  // Minimum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return error after 10 seconds if connection not available
  
  // SSL configuration (enable for production)
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

// ==================== ERROR HANDLING ====================
pool.on('error', (err, client) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

pool.on('connect', () => {
  console.log('✅ New client connected to PostgreSQL');
});

pool.on('remove', () => {
  console.log('🔌 Client removed from pool');
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Execute a query with parameters
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise} Query result
 */
async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries (> 100ms)
    if (duration > 100) {
      console.warn(`⚠️ Slow query (${duration}ms):`, text.substring(0, 100));
    }
    
    return result;
  } catch (error) {
    console.error('❌ Query error:', error.message);
    console.error('Query:', text);
    console.error('Params:', params);
    throw error;
  }
}

/**
 * Get a single row
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise} Single row or null
 */
async function get(text, params = []) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

/**
 * Get all rows
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise} Array of rows
 */
async function all(text, params = []) {
  const result = await query(text, params);
  return result.rows;
}

/**
 * Execute a query (INSERT, UPDATE, DELETE)
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise} Query result with rowCount
 */
async function run(text, params = []) {
  const result = await query(text, params);
  return {
    lastID: result.rows[0]?.id || null,
    changes: result.rowCount
  };
}

/**
 * Begin a transaction
 * @returns {Promise} Transaction client
 */
async function beginTransaction() {
  const client = await pool.connect();
  await client.query('BEGIN');
  return client;
}

/**
 * Commit a transaction
 * @param {Object} client - Transaction client
 */
async function commitTransaction(client) {
  await client.query('COMMIT');
  client.release();
}

/**
 * Rollback a transaction
 * @param {Object} client - Transaction client
 */
async function rollbackTransaction(client) {
  await client.query('ROLLBACK');
  client.release();
}

/**
 * Execute multiple queries in a transaction
 * @param {Function} callback - Async function with queries
 * @returns {Promise} Transaction result
 */
async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Full-text search on books
 * @param {string} searchTerm - Search term
 * @param {number} limit - Maximum results
 * @returns {Promise} Array of books
 */
async function searchBooks(searchTerm, limit = 20) {
  const text = `
    SELECT id, title, author, isbn, category, publisher, year, 
           description, image, available, rating, review_count,
           ts_rank(search_vector, plainto_tsquery('english', $1)) as rank
    FROM books
    WHERE search_vector @@ plainto_tsquery('english', $1)
       OR title ILIKE $2
       OR author ILIKE $2
    ORDER BY rank DESC, rating DESC
    LIMIT $3
  `;
  const params = [searchTerm, `%${searchTerm}%`, limit];
  return all(text, params);
}

/**
 * Get book recommendations for a user
 * @param {number} userId - User ID
 * @param {number} limit - Maximum results
 * @returns {Promise} Array of recommended books
 */
async function getRecommendations(userId, limit = 10) {
  const text = `SELECT * FROM get_recommendations($1, $2)`;
  return all(text, [userId, limit]);
}

/**
 * Update user statistics
 * @param {number} userId - User ID
 */
async function updateUserStats(userId) {
  const text = `SELECT update_user_stats($1)`;
  await query(text, [userId]);
}

/**
 * Get database statistics
 * @returns {Promise} Database stats
 */
async function getDatabaseStats() {
  const stats = {};
  
  // Table sizes
  const tableSizes = await all(`
    SELECT 
      schemaname,
      tablename,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
      pg_total_relation_size(schemaname||'.'||tablename) as bytes
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY bytes DESC
  `);
  stats.tableSizes = tableSizes;
  
  // Connection pool stats
  stats.pool = {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount
  };
  
  // Database size
  const dbSize = await get(`
    SELECT pg_size_pretty(pg_database_size(current_database())) as size
  `);
  stats.databaseSize = dbSize.size;
  
  return stats;
}

/**
 * Check database health
 * @returns {Promise} Health status
 */
async function healthCheck() {
  try {
    const result = await query('SELECT NOW() as time, version() as version');
    return {
      status: 'healthy',
      timestamp: result.rows[0].time,
      version: result.rows[0].version,
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

/**
 * Close all database connections
 */
async function close() {
  await pool.end();
  console.log('🔌 Database pool closed');
}

// ==================== GRACEFUL SHUTDOWN ====================
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await close();
  process.exit(0);
});

// ==================== EXPORTS ====================
module.exports = {
  pool,
  query,
  get,
  all,
  run,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  transaction,
  searchBooks,
  getRecommendations,
  updateUserStats,
  getDatabaseStats,
  healthCheck,
  close
};

// ==================== INITIALIZATION ====================
(async () => {
  try {
    const health = await healthCheck();
    if (health.status === 'healthy') {
      console.log('✅ PostgreSQL connection pool initialized');
      console.log(`📊 Database: ${process.env.DB_NAME || 'library_system'}`);
      console.log(`🔌 Pool size: ${pool.options.max} connections`);
    } else {
      console.error('❌ Database health check failed:', health.error);
    }
  } catch (error) {
    console.error('❌ Failed to initialize database:', error.message);
  }
})();
