import sqlite3

conn = sqlite3.connect('storage/database/studio.db')
c = conn.cursor()
c.execute("SELECT id, title, source_url, status, progress FROM clipper_projects WHERE id LIKE '%4539604%'")
row = c.fetchone()
print("Project Info:", row)
