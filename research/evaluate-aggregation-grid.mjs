// Re-evaluate aggregation from the archived dev-only scores; no holdout access.
import fs from 'node:fs';
for (const name of ['multilingual-e5-small','ko-sroberta-multitask','paraphrase-multilingual-MiniLM-L12-v2']) {
 const data=JSON.parse(fs.readFileSync(`research/results/${name}-intent-dev.json`));
 for (const other of ['top2','centroid']) for (const alpha of [0.25,0.5,0.75]) {
  let correct=0;
  for (const row of data.rows) {
   const alternate=new Map(row.methods[other].map(r=>[r.id,r.score]));
   const ranked=row.methods.max.map(r=>({id:r.id,score:alpha*r.score+(1-alpha)*alternate.get(r.id)})).sort((a,b)=>b.score-a.score);
   if(row.accept.includes(ranked[0].id)) correct++;
  }
  console.log(`${name}: ${alpha} max + ${1-alpha} ${other}: ${correct}/${data.count}`);
 }
}
