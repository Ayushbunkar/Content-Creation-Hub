import { PipelineManager } from '../server/pipeline';
import { runQuery } from '../server/db';
import path from 'path';

async function main() {
  const projectId = 'doc_1794936770219';
  const outPath = path.join('output', projectId + '_sample.mp4');
  console.log(`[Test B] Starting Remotion render for ${projectId} to ${outPath}...`);
  await (PipelineManager as any).renderVideo(projectId, outPath, true);
  console.log(`[Test B] Remotion render completed successfully!`);
  await runQuery('UPDATE projects SET video_output = ? WHERE id = ?', [outPath, projectId]);
  console.log(`[Test B] Updated database video_output to ${outPath}`);
}

main().catch((err) => {
  console.error('[Test B] Error rendering:', err);
  process.exit(1);
});
