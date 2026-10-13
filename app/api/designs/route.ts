import {getDb} from '../../../db';
import {designs,versions} from '../../../db/schema';
import {eq,asc} from 'drizzle-orm';
import {demos} from '../../../lib/demo';
import {getChatGPTUser} from '../../chatgpt-auth';
const json=(data:unknown,status=200)=>Response.json(data,{status});
export async function GET(){try{const db=getDb();const ds=await db.select().from(designs);const vs=await db.select().from(versions).orderBy(asc(versions.number));return json(ds.map(d=>({...d,versions:vs.filter(v=>v.designId===d.id)})).filter(d=>d.versions.length));}catch{return json({error:'Could not load the shared studio. Please retry.'},503);}}
export async function POST(req:Request){
 if(!await getChatGPTUser())return json({error:'Sign in to your workspace before uploading.'},401);
 if(req.headers.get('origin') && req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Invalid origin'},403);
 try{const b:any=await req.json();
 if(typeof b.html!=='string'||!b.html.trim()||b.html.length>750000)return json({error:'Upload an HTML file smaller than 750 KB.'},400);
 for(const key of ['name','author','role','notes','source'])if(typeof b[key]!=='string'||b[key].length>3000)return json({error:'Invalid upload details.'},400);
 if(!['Website','Dashboard','Web app'].includes(b.category)||!['Designer','Product manager','Developer'].includes(b.role))return json({error:'Invalid category or role.'},400);
 if(!b.author.trim()||!b.name.trim())return json({error:'Name and author are required.'},400);
 const db=getDb();let id=b.designId;const found=id?await db.select().from(designs).where(eq(designs.id,id)):[];
 const {env}=await import('cloudflare:workers');const statements:D1PreparedStatement[]=[];
 if(!found.length){const demo=demos.find(d=>d.id===id);if(id&&!demo)return json({error:'Design no longer exists.'},404);id=id||crypto.randomUUID();statements.push(env.DB!.prepare('INSERT OR IGNORE INTO designs (id,name,category,created_at) VALUES (?,?,?,?)').bind(id,b.name.trim(),b.category,new Date().toISOString()));if(demo)for(const z of demo.versions)statements.push(env.DB!.prepare('INSERT OR IGNORE INTO versions (id,design_id,number,html,author,role,notes,source,created_at,status) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(z.id,id,z.number,z.html,z.author,z.role,z.notes,z.source,z.createdAt,z.status));}
 // The whole upload is transactional. SQLite assigns numbers inside the write.
 statements.push(env.DB!.prepare('INSERT INTO versions (id,design_id,number,html,author,role,notes,source,created_at,status) SELECT ?,?,COALESCE(MAX(number),0)+1,?,?,?,?,?,?,? FROM versions WHERE design_id=?').bind(crypto.randomUUID(),id,b.html,b.author.trim(),b.role,b.notes,b.source,new Date().toISOString(),'In review',id));
 await env.DB!.batch(statements);
 return json({id},201);
 }catch(e){return json({error:'Upload failed. Your file has not been discarded; please retry.'},500);}
}
export async function PATCH(req:Request){
 if(!await getChatGPTUser())return json({error:'Sign in before updating the handoff status.'},401);
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Invalid origin'},403);
 try{const b:any=await req.json();if(!['In review','Ready for dev'].includes(b.status))return json({error:'Invalid status'},400);const result=await getDb().update(versions).set({status:b.status}).where(eq(versions.id,b.id)).returning();if(!result.length)return json({error:'Upload a version of this example to start your own handoff.'},404);return json({ok:true});}catch{return json({error:'Could not update status.'},500);}
}

