globalThis.WP = {};
for (const f of ['util','config','audio','game','physics','flow','ai']) require('../js/'+f+'.js');
const WP=globalThis.WP;
function run(seed, diff){
  const g=new WP.Game({home:0,away:2,diff:diff||'normal',quarterReal:90,seed,auto:true});
  let steps=0, maxSteps=60*60*40;
  while(g.phase!=='over' && steps++<maxSteps){ g.update(1/60); if(g.events.length>200) g.events.length=0; }
  return g;
}
for (const s of [1,2,3]) {
  const g=run(s);
  console.log('seed',s,'phase',g.phase,'Q',g.quarter,'score',g.teams[0].score+':'+g.teams[1].score,'so',g.so&&g.so.goals,
   'shots',g.teams.map(t=>t.stats.shots),'saves',g.teams.map(t=>t.stats.saves),'fouls',g.teams.map(t=>t.stats.fouls),'excl',g.teams.map(t=>t.stats.excl),'pens',g.teams.map(t=>t.stats.pens));
}
