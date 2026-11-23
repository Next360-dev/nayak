-- Optional approved post image stored as a validated data URL (max 2 MB source file).
ALTER TABLE composed_posts ADD COLUMN IF NOT EXISTS image_data TEXT;
