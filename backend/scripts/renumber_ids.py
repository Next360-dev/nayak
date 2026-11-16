import sys
import os

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.core.database import get_connection

def renumber_all():
    tables_to_renumber = [
        ("news_sources", "news_sources_pkey", "public.news_sources_id_seq"),
        ("social_media_posts", "social_media_posts_pkey", "public.social_media_posts_id_seq"),
        ("new_articles", "new_articles_pkey", "public.new_articles_id_seq"),
    ]

    with get_connection() as conn:
        with conn.cursor() as cur:
            for table, pkey, seq in tables_to_renumber:
                print(f"--- Processing {table} ---")
                
                # Check current count & min/max
                cur.execute(f"SELECT COUNT(*), MIN(id), MAX(id) FROM {table};")
                count, min_id, max_id = cur.fetchone()
                print(f"Before: Total rows = {count}, Min ID = {min_id}, Max ID = {max_id}")
                
                if count == 0:
                    print(f"Skipping {table} (empty).")
                    continue
                
                temp_map = f"temp_{table}_map"
                cur.execute(f"DROP TABLE IF EXISTS {temp_map};")
                cur.execute(f"""
                    CREATE TEMP TABLE {temp_map} AS
                    SELECT id AS old_id, ROW_NUMBER() OVER (ORDER BY id ASC) AS new_id
                    FROM {table};
                """)
                
                print(f"Dropping PK constraint {pkey}...")
                cur.execute(f"ALTER TABLE {table} DROP CONSTRAINT {pkey};")
                
                print(f"Updating IDs to consecutive serial numbers 1 to {count}...")
                cur.execute(f"""
                    UPDATE {table} t
                    SET id = m.new_id
                    FROM {temp_map} m
                    WHERE t.id = m.old_id;
                """)
                
                print(f"Re-adding PK constraint {pkey}...")
                cur.execute(f"ALTER TABLE {table} ADD CONSTRAINT {pkey} PRIMARY KEY (id);")
                
                print(f"Resetting sequence {seq} to {count}...")
                cur.execute(f"SELECT setval('{seq}', {count}, true);")
                
                cur.execute(f"DROP TABLE IF EXISTS {temp_map};")
                
                # Verify
                cur.execute(f"SELECT COUNT(*), MIN(id), MAX(id) FROM {table};")
                v_count, v_min, v_max = cur.fetchone()
                print(f"After: Total rows = {v_count}, Min ID = {v_min}, Max ID = {v_max}")
                assert v_count == count, f"Row count mismatch in {table}!"
                assert v_min == 1, f"Min ID is not 1 in {table}!"
                assert v_max == count, f"Max ID does not match count in {table}!"
                print(f"[SUCCESS] {table} successfully renumbered: exactly 1 to {count} consecutively.\n")


        conn.commit()
        print("All database table IDs have been perfectly synchronized and committed!")

if __name__ == "__main__":
    renumber_all()
