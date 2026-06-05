import sqlite3

conn = sqlite3.connect("campusai.db")
cursor = conn.cursor()

existing_msg = {row[1] for row in cursor.execute("PRAGMA table_info(messages)")}
print(f"Messages columns found: {existing_msg}")

for col, defn in [
    ("thread_id",   "TEXT DEFAULT ''"),
    ("receiver_id", "INTEGER DEFAULT 0"),
    ("lf_item_id",  "INTEGER DEFAULT NULL"),
    ("is_read",     "INTEGER DEFAULT 0"),
]:
    if col not in existing_msg:
        cursor.execute(f"ALTER TABLE messages ADD COLUMN {col} {defn}")
        print(f"Added messages.{col}")
    else:
        print(f"messages.{col} already exists")

conn.commit()
conn.close()
print("Done! Migration complete.")
