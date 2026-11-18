import sqlite3 from 'sqlite3';
import path from 'path';

const db = new sqlite3.Database(path.join(process.cwd(), 'storage', 'database', 'studio.db'));
db.get('SELECT * FROM projects WHERE id = ?', ['doc_1794400642997'], (err, row: any) => {
  if (err) {
    console.error(err);
  } else if (!row) {
    console.log('Project not found');
  } else {
    console.log('ID:', row.id);
    console.log('Title:', row.title);
    console.log('Duration:', row.duration);
    console.log('Language:', row.language);
    console.log('Voice:', row.voice);
    console.log('Aspect Ratio:', row.aspect_ratio);
    console.log('Resolution:', row.resolution);
    console.log('FPS:', row.fps);
    console.log('Current Stage:', row.current_stage);
    console.log('Progress:', row.progress);
    console.log('Error:', row.error_message);
    console.log('Video Output:', row.video_output);
    console.log('Narration File:', row.narration_file);
    console.log('Subtitles File:', row.subtitles_file);
    console.log('Scene Data Length:', (row.scene_data || '').length);
    console.log('Script Preview:', (row.script || '').slice(0, 300));
    console.log('Timeline Length:', (row.timeline || '').length);
    console.log('Assets Manifest Length:', (row.asset_manifest || '').length);
  }
  db.close();
});
