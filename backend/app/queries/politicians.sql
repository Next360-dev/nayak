-- =============================================================================
-- POLITICIANS & REPRESENTATIVES QUERIES
-- Pure SQL queries for Telangana district hierarchy & MLA profiles
-- =============================================================================

-- name: fetch_districts
SELECT DISTINCT district_name 
FROM political_representatives 
WHERE district_name IS NOT NULL 
ORDER BY district_name;

-- name: fetch_constituencies
SELECT DISTINCT constituency_name 
FROM political_representatives 
WHERE constituency_name IS NOT NULL 
ORDER BY constituency_name;

-- name: fetch_politicians_base
SELECT id, name, role_type, party, district_name, constituency_name,
       mandal_corporation, contact_phone, email
FROM political_representatives
WHERE 1=1
