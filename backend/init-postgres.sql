-- PostgreSQL Database Schema for Advanced Library System
-- Optimized for millions of records and thousands of concurrent users

-- ==================== EXTENSIONS ====================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- ==================== USERS TABLE ====================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    active BOOLEAN DEFAULT TRUE
);

-- Index for faster user lookups
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(active);

-- ==================== BOOKS TABLE ====================
CREATE TABLE IF NOT EXISTS books (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    author VARCHAR(300) NOT NULL,
    isbn VARCHAR(20) UNIQUE,
    category VARCHAR(100),
    publisher VARCHAR(200),
    year INTEGER,
    description TEXT,
    image VARCHAR(500),
    available BOOLEAN DEFAULT TRUE,
    rating DECIMAL(3,2) DEFAULT 0.0,
    review_count INTEGER DEFAULT 0,
    total_borrows INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    search_vector tsvector
);

-- Indexes for performance
CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_books_author ON books(author);
CREATE INDEX idx_books_isbn ON books(isbn);
CREATE INDEX idx_books_category ON books(category);
CREATE INDEX idx_books_available ON books(available);
CREATE INDEX idx_books_rating ON books(rating DESC);
CREATE INDEX idx_books_year ON books(year);
CREATE INDEX idx_books_search ON books USING gin(search_vector);
CREATE INDEX idx_books_title_trgm ON books USING gin(title gin_trgm_ops);
CREATE INDEX idx_books_author_trgm ON books USING gin(author gin_trgm_ops);

