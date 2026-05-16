import sqlite3

conn = sqlite3.connect("campusai.db")

cursor = conn.cursor()

cursor.execute("SELECT * FROM users")

rows = cursor.fetchall()

print(rows)

conn.close()