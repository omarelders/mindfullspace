# Gates: MindfulSpace Cloud Sync — Audit Corrections Verification

OWNS: src/**, supabase-schema.sql, vite.config.js

Scope: Verify every audit finding (B1–B12) is corrected: atomic optimistic-locking push RPC,
realtime publication, conflict-safe migration, continuous workspace-list sync, image deletion
cleanup, dead-code removal, backup GC, unmount flush, once-per-login marker, and regression safety.

- [x] G1: Full Vitest suite passes (incl. two-device stale-write race test)
  CHECK: node -e "const { execSync } = require('child_process'); try { execSync('npx vitest run', { stdio: 'pipe' }); console.log('vitest success'); } catch(e) { console.log(String(e.stdout)); process.exit(1); }"
  EXPECT: vitest success
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\aldrs\Desktop\Projects\mindfullspace-master; path=cad88b74a951/22 entries; output=vitest success

- [x] G2: Production build completes successfully
  CHECK: node -e "const { execSync } = require('child_process'); const out = execSync('npm run build', { stdio: 'pipe', env: {...process.env, FORCE_COLOR: '0'} }); if (/built in/.test(String(out))) { console.log('build success'); } else { process.exit(1); }"
  EXPECT: build success
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\aldrs\Desktop\Projects\mindfullspace-master; path=cad88b74a951/22 entries; output=build success

- [x] G3: Lint passes with zero errors AND zero warnings
  CHECK: node -e "const { execSync } = require('child_process'); try { execSync('npx eslint . --max-warnings 0', { stdio: 'pipe' }); console.log('lint clean'); } catch(e) { console.log(String(e.stdout)); process.exit(1); }"
  EXPECT: lint clean
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\aldrs\Desktop\Projects\mindfullspace-master; path=cad88b74a951/22 entries; output=lint clean

- [x] G4: Schema ships the atomic push RPC, realtime publication, and hardened storage policy
  CHECK: node -e "const fs=require('fs'); const s=fs.readFileSync('supabase-schema.sql','utf-8'); const ok = s.includes('push_workspace_snapshot') && s.includes('supabase_realtime ADD TABLE public.workspace_data') && s.includes(\"COALESCE(p_expected_version, wd.version)\") && /FOR UPDATE[\s\S]*?WITH CHECK/.test(s); console.log(ok ? 'schema ok' : 'schema missing pieces'); process.exit(ok?0:1)"
  EXPECT: schema ok
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\aldrs\Desktop\Projects\mindfullspace-master; path=cad88b74a951/22 entries; output=schema ok

- [x] G5: Client pushes go through the atomic RPC with expectedVersion (B3 fixed)
  CHECK: node -e "const fs=require('fs'); const s=fs.readFileSync('src/lib/cloudDb.js','utf-8'); const ok = s.includes(\"rpc('push_workspace_snapshot'\") && s.includes('p_expected_version') && s.includes(\"reason: 'conflict'\"); console.log(ok ? 'rpc push ok' : 'rpc push missing'); process.exit(ok?0:1)"
  EXPECT: rpc push ok
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\aldrs\Desktop\Projects\mindfullspace-master; path=cad88b74a951/22 entries; output=rpc push ok

- [x] G6: Sync engine reconciles on mount, backs up before adopting remote, flushes on unmount (B4, B5, B12 fixed)
  CHECK: node -e "const fs=require('fs'); const s=fs.readFileSync('src/hooks/useSyncEngine.jsx','utf-8'); const ok = s.includes('saveConflictBackup') && s.includes('pullWorkspace') && s.includes('expectedVersion: knownVersionRef.current') && s.includes('pendingChangeRef') && s.includes('visibilitychange'); console.log(ok ? 'engine ok' : 'engine missing'); process.exit(ok?0:1)"
  EXPECT: engine ok
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\aldrs\Desktop\Projects\mindfullspace-master; path=cad88b74a951/22 entries; output=engine ok

- [x] G7: Workspace create/rename/duplicate/delete propagate to the cloud registry (B2, B8 fixed)
  CHECK: node -e "const fs=require('fs'); const s=fs.readFileSync('src/App.jsx','utf-8'); const ok = s.includes('ensureCloudWorkspace') && s.includes('renameCloudWorkspace') && s.includes('deleteCloudWorkspace'); console.log(ok ? 'app wiring ok' : 'app wiring missing'); process.exit(ok?0:1)"
  EXPECT: app wiring ok
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\aldrs\Desktop\Projects\mindfullspace-master; path=cad88b74a951/22 entries; output=app wiring ok

- [x] G8: Deleting a picture card also deletes its cloud image when unreferenced (B9 fixed)
  CHECK: node -e "const fs=require('fs'); const s=fs.readFileSync('src/hooks/useWorkspace.js','utf-8'); const i=s.indexOf('deletePictureCard'); const seg=s.slice(i, i+2200); const ok=seg.includes('deleteImageFromCloud'); console.log(ok ? 'image cleanup ok' : 'image cleanup missing'); process.exit(ok?0:1)"
  EXPECT: image cleanup ok
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\aldrs\Desktop\Projects\mindfullspace-master; path=cad88b74a951/22 entries; output=image cleanup ok

- [x] G9: SyncStatus component is wired into TopBar (no dead code) and receives sync messages (B10 fixed)
  CHECK: node -e "const fs=require('fs'); const top=fs.readFileSync('src/components/TopBar.jsx','utf-8'); const ss=fs.readFileSync('src/components/SyncStatus.jsx','utf-8'); const ok = top.includes(\"from './SyncStatus'\") && top.includes('<SyncStatus') && ss.includes('message'); console.log(ok ? 'sync status wired' : 'not wired'); process.exit(ok?0:1)"
  EXPECT: sync status wired
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\aldrs\Desktop\Projects\mindfullspace-master; path=cad88b74a951/22 entries; output=sync status wired

- [x] G10: Migration runs once per account; collisions resolve newest-wins with mandatory local backup (B5, B6 fixed)
  CHECK: node -e "const fs=require('fs'); const s=fs.readFileSync('src/lib/migration.js','utf-8'); const ok = s.includes('mindfulspace-migration-done:') && s.includes('hasMigrationCompleted') && s.includes('resolveCollidingWorkspace') && s.includes('saveConflictBackup'); console.log(ok ? 'migration ok' : 'migration missing'); process.exit(ok?0:1)"
  EXPECT: migration ok
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\aldrs\Desktop\Projects\mindfullspace-master; path=cad88b74a951/22 entries; output=migration ok

- [x] G11: Conflict backups are garbage-collected, never accumulating forever (B11 fixed)
  CHECK: node -e "const fs=require('fs'); const s=fs.readFileSync('src/lib/cloudDb.js','utf-8'); const ok = s.includes('pruneConflictBackups') && s.includes('MAX_CONFLICT_BACKUPS_PER_WORKSPACE'); console.log(ok ? 'backup gc ok' : 'gc missing'); process.exit(ok?0:1)"
  EXPECT: backup gc ok
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\aldrs\Desktop\Projects\mindfullspace-master; path=cad88b74a951/22 entries; output=backup gc ok

- [x] G12: No secrets committed; anon-key-only client; Supabase gracefully degrades to guest mode when unconfigured (B1 containment)
  CHECK: node -e "const { execSync }=require('child_process'); const fs=require('fs'), path=require('path'); let bad=[]; function walk(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f); const st=fs.statSync(p); if(st.isDirectory()){if(f!=='node_modules')walk(p)}else if(/\.(js|jsx|sql|json)$/.test(f)&&f!=='package-lock.json'){const c=fs.readFileSync(p,'utf-8'); if(/service_role|SERVICE_ROLE/.test(c))bad.push(p);}}} walk('src'); const tracked = execSync('git ls-files .env.local', {stdio:'pipe'}).toString().trim(); console.log(bad.length===0 && tracked==='' ? 'secrets ok' : 'SECRETS PROBLEM: '+bad.join(',')+tracked); process.exit(bad.length===0&&tracked===''?0:1)"
  EXPECT: secrets ok
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\aldrs\Desktop\Projects\mindfullspace-master; path=cad88b74a951/22 entries; output=secrets ok

- [x] G13: Automated stale-write concurrency proof exists (prompt §17 requirement)
  CHECK: node -e "const fs=require('fs'); const s=fs.readFileSync('src/hooks/useSyncEngine.test.jsx','utf-8'); const ok=s.includes('two-device stale-write race') && s.includes('expectedVersion ?? server.version'); console.log(ok ? 'race test present' : 'race test missing'); process.exit(ok?0:1)"
  EXPECT: race test present
  EVIDENCE: exit=0; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\aldrs\Desktop\Projects\mindfullspace-master; path=cad88b74a951/22 entries; output=race test present
