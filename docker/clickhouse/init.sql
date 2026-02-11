-- ══════════════════════════════════════════════
--  Sample ClickHouse data for development
-- ══════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS sample;

-- Sample: Web analytics events
CREATE TABLE IF NOT EXISTS sample.page_views (
    event_date   Date,
    event_time   DateTime,
    user_id      UInt64,
    session_id   String,
    page_url     String,
    referrer     String,
    country      LowCardinality(String),
    device_type  LowCardinality(String),
    duration_sec UInt32
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, user_id, event_time);

-- Sample: Sales data
CREATE TABLE IF NOT EXISTS sample.sales (
    sale_date    Date,
    order_id     UInt64,
    product_name String,
    category     LowCardinality(String),
    region       LowCardinality(String),
    quantity     UInt32,
    unit_price   Float64,
    total_amount Float64
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(sale_date)
ORDER BY (sale_date, category, region);

-- Insert sample page views
INSERT INTO sample.page_views VALUES
    ('2024-01-15', '2024-01-15 10:30:00', 1001, 'sess_001', '/home', 'google.com', 'US', 'desktop', 45),
    ('2024-01-15', '2024-01-15 10:31:00', 1001, 'sess_001', '/products', '/home', 'US', 'desktop', 120),
    ('2024-01-15', '2024-01-15 11:00:00', 1002, 'sess_002', '/home', 'twitter.com', 'UK', 'mobile', 30),
    ('2024-01-15', '2024-01-15 14:00:00', 1003, 'sess_003', '/pricing', 'google.com', 'DE', 'desktop', 90),
    ('2024-01-16', '2024-01-16 09:00:00', 1001, 'sess_004', '/home', '', 'US', 'tablet', 60),
    ('2024-01-16', '2024-01-16 09:05:00', 1004, 'sess_005', '/docs', 'github.com', 'JP', 'desktop', 200);

-- Insert sample sales
INSERT INTO sample.sales VALUES
    ('2024-01-10', 1, 'Widget A', 'Electronics', 'North', 5, 29.99, 149.95),
    ('2024-01-10', 2, 'Widget B', 'Electronics', 'South', 3, 49.99, 149.97),
    ('2024-01-11', 3, 'Gadget X', 'Accessories', 'North', 10, 9.99, 99.90),
    ('2024-01-11', 4, 'Widget A', 'Electronics', 'East', 2, 29.99, 59.98),
    ('2024-01-12', 5, 'Service Plan', 'Services', 'West', 1, 199.00, 199.00),
    ('2024-01-12', 6, 'Gadget Y', 'Accessories', 'North', 8, 14.99, 119.92),
    ('2024-01-13', 7, 'Widget C', 'Electronics', 'South', 4, 79.99, 319.96),
    ('2024-01-14', 8, 'Widget A', 'Electronics', 'West', 6, 29.99, 179.94);
