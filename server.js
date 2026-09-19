const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const server = http.createServer((req,res)=>{
  let p = req.url === "/" ? "/index.html" : req.url;
  p = p.split("?")[0];
  const file = path.join(__dirname,p);
  if(!file.startsWith(__dirname)) return res.writeHead(403).end();
  fs.readFile(file,(err,data)=>{
    if(err) return res.writeHead(404).end("Not found");
    const ext=path.extname(file);
    const type={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8"}[ext]||"application/octet-stream";
    res.writeHead(200,{"Content-Type":type}).end(data);
  });
});
const wss = new WebSocket.Server({server});
const games = new Map();

const quests = [
 {title:"Resource Hunt", icon:"🌲"},
 {title:"Zombie Attack", icon:"🧟"},
 {title:"Diamond Hunt", icon:"💎"},
 {title:"Crafting – Diamond Sword", icon:"⚔️"},
 {title:"Creeper Explosion", icon:"💥"},
 {title:"Survive the Night", icon:"🏰"},
 {title:"Spider Cave", icon:"🕷️"},
 {title:"Nether Portal", icon:"🔥"},
 {title:"The Final Teamwork", icon:"🤝"},
 {title:"Diamond Chest", icon:"🎁"}
];

function newGame(){
 return {
   teams:{
     creeper:{q:0,done:false,approved:false},
     diamond:{q:0,done:false,approved:false}
   }
 };
}
function broadcast(code){
 const game=games.get(code); if(!game) return;
 const msg=JSON.stringify({type:"state",game});
 for(const c of wss.clients) if(c.readyState===1 && c.gameCode===code) c.send(msg);
}
function safeCode(s){ return String(s||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,12); }

wss.on("connection",ws=>{
 ws.on("message",raw=>{
   let m; try{m=JSON.parse(raw)}catch{return}
   const code=safeCode(m.code);
   if(!code) return;
   if(m.type==="join"){
     if(!games.has(code)) games.set(code,newGame());
     ws.gameCode=code; ws.role=m.role;
     ws.send(JSON.stringify({type:"joined",code,role:m.role,game:games.get(code),quests}));
     broadcast(code); return;
   }
   const game=games.get(code); if(!game) return;
   if(m.type==="team_done" && (m.role==="creeper"||m.role==="diamond")){
     game.teams[m.role].done=true; broadcast(code); return;
   }
   if(m.type==="approve" && m.role==="gm" && (m.team==="creeper"||m.team==="diamond")){
     const t=game.teams[m.team];
     if(t.done) t.approved=true;
     broadcast(code); return;
   }
   if(m.type==="unlock_both" && m.role==="gm"){
     const c=game.teams.creeper, d=game.teams.diamond;
     if(c.q===d.q && c.approved && d.approved && c.q<quests.length-1){
       c.q++; d.q++;
       c.done=c.approved=d.done=d.approved=false;
       broadcast(code);
     }
   }
   if(m.type==="reset" && m.role==="gm"){ games.set(code,newGame()); broadcast(code); }
 });
});
server.listen(PORT,()=>console.log(`Minecraft Quest running on port ${PORT}`));