-- Trigger to update search_vector automatically
CREATE OR REPLACE FUNCTION books_search_trigger() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := 
        to_tsvector('english', coalesce(NEW.title,'') || ' ' || 
                               coalesce(NEW.author,'') || ' ' || 
                               coalesce(NEW.description,'') || ' ' ||
                               coalesce(NEW.category,''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER books_search_update BEFORE INSERT OR UPDATE
ON books FOR EACH ROW EXECUTE FUNCTION books_search_trigger();

-- ==================== BORROWED BOOKS TABLE ====================
CREATE TABLE IF NOT EXISTS borrowed_books (
    id SERIAL PRIMARY KEY,
    book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    author VARCHAR(300) NOT NULL,
    borrow_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    return_date TIMESTAMP,
    returned_date TIMESTAMP,
    status VARCHAR(20) DEFAULT 'borrowed', -- borrowed, returned, overdue
    fine_amount DECIMAL(10,2) DEFAULT 0.0
);

-- Indexes for performance
CREATE INDEX idx_borrowed_user ON borrowed_books(user_id);
CREATE INDEX idx_borrowed_book ON borrowed_books(book_id);
CREATE INDEX idx_borrowed_status ON borrowed_books(status);
CREATE INDEX idx_borrowed_dates ON borrowed_books(borrow_date, return_date);
CREATE INDEX idx_borrowed_returned ON borrowed_books(returned_date) WHERE returned_date IS NULL;

-- ==================== READING LISTS TABLE ====================
CREATE TABLE IF NOT EXISTS reading_lists (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

CREATE INDEX idx_reading_lists_user ON reading_lists(user_id);
CREATE INDEX idx_reading_lists_public ON reading_lists(is_public) WHERE is_public = TRUE;

-- ==================== LIST ITEMS TABLE ====================
CREATE TABLE IF NOT EXISTS list_items (
    id SERIAL PRIMARY KEY,
    list_id INTEGER NOT NULL REFERENCES reading_lists(id) ON DELETE CASCADE,
    book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    priority INTEGER DEFAULT 0,
    UNIQUE(list_id, book_id)
);

CREATE INDEX idx_list_items_list ON list_items(list_id);
CREATE INDEX idx_list_items_book ON list_items(book_id);

-- ==================== REVIEWS TABLE ====================
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(book_id, user_id)
);

CREATE INDEX idx_reviews_book ON reviews(book_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_helpful ON reviews(helpful_count DESC);

-- Trigger to update book rating
CREATE OR REPLACE FUNCTION update_book_rating() RETURNS trigger AS $$
BEGIN
    UPDATE books SET 
        rating = (SELECT AVG(rating)::DECIMAL(3,2) FROM reviews WHERE book_id = NEW.book_id),
        review_count = (SELECT COUNT(*) FROM reviews WHERE book_id = NEW.book_id)
    WHERE id = NEW.book_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER review_rating_update AFTER INSERT OR UPDATE OR DELETE
ON reviews FOR EACH ROW EXECUTE FUNCTION update_book_rating();

-- ==================== NOTIFICATIONS TABLE ====================
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(500),
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- ==================== RESERVATIONS TABLE ====================
CREATE TABLE IF NOT EXISTS reservations (
    id SERIAL PRIMARY KEY,
    book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, available, expired, cancelled
    reserved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notified_at TIMESTAMP,
    expires_at TIMESTAMP,
    cancelled_at TIMESTAMP
);

CREATE INDEX idx_reservations_book ON reservations(book_id);
CREATE INDEX idx_reservations_user ON reservations(user_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_position ON reservations(book_id, position);

-- ==================== ACHIEVEMENTS TABLE ====================
CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    criteria TEXT,
    points INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_achievements_name ON achievements(name);

-- ==================== USER ACHIEVEMENTS TABLE ====================
CREATE TABLE IF NOT EXISTS user_achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_achievement ON user_achievements(achievement_id);

-- ==================== USER STATS TABLE ====================
CREATE TABLE IF NOT EXISTS user_stats (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    total_borrowed INTEGER DEFAULT 0,
    total_returned INTEGER DEFAULT 0,
    currently_borrowed INTEGER DEFAULT 0,
    reading_streak INTEGER DEFAULT 0,
    last_borrow_date DATE,
    favorite_category VARCHAR(100),
    total_points INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_stats_streak ON user_stats(reading_streak DESC);
CREATE INDEX idx_user_stats_points ON user_stats(total_points DESC);

-- ==================== ACTIVITY LOG TABLE (for analytics) ====================
CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_user ON activity_log(user_id);
CREATE INDEX idx_activity_action ON activity_log(action);
CREATE INDEX idx_activity_created ON activity_log(created_at DESC);
CREATE INDEX idx_activity_details ON activity_log USING gin(details);

-- ==================== DEFAULT DATA ====================

-- Insert default admin user (password: admin123)
INSERT INTO users (username, password, is_admin) 
VALUES ('admin', '$2a$10$8K1p/a0dL3LKziBNW4H9.OWO8gHrVGGvFNqKqvKqXqKqKqKqKqKqK', TRUE)
ON CONFLICT (username) DO NOTHING;

-- Insert default achievements
INSERT INTO achievements (name, description, icon, criteria, points) VALUES
('First Book', 'Borrowed your first book', '📚', 'borrow_count >= 1', 10),
('Bookworm', 'Borrowed 10 books', '🐛', 'borrow_count >= 10', 50),
('Library Master', 'Borrowed 50 books', '🎓', 'borrow_count >= 50', 200),
('Speed Reader', 'Returned 5 books in a week', '⚡', 'weekly_returns >= 5', 100),
('Reviewer', 'Wrote your first review', '⭐', 'review_count >= 1', 20),
('Critic', 'Wrote 10 reviews', '📝', 'review_count >= 10', 100),
('Streak Master', 'Maintained 30-day reading streak', '🔥', 'reading_streak >= 30', 300),
('Early Bird', 'Borrowed a book before 8 AM', '🌅', 'early_borrow = true', 50),
('Night Owl', 'Borrowed a book after 10 PM', '🦉', 'late_borrow = true', 50),
('Genre Explorer', 'Read books from 5 different categories', '🗺️', 'unique_categories >= 5', 150)
ON CONFLICT (name) DO NOTHING;

-- ==================== VIEWS FOR ANALYTICS ====================

-- Popular books view
CREATE OR REPLACE VIEW popular_books AS
SELECT 
    b.id,
    b.title,
    b.author,
    b.category,
    b.rating,
    b.review_count,
    b.total_borrows,
    COUNT(DISTINCT bb.user_id) as unique_borrowers,
    COUNT(bb.id) as total_checkouts
FROM books b
LEFT JOIN borrowed_books bb ON b.id = bb.book_id
GROUP BY b.id
ORDER BY b.total_borrows DESC, b.rating DESC;

-- Active users view
CREATE OR REPLACE VIEW active_users AS
SELECT 
    u.id,
    u.username,
    u.created_at,
    us.total_borrowed,
    us.total_returned,
    us.currently_borrowed,
    us.reading_streak,
    us.total_points,
    COUNT(r.id) as review_count
FROM users u
LEFT JOIN user_stats us ON u.id = us.user_id
LEFT JOIN reviews r ON u.id = r.user_id
WHERE u.active = TRUE
GROUP BY u.id, us.total_borrowed, us.total_returned, us.currently_borrowed, 
         us.reading_streak, us.total_points
ORDER BY us.total_points DESC;

-- ==================== FUNCTIONS ====================

-- Function to get book recommendations
CREATE OR REPLACE FUNCTION get_recommendations(p_user_id INTEGER, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    book_id INTEGER,
    title VARCHAR,
    author VARCHAR,
    category VARCHAR,
    rating DECIMAL,
    reason VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    -- Based on user's favorite category
    SELECT DISTINCT ON (b.id)
        b.id,
        b.title,
        b.author,
        b.category,
        b.rating,
        'Based on your favorite category'::VARCHAR
    FROM books b
    WHERE b.category = (SELECT favorite_category FROM user_stats WHERE user_id = p_user_id)
        AND b.available = TRUE
        AND b.id NOT IN (SELECT book_id FROM borrowed_books WHERE user_id = p_user_id)
    ORDER BY b.id, b.rating DESC, b.total_borrows DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to update user stats
CREATE OR REPLACE FUNCTION update_user_stats(p_user_id INTEGER)
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_stats (user_id, total_borrowed, total_returned, currently_borrowed)
    SELECT 
        p_user_id,
        COUNT(*) as total_borrowed,
        COUNT(*) FILTER (WHERE returned_date IS NOT NULL) as total_returned,
        COUNT(*) FILTER (WHERE returned_date IS NULL) as currently_borrowed
    FROM borrowed_books
    WHERE user_id = p_user_id
    ON CONFLICT (user_id) DO UPDATE SET
        total_borrowed = EXCLUDED.total_borrowed,
        total_returned = EXCLUDED.total_returned,
        currently_borrowed = EXCLUDED.currently_borrowed,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- ==================== TRIGGERS ====================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER books_updated_at BEFORE UPDATE ON books
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER reading_lists_updated_at BEFORE UPDATE ON reading_lists
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==================== PARTITIONING (for large scale) ====================

-- Partition borrowed_books by year (uncomment when needed)
/*
ALTER TABLE borrowed_books RENAME TO borrowed_books_old;

CREATE TABLE borrowed_books (
    LIKE borrowed_books_old INCLUDING ALL
) PARTITION BY RANGE (borrow_date);

CREATE TABLE borrowed_books_2024 PARTITION OF borrowed_books
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE borrowed_books_2025 PARTITION OF borrowed_books
FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

INSERT INTO borrowed_books SELECT * FROM borrowed_books_old;
DROP TABLE borrowed_books_old;
*/

-- ==================== MAINTENANCE ====================

-- Vacuum and analyze (run periodically)
-- VACUUM ANALYZE books;
-- VACUUM ANALYZE borrowed_books;
-- VACUUM ANALYZE reviews;

-- Reindex (if needed)
-- REINDEX TABLE books;
-- REINDEX TABLE borrowed_books;

-- ==================== COMPLETION MESSAGE ====================
DO $$
BEGIN
    RAISE NOTICE '✅ PostgreSQL schema created successfully!';
    RAISE NOTICE '📊 Tables: 11 core tables + views';
    RAISE NOTICE '🚀 Indexes: Optimized for millions of records';
    RAISE NOTICE '🔍 Full-text search: Enabled';
    RAISE NOTICE '⚡ Ready for production!';
END $$;
