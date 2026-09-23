const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const server = http.createServer((req,res)=>{
  let p = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const file = path.join(__dirname,p);
  if(!file.startsWith(__dirname)) return res.writeHead(403).end();
  fs.readFile(file,(err,data)=>{
    if(err) return res.writeHead(404).end("Not found");
    const ext=path.extname(file);
    const type={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8"}[ext]||"application/octet-stream";
    res.writeHead(200,{"Content-Type":type,"Cache-Control":"no-store"}).end(data);
  });
});
const wss = new WebSocket.Server({server});
const games = new Map();
const quests = [
 {title:"Resource Hunt",icon:"🌲"},{title:"Zombie Attack",icon:"🧟"},{title:"Diamond Hunt",icon:"💎"},{title:"Build a Crafting Table",icon:"🪵"},{title:"Crafting – Diamond Sword",icon:"⚔️"},{title:"Creeper Explosion",icon:"💥"},{title:"Survive the Night",icon:"🏰"},{title:"Spider Cave",icon:"🕷️"},{title:"Nether Portal",icon:"🔥"},{title:"The Final Teamwork",icon:"🤝"},{title:"Diamond Chest",icon:"🎁"}
];
function newTeam(){return {q:0,done:false,approved:false,timerStart:null,codeFragment:"",completed:[]}}
function newGame(){return {teams:{creeper:newTeam(),diamond:newTeam()},sharedCode:"ENDERDRAGON"}}
function startQuest(t,q){t.q=q;t.done=false;t.approved=false;t.timerStart=q===5?Date.now()+7000:null;t.codeFragment=q===9?(t._fragment||""):""}
function broadcast(code){const game=games.get(code);if(!game)return;const msg=JSON.stringify({type:"state",game,quests});for(const c of wss.clients)if(c.readyState===1&&c.gameCode===code)c.send(msg)}
function safeCode(s){return String(s||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,12)}
function setupFragments(game){game.teams.creeper._fragment="ENDER";game.teams.diamond._fragment="DRAGON";game.teams.creeper.codeFragment="";game.teams.diamond.codeFragment=""}
wss.on("connection",ws=>{
 ws.on("message",raw=>{
  let m;try{m=JSON.parse(raw)}catch{return}
  const code=safeCode(m.code);if(!code)return;
  if(m.type==="join"){
   if(!games.has(code)){const g=newGame();setupFragments(g);games.set(code,g)}
   ws.gameCode=code;ws.role=m.role;ws.send(JSON.stringify({type:"joined",code,role:m.role,game:games.get(code),quests}));broadcast(code);return;
  }
  const game=games.get(code);if(!game)return;
  if(m.type==="team_done"&&(m.role==="creeper"||m.role==="diamond")){game.teams[m.role].done=true;broadcast(code);return}
  if(m.type==="crafting_done"&&(m.role==="creeper"||m.role==="diamond")){const t=game.teams[m.role];if(t.q===3)t.done=true;broadcast(code);return}
  if(m.type==="auto_done"&&(m.role==="creeper"||m.role==="diamond")){const t=game.teams[m.role];if(t.q===4)t.done=true;broadcast(code);return}
  if(m.type==="timer_done"&&(m.role==="creeper"||m.role==="diamond")){const t=game.teams[m.role];if(t.q===5)t.done=true;broadcast(code);return}
  if(m.type==="portal_done"&&(m.role==="creeper"||m.role==="diamond")){const t=game.teams[m.role];if(t.q===8)t.done=true;broadcast(code);return}
  if(m.type==="teamwork_done"&&(m.role==="creeper"||m.role==="diamond")){const t=game.teams[m.role];if(t.q===9)t.done=true;broadcast(code);return}
  if(m.type==="approve"&&m.role==="gm"&&(m.team==="creeper"||m.team==="diamond")){
   const t=game.teams[m.team];
   if(t.done){
    if(!Array.isArray(t.completed))t.completed=[];
    if(!t.completed.includes(t.q))t.completed.push(t.q);
    if(t.q<quests.length-1)startQuest(t,t.q+1);else t.approved=true;
    broadcast(code);
   }
   return;
  }
  if(m.type==="jump_to_quest"&&m.role==="gm"){
   const q=Number(m.quest);
   if(Number.isInteger(q)&&q>=0&&q<quests.length){
    for(const t of [game.teams.creeper,game.teams.diamond]){
     t.completed=(t.completed||[]).filter(doneQuest=>doneQuest!==q);
     startQuest(t,q);
    }
    broadcast(code);
   }
   return;
  }
  if(m.type==="reset"&&m.role==="gm"){const g=newGame();setupFragments(g);games.set(code,g);broadcast(code);return}
 });
});
server.listen(PORT,()=>console.log(`Minecraft Quest running on port ${PORT}`));
