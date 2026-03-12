// APPLE ARCHER — Enhanced Interactive Version
(function(){
'use strict';
const canvas=document.getElementById('gameCanvas'),ctx=canvas.getContext('2d');
const scoreEl=document.getElementById('score'),highscoreEl=document.getElementById('highscore');
const windEl=document.getElementById('wind'),livesEl=document.getElementById('lives');
const comboEl=document.getElementById('combo'),comboDisplay=document.getElementById('combo-display');
const distanceText=document.getElementById('distance-text');
const gameOverOverlay=document.getElementById('game-over-overlay');
const gameOverScore=document.getElementById('game-over-score');
const gameOverBest=document.getElementById('game-over-best');
const gameOverCombo=document.getElementById('game-over-combo');
const gameOverLevel=document.getElementById('game-over-level');
const gameOverAccuracy=document.getElementById('game-over-accuracy');
const gameOverTitle=document.getElementById('game-over-title');
const restartBtn=document.getElementById('restart-btn');
const startOverlay=document.getElementById('start-overlay');
const startBtn=document.getElementById('start-btn');

const W=1100,H=600,GROUND_Y=H-70,GRAVITY=480,ARROW_SPEED=620;
const INITIAL_DISTANCE=280,DISTANCE_STEP=42,MAX_DISTANCE=W-200,ARCHER_X=80,MAX_LIVES=3;
const SHOT_TIME_BASE=8; // seconds per shot at level 1

let score=0,highScore=parseInt(localStorage.getItem('appleArcherHigh')||'0',10);
let distance=INITIAL_DISTANCE,wind=0,state='START';
let arrow=null,aimAngle=-Math.PI/4,bowDraw=0,mouseDown=false,mouseX=0,mouseY=0;
let particles=[],floatingTexts=[],trailParticles=[];
let screenShake=0,hitFlash=0,lastTime=0;
let lives=MAX_LIVES,combo=0,maxCombo=0,level=1;
let targetSwayAngle=0,targetSwaySpeed=0;
let slowMo=1,slowMoTimer=0,newHighScoreFlag=false;
let missArrows=[],levelUpTimer=0,totalShots=0,totalHits=0;
let shotTimer=SHOT_TIME_BASE,shotTimerActive=false;
let birds=[],bonusApple=null,bonusAppleTimer=0;
let powerUp=null,powerUpTimer=0;
let activePower=null,activePowerTime=0;
let challengeRound=false,challengeType='';
let dayPhase=0; // 0=day, cycles through for color changes
let manWalkOffset=0,manWalkDir=1,manWalkSpeed=0;
let appleRadius=9;

const grassBlades=[];
for(let gx=10;gx<W;gx+=35) grassBlades.push({x:gx,h1:6+Math.random()*8,h2:(6+Math.random()*8)*0.8});

// Audio
const audioCtx=new(window.AudioContext||window.webkitAudioContext)();
function playTone(f,d,t,v){
    const g=audioCtx.createGain(),o=audioCtx.createOscillator();
    o.type=t||'triangle';o.frequency.value=f;
    g.gain.setValueAtTime(v||0.15,audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+d);
    o.connect(g).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+d);
}
function sfxShoot(){playTone(220,0.15,'sawtooth',0.10);playTone(330,0.08,'triangle',0.06);}
function sfxApple(p){p=p||1;playTone(880*p,0.12,'sine',0.16);playTone(1100*p,0.18,'sine',0.10);setTimeout(()=>playTone(1320*p,0.22,'sine',0.08),80);}
function sfxPerfect(){playTone(1200,0.08,'sine',0.15);playTone(1500,0.10,'sine',0.12);setTimeout(()=>playTone(1800,0.15,'sine',0.10),60);setTimeout(()=>playTone(2200,0.20,'sine',0.08),120);}
function sfxCombo(l){const f=600+l*80;playTone(f,0.1,'sine',0.10);playTone(f*1.25,0.12,'sine',0.08);}
function sfxMiss(){playTone(180,0.25,'triangle',0.10);playTone(140,0.30,'sawtooth',0.06);}
function sfxGameOver(){playTone(220,0.4,'sawtooth',0.16);setTimeout(()=>playTone(165,0.5,'sawtooth',0.13),200);setTimeout(()=>playTone(110,0.6,'sawtooth',0.10),450);}
function sfxLevelUp(){playTone(523,0.12,'sine',0.12);setTimeout(()=>playTone(659,0.12,'sine',0.12),100);setTimeout(()=>playTone(784,0.12,'sine',0.12),200);setTimeout(()=>playTone(1047,0.20,'sine',0.15),300);}
function sfxLifeLost(){playTone(300,0.15,'sawtooth',0.12);playTone(200,0.25,'sawtooth',0.10);}
function sfxPowerUp(){playTone(800,0.1,'sine',0.12);playTone(1000,0.1,'sine',0.10);setTimeout(()=>playTone(1200,0.15,'sine',0.12),100);}
function sfxBonus(){playTone(1400,0.1,'sine',0.14);setTimeout(()=>playTone(1700,0.12,'sine',0.11),80);setTimeout(()=>playTone(2000,0.15,'sine',0.09),160);}
function sfxBirdHit(){playTone(150,0.2,'sawtooth',0.08);playTone(120,0.15,'square',0.06);}
function sfxTimeTick(){playTone(900,0.05,'sine',0.08);}
function sfxChallenge(){playTone(440,0.15,'square',0.10);setTimeout(()=>playTone(550,0.15,'square',0.10),150);setTimeout(()=>playTone(660,0.2,'square',0.12),300);}

function resize(){
    const ratio=W/H;let cw=Math.min(window.innerWidth*0.95,W),ch=cw/ratio;
    if(ch>window.innerHeight*0.8){ch=window.innerHeight*0.8;cw=ch*ratio;}
    canvas.style.width=cw+'px';canvas.style.height=ch+'px';canvas.width=W;canvas.height=H;
}
window.addEventListener('resize',resize);resize();

function rand(a,b){return a+Math.random()*(b-a);}
function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
function distFn(x1,y1,x2,y2){return Math.sqrt((x2-x1)**2+(y2-y1)**2);}
function canvasCoords(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*(W/r.width),y:(e.clientY-r.top)*(H/r.height)};}
function targetX(){return ARCHER_X+distance;}
function targetSwayOffset(){
    if(level<3&&!challengeRound) return manWalkOffset;
    const amp=Math.min(2+(level-3)*1.8,18);
    return Math.sin(targetSwayAngle)*amp+manWalkOffset;
}
function randomWind(){
    const maxW=25+score*5+(challengeType==='wind'?80:0);
    wind=rand(-maxW,maxW);
    windEl.textContent=(wind>0?'→':'←')+' '+Math.abs(wind).toFixed(0);
}

// Floating text
function spawnFloatingText(x,y,text,color,size){
    floatingTexts.push({x,y,text,color,size:size||22,life:1.2,maxLife:1.2,vy:-60});
}
function updateFloatingTexts(dt){
    for(let i=floatingTexts.length-1;i>=0;i--){
        const f=floatingTexts[i];f.y+=f.vy*dt;f.vy*=0.97;f.life-=dt;
        if(f.life<=0)floatingTexts.splice(i,1);
    }
}
function drawFloatingTexts(){
    for(const f of floatingTexts){
        const a=clamp(f.life/(f.maxLife*0.4),0,1),s=1+(1-f.life/f.maxLife)*0.3;
        ctx.save();ctx.translate(f.x,f.y);ctx.scale(s,s);ctx.globalAlpha=a;
        ctx.font=`800 ${f.size}px Outfit,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fillText(f.text,2,2);
        ctx.fillStyle=f.color;ctx.fillText(f.text,0,0);
        ctx.globalAlpha=1;ctx.restore();
    }
}

// Particles
function spawnParticles(x,y,color,count,sp){
    sp=sp||1;for(let i=0;i<count;i++)
    particles.push({x,y,vx:rand(-180*sp,180*sp),vy:rand(-280*sp,-40),r:rand(2,6),color,life:rand(0.4,1.0),maxLife:1.0});
}
function spawnStarBurst(x,y,count){
    const colors=['#FFD700','#FFA000','#FFEB3B','#FFF176','#FF6F00'];
    for(let i=0;i<count;i++){const a=(i/count)*Math.PI*2,sp=rand(120,280);
    particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-50,r:rand(2,5),color:colors[Math.floor(Math.random()*colors.length)],life:rand(0.6,1.2),maxLife:1.2});}
}
function updateParticles(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=350*dt;p.life-=dt;if(p.life<=0)particles.splice(i,1);}}
function drawParticles(){for(const p of particles){ctx.globalAlpha=clamp(p.life/p.maxLife,0,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
function updateTrail(dt){for(let i=trailParticles.length-1;i>=0;i--){trailParticles[i].life-=dt;if(trailParticles[i].life<=0)trailParticles.splice(i,1);}}
function drawTrail(){for(const t of trailParticles){ctx.globalAlpha=clamp(t.life/t.maxLife,0,0.5);ctx.fillStyle=t.color;ctx.beginPath();ctx.arc(t.x,t.y,t.r,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}

// === BIRDS ===
function spawnBird(){
    if(level<2)return;
    const fromLeft=Math.random()>0.5;
    birds.push({
        x:fromLeft?-40:W+40, y:rand(80,GROUND_Y-150),
        vx:fromLeft?rand(80,160):-rand(80,160), vy:rand(-20,20),
        wingPhase:0, size:rand(0.7,1.2)
    });
}
function updateBirds(dt){
    for(let i=birds.length-1;i>=0;i--){
        const b=birds[i];b.x+=b.vx*dt;b.y+=b.vy*dt+Math.sin(b.wingPhase)*0.3;
        b.wingPhase+=6*dt;
        if(b.x<-80||b.x>W+80)birds.splice(i,1);
    }
}
function drawBirds(){
    for(const b of birds){
        ctx.save();ctx.translate(b.x,b.y);ctx.scale(b.size,b.size);
        if(b.vx<0)ctx.scale(-1,1);
        const wingY=Math.sin(b.wingPhase)*8;
        ctx.fillStyle='#333';
        ctx.beginPath();ctx.ellipse(0,0,12,5,0,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#333';ctx.lineWidth=2.5;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(-5,-2);ctx.quadraticCurveTo(-12,-10+wingY,-18,-5+wingY);ctx.stroke();
        ctx.beginPath();ctx.moveTo(5,-2);ctx.quadraticCurveTo(12,-10+wingY,18,-5+wingY);ctx.stroke();
        ctx.fillStyle='#FF9800';ctx.beginPath();ctx.moveTo(12,0);ctx.lineTo(18,-2);ctx.lineTo(18,2);ctx.closePath();ctx.fill();
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(8,-2,2,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#000';ctx.beginPath();ctx.arc(8,-2,1,0,Math.PI*2);ctx.fill();
        ctx.restore();
    }
}

// === BONUS GOLDEN APPLE ===
function trySpawnBonusApple(){
    if(bonusApple||Math.random()>0.25||level<2)return;
    bonusApple={x:rand(W*0.3,W*0.8),y:rand(100,GROUND_Y-120),life:3.5,maxLife:3.5};
}
function updateBonusApple(dt){
    if(!bonusApple)return;
    bonusApple.life-=dt;bonusApple.y+=Math.sin(bonusApple.life*4)*0.3;
    if(bonusApple.life<=0){bonusApple=null;}
}
function drawBonusApple(){
    if(!bonusApple)return;
    const a=clamp(bonusApple.life/0.5,0,1);
    const pulse=1+Math.sin(bonusApple.life*8)*0.08;
    ctx.save();ctx.globalAlpha=a;ctx.translate(bonusApple.x,bonusApple.y);ctx.scale(pulse,pulse);
    // Glow
    ctx.shadowColor='#FFD700';ctx.shadowBlur=15;
    ctx.fillStyle='#FFD700';ctx.beginPath();ctx.arc(0,0,10,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
    ctx.fillStyle='rgba(255,255,255,0.4)';ctx.beginPath();ctx.arc(-3,-3,4,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#B8860B';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(1,-14);ctx.stroke();
    ctx.fillStyle='#66BB6A';ctx.beginPath();ctx.ellipse(4,-13,4,2,0.4,0,Math.PI*2);ctx.fill();
    // Star sparkle
    ctx.fillStyle='#fff';const st=Date.now()*0.005;
    for(let i=0;i<4;i++){const sa=(st+i*Math.PI/2);ctx.beginPath();ctx.arc(Math.cos(sa)*14,Math.sin(sa)*14,1.5,0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=1;ctx.restore();
}

// === POWER-UPS ===
const POWER_TYPES=['freeze','extralife','doublepoints','bigapple'];
const POWER_COLORS={'freeze':'#00BCD4','extralife':'#E91E63','doublepoints':'#FF9800','bigapple':'#8BC34A'};
const POWER_ICONS={'freeze':'❄️','extralife':'💖','doublepoints':'x2','bigapple':'🍎'};
const POWER_DUR={'freeze':8,'extralife':0,'doublepoints':10,'bigapple':8};

function trySpawnPowerUp(){
    if(powerUp||activePower||Math.random()>0.2||level<3)return;
    const t=POWER_TYPES[Math.floor(Math.random()*POWER_TYPES.length)];
    powerUp={type:t,x:rand(W*0.25,W*0.75),y:-30,vy:40,life:6};
}
function updatePowerUp(dt){
    if(!powerUp)return;
    powerUp.y+=powerUp.vy*dt;powerUp.life-=dt;
    if(powerUp.y>GROUND_Y-10||powerUp.life<=0){powerUp=null;}
}
function drawPowerUp(){
    if(!powerUp)return;
    const pulse=1+Math.sin(Date.now()*0.006)*0.1;
    ctx.save();ctx.translate(powerUp.x,powerUp.y);ctx.scale(pulse,pulse);
    ctx.shadowColor=POWER_COLORS[powerUp.type];ctx.shadowBlur=12;
    ctx.fillStyle=POWER_COLORS[powerUp.type];
    ctx.beginPath();ctx.arc(0,0,14,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
    ctx.fillStyle='#fff';ctx.font='700 12px Outfit,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(POWER_ICONS[powerUp.type],0,1);
    ctx.restore();
}
function activatePowerUp(type){
    sfxPowerUp();spawnStarBurst(powerUp.x,powerUp.y,16);
    spawnFloatingText(powerUp.x,powerUp.y-20,POWER_ICONS[type]+' '+type.toUpperCase()+'!',POWER_COLORS[type],20);
    if(type==='extralife'){lives=Math.min(lives+1,MAX_LIVES+1);updateLivesDisplay();powerUp=null;return;}
    activePower=type;activePowerTime=POWER_DUR[type];
    if(type==='freeze'){targetSwaySpeed=0;manWalkSpeed=0;}
    if(type==='bigapple'){appleRadius=16;}
    powerUp=null;
}
function updateActivePower(dt){
    if(!activePower)return;
    activePowerTime-=dt;
    if(activePowerTime<=0){
        if(activePower==='bigapple')appleRadius=Math.max(9-level*0.3,5);
        if(activePower==='freeze'){targetSwaySpeed=0.5+level*0.25;manWalkSpeed=level>=5?rand(15,30):0;}
        activePower=null;
    }
}

// === CHALLENGE ROUNDS ===
function checkChallengeRound(){
    if(level>0&&level%5===0&&!challengeRound){
        challengeRound=true;
        const types=['tiny','wind','speed','moving'];
        challengeType=types[Math.floor(Math.random()*types.length)];
        sfxChallenge();
        if(challengeType==='tiny')appleRadius=5;
        if(challengeType==='speed')shotTimer=3;
        spawnFloatingText(W/2,H/2-60,'⚠️ CHALLENGE ROUND!','#FF5722',30);
        spawnFloatingText(W/2,H/2-25,getChallengeDesc(),'#FFAB91',18);
    }
}
function getChallengeDesc(){
    const descs={'tiny':'Tiny Apple!','wind':'Extreme Wind!','speed':'Speed Round!','moving':'Moving Target!'};
    return descs[challengeType]||'';
}
function endChallengeRound(){
    challengeRound=false;
    appleRadius=Math.max(9-level*0.3,5);
    challengeType='';
}

// === SHOT TIMER ===
function getShotTime(){
    if(challengeType==='speed')return 3;
    return Math.max(3, SHOT_TIME_BASE - level*0.4);
}

// === DAY/NIGHT ===
function getSkyColors(){
    const phase=(level-1)%8;
    const skies=[
        {t:'#87CEEB',m:'#B0E0E6',b:'#98FB98'}, // day
        {t:'#87CEEB',m:'#B0E0E6',b:'#98FB98'},
        {t:'#87CEEB',m:'#B0E0E6',b:'#98FB98'},
        {t:'#F4A460',m:'#FF8C69',b:'#98FB98'}, // sunset
        {t:'#2C3E50',m:'#34495E',b:'#2E4A3E'}, // dusk
        {t:'#0C1445',m:'#1A237E',b:'#1B3A2A'}, // night
        {t:'#1A237E',m:'#283593',b:'#1B5E20'}, // late night
        {t:'#FF7043',m:'#FFAB91',b:'#A5D6A7'}, // dawn
    ];
    return skies[phase];
}

// ============ DRAWING ============
function drawBackground(){
    const sky=getSkyColors();
    const skyGrad=ctx.createLinearGradient(0,0,0,GROUND_Y);
    skyGrad.addColorStop(0,sky.t);skyGrad.addColorStop(0.6,sky.m);skyGrad.addColorStop(1,sky.b);
    ctx.fillStyle=skyGrad;ctx.fillRect(0,0,W,GROUND_Y);

    // Stars at night
    const phase=(level-1)%8;
    if(phase>=4&&phase<=6){
        ctx.fillStyle='rgba(255,255,255,0.7)';
        for(let i=0;i<30;i++){const sx=(i*137+50)%W,sy=(i*97+20)%(GROUND_Y-60);
        ctx.beginPath();ctx.arc(sx,sy,rand(0.5,1.5),0,Math.PI*2);ctx.fill();}
    }

    // Sun/Moon
    if(phase>=4&&phase<=6){ctx.fillStyle='#E0E0E0';ctx.shadowColor='#ccc';} else{ctx.fillStyle='#FFE066';ctx.shadowColor='#FFD700';}
    ctx.shadowBlur=40;ctx.beginPath();ctx.arc(W-100,70,40,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;

    drawCloud(200,60,0.7);drawCloud(500,90,0.9);drawCloud(750,45,0.6);

    ctx.fillStyle='#6BCB77';ctx.beginPath();ctx.moveTo(0,GROUND_Y);
    ctx.quadraticCurveTo(200,GROUND_Y-50,400,GROUND_Y);
    ctx.quadraticCurveTo(600,GROUND_Y-35,800,GROUND_Y);
    ctx.quadraticCurveTo(1000,GROUND_Y-45,W,GROUND_Y);ctx.lineTo(W,GROUND_Y);ctx.fill();

    const gGrad=ctx.createLinearGradient(0,GROUND_Y,0,H);
    gGrad.addColorStop(0,'#4CAF50');gGrad.addColorStop(1,'#2E7D32');
    ctx.fillStyle=gGrad;ctx.fillRect(0,GROUND_Y,W,H-GROUND_Y);
    ctx.strokeStyle='#388E3C';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,GROUND_Y);ctx.lineTo(W,GROUND_Y);ctx.stroke();

    ctx.strokeStyle='#66BB6A';ctx.lineWidth=2;
    for(const g of grassBlades){ctx.beginPath();ctx.moveTo(g.x,GROUND_Y);ctx.lineTo(g.x-3,GROUND_Y-g.h1);ctx.stroke();ctx.beginPath();ctx.moveTo(g.x+5,GROUND_Y);ctx.lineTo(g.x+8,GROUND_Y-g.h2);ctx.stroke();}

    for(const ma of missArrows){ctx.save();ctx.translate(ma.x,ma.y);ctx.rotate(ma.angle);ctx.globalAlpha=0.5;ctx.strokeStyle='#8D6E63';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-15,0);ctx.lineTo(10,0);ctx.stroke();ctx.fillStyle='#607D8B';ctx.beginPath();ctx.moveTo(13,0);ctx.lineTo(8,-3);ctx.lineTo(8,3);ctx.closePath();ctx.fill();ctx.globalAlpha=1;ctx.restore();}
}
function drawCloud(x,y,scale){
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
    ctx.fillStyle='rgba(255,255,255,0.85)';ctx.beginPath();
    ctx.arc(0,0,25,0,Math.PI*2);ctx.arc(25,-8,20,0,Math.PI*2);ctx.arc(50,0,25,0,Math.PI*2);ctx.arc(20,10,18,0,Math.PI*2);
    ctx.fill();ctx.restore();
}
function drawArcher(){
    ctx.save();ctx.translate(ARCHER_X,GROUND_Y);
    ctx.strokeStyle='#5D4037';ctx.lineWidth=5;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(-8,0);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(8,0);ctx.stroke();
    ctx.fillStyle='#4E342E';ctx.fillRect(-12,-4,8,4);ctx.fillRect(4,-4,8,4);
    ctx.fillStyle='#43A047';ctx.beginPath();ctx.moveTo(-10,-40);ctx.lineTo(10,-40);ctx.lineTo(12,-15);ctx.lineTo(-12,-15);ctx.closePath();ctx.fill();
    ctx.fillStyle='#6D4C41';ctx.fillRect(-11,-22,22,4);ctx.fillStyle='#FFD54F';ctx.fillRect(-2,-23,4,6);
    ctx.fillStyle='#FFCC80';ctx.beginPath();ctx.arc(0,-52,12,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#5D4037';ctx.beginPath();ctx.arc(0,-56,12,Math.PI,Math.PI*2);ctx.fill();
    ctx.fillStyle='#333';ctx.beginPath();ctx.arc(4,-53,1.5,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#795548';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(4,-48,4,0.1,Math.PI-0.1);ctx.stroke();
    ctx.fillStyle='#2E7D32';ctx.beginPath();ctx.moveTo(-12,-58);ctx.lineTo(6,-58);ctx.lineTo(2,-75);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#F44336';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(2,-72);ctx.quadraticCurveTo(14,-80,10,-68);ctx.stroke();
    // Quiver
    ctx.fillStyle='#6D4C41';ctx.fillRect(-16,-42,6,20);
    for(let i=0;i<Math.min(lives,3);i++){ctx.fillStyle='#607D8B';ctx.beginPath();ctx.moveTo(-13+i*2,-44);ctx.lineTo(-14+i*2,-47);ctx.lineTo(-12+i*2,-47);ctx.closePath();ctx.fill();}
    drawBowAndArms();ctx.restore();
}
function drawBowAndArms(){
    const pull=state==='AIMING'?bowDraw:0,angle=state==='AIMING'?aimAngle:-Math.PI/6;
    ctx.save();ctx.translate(5,-35);ctx.rotate(angle);
    const pb=pull*22;
    ctx.strokeStyle='#FFCC80';ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-pb,0);ctx.stroke();
    ctx.strokeStyle='#8D6E63';ctx.lineWidth=3.5;ctx.beginPath();ctx.arc(12,0,26,-Math.PI/2+0.25,Math.PI/2-0.25);ctx.stroke();
    ctx.fillStyle='#5D4037';ctx.beginPath();ctx.arc(12,-24,2.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(12,24,2.5,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#BDBDBD';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(12,-24);ctx.lineTo(-pb,0);ctx.lineTo(12,24);ctx.stroke();
    if(state==='AIMING'&&pull>0.1){
        ctx.strokeStyle='#8D6E63';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(-pb,0);ctx.lineTo(32,0);ctx.stroke();
        ctx.fillStyle='#607D8B';ctx.beginPath();ctx.moveTo(32,0);ctx.lineTo(26,-4);ctx.lineTo(26,4);ctx.closePath();ctx.fill();
        ctx.fillStyle='#F44336';ctx.beginPath();ctx.moveTo(-pb,0);ctx.lineTo(-pb+8,-4);ctx.lineTo(-pb+8,0);ctx.closePath();ctx.fill();
        ctx.beginPath();ctx.moveTo(-pb,0);ctx.lineTo(-pb+8,4);ctx.lineTo(-pb+8,0);ctx.closePath();ctx.fill();
    }
    ctx.strokeStyle='#FFCC80';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(12,0);ctx.stroke();
    ctx.restore();
}
function drawTargetMan(){
    const tx=targetX()+targetSwayOffset();
    ctx.save();ctx.translate(tx,GROUND_Y);
    ctx.strokeStyle='#3E2723';ctx.lineWidth=5;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(-8,0);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(8,0);ctx.stroke();
    ctx.fillStyle='#333';ctx.fillRect(-12,-4,8,4);ctx.fillRect(4,-4,8,4);
    ctx.fillStyle='#1976D2';ctx.beginPath();ctx.moveTo(-10,-40);ctx.lineTo(10,-40);ctx.lineTo(13,-15);ctx.lineTo(-13,-15);ctx.closePath();ctx.fill();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(-5,-40);ctx.lineTo(0,-36);ctx.lineTo(5,-40);ctx.closePath();ctx.fill();
    const shake=level>=5?Math.sin(Date.now()*0.02)*2:0;
    ctx.strokeStyle='#FFCC80';ctx.lineWidth=4;
    ctx.beginPath();ctx.moveTo(-10,-38);ctx.lineTo(-14+shake,-18);ctx.stroke();
    ctx.beginPath();ctx.moveTo(10,-38);ctx.lineTo(14-shake,-18);ctx.stroke();
    ctx.fillStyle='#FFCC80';ctx.beginPath();ctx.arc(0,-52,12,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#333';ctx.beginPath();ctx.arc(0,-56,12,Math.PI+0.3,Math.PI*2-0.3);ctx.fill();
    const es=Math.min(3+level*0.2,5);
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-4,-53,es,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(4,-53,es,0,Math.PI*2);ctx.fill();
    const po=level>=4?Math.sin(Date.now()*0.003)*1.5:0;
    ctx.fillStyle='#333';ctx.beginPath();ctx.arc(-4+po,-53,1.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(4+po,-53,1.5,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#795548';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,-45,Math.min(5+level*0.5,9),Math.PI+0.5,-0.5);ctx.stroke();
    ctx.fillStyle='rgba(100,181,246,0.7)';ctx.beginPath();ctx.arc(14,-50,2.5,0,Math.PI*2);ctx.fill();
    if(level>=3){ctx.beginPath();ctx.arc(-14,-48,2,0,Math.PI*2);ctx.fill();}
    if(state!=='HIT')drawApple(0,-68);
    ctx.restore();
}
function drawApple(x,y){
    const r=appleRadius;
    ctx.fillStyle=challengeType==='tiny'?'#FF1744':'#E53935';
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.3)';ctx.beginPath();ctx.arc(x-r*0.3,y-r*0.3,r*0.4,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#5D4037';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+1,y-r-5);ctx.stroke();
    ctx.fillStyle='#66BB6A';ctx.beginPath();ctx.ellipse(x+4,y-r-3,4,2,0.4,0,Math.PI*2);ctx.fill();
}
function drawArrow(){
    if(!arrow)return;ctx.save();ctx.translate(arrow.x,arrow.y);ctx.rotate(arrow.angle);
    ctx.strokeStyle='#8D6E63';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(-25,0);ctx.lineTo(18,0);ctx.stroke();
    ctx.fillStyle='#607D8B';ctx.beginPath();ctx.moveTo(22,0);ctx.lineTo(15,-4);ctx.lineTo(15,4);ctx.closePath();ctx.fill();
    ctx.fillStyle='#F44336';ctx.beginPath();ctx.moveTo(-25,0);ctx.lineTo(-18,-4);ctx.lineTo(-18,0);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(-25,0);ctx.lineTo(-18,4);ctx.lineTo(-18,0);ctx.closePath();ctx.fill();
    ctx.restore();
}
function drawTrajectory(){
    if(state!=='AIMING'||bowDraw<0.15)return;
    const speed=ARROW_SPEED*bowDraw,sx=ARCHER_X+5,sy=GROUND_Y-35;
    const vx=Math.cos(aimAngle)*speed,vy=Math.sin(aimAngle)*speed;
    ctx.save();
    const ga=Math.max(0.15,0.5-level*0.03);
    ctx.setLineDash([4,8]);ctx.strokeStyle=`rgba(0,0,0,${ga})`;ctx.lineWidth=1.5;ctx.beginPath();
    const steps=Math.max(8,25-level);
    for(let i=0;i<=steps;i++){const t=i*0.04;const px=sx+vx*t+0.5*wind*t*t,py=sy+vy*t+0.5*GRAVITY*t*t;if(py>GROUND_Y+5)break;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}
    ctx.stroke();ctx.setLineDash([]);ctx.restore();
}
function drawRoundRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();}
function drawPowerBar(){
    if(state!=='AIMING')return;
    const bx=25,by=GROUND_Y-130,bw=14,bh=90;
    ctx.fillStyle='rgba(0,0,0,0.3)';drawRoundRect(bx-1,by-1,bw+2,bh+2,5);ctx.fill();
    const fH=bh*bowDraw;const grad=ctx.createLinearGradient(0,by+bh,0,by);
    grad.addColorStop(0,'#43A047');grad.addColorStop(0.5,'#FDD835');grad.addColorStop(0.85,'#FF9800');grad.addColorStop(1,'#E53935');
    ctx.fillStyle=grad;ctx.fillRect(bx,by+bh-fH,bw,fH);
    ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=1;ctx.strokeRect(bx,by,bw,bh);
    ctx.fillStyle='rgba(255,255,255,0.4)';ctx.font='9px Outfit,sans-serif';ctx.textAlign='center';ctx.fillText('PWR',bx+bw/2,by+bh+14);
}
// Shot Timer Bar
function drawShotTimer(){
    if(state!=='AIMING'||!shotTimerActive)return;
    const maxT=getShotTime(),pct=clamp(shotTimer/maxT,0,1);
    const barW=200,barH=8,bx=(W-barW)/2,by=20;
    ctx.fillStyle='rgba(0,0,0,0.3)';drawRoundRect(bx-1,by-1,barW+2,barH+2,4);ctx.fill();
    const c=pct>0.5?'#43A047':pct>0.25?'#FDD835':'#E53935';
    ctx.fillStyle=c;ctx.fillRect(bx,by,barW*pct,barH);
    if(pct<0.3){ctx.globalAlpha=0.5+Math.sin(Date.now()*0.01)*0.5;ctx.fillStyle='#E53935';ctx.fillRect(bx,by,barW*pct,barH);ctx.globalAlpha=1;}
    ctx.strokeStyle='rgba(255,255,255,0.2)';ctx.lineWidth=1;ctx.strokeRect(bx,by,barW,barH);
    ctx.fillStyle='rgba(255,255,255,0.5)';ctx.font='600 10px Outfit';ctx.textAlign='center';
    ctx.fillText('⏱️ '+shotTimer.toFixed(1)+'s',W/2,by+barH+14);
}
// Active power indicator
function drawActivePower(){
    if(!activePower)return;
    const pct=activePowerTime/POWER_DUR[activePower];
    ctx.save();ctx.fillStyle=POWER_COLORS[activePower];ctx.globalAlpha=0.6+Math.sin(Date.now()*0.005)*0.2;
    ctx.font='700 14px Outfit';ctx.textAlign='right';ctx.textBaseline='top';
    ctx.fillText(POWER_ICONS[activePower]+' '+activePower.toUpperCase()+' '+activePowerTime.toFixed(1)+'s',W-20,GROUND_Y+10);
    ctx.globalAlpha=1;ctx.restore();
}
// Challenge indicator
function drawChallengeIndicator(){
    if(!challengeRound)return;
    ctx.save();ctx.globalAlpha=0.7+Math.sin(Date.now()*0.004)*0.3;
    ctx.fillStyle='#FF5722';ctx.font='700 13px Outfit';ctx.textAlign='left';ctx.textBaseline='top';
    ctx.fillText('⚠️ CHALLENGE: '+getChallengeDesc(),20,GROUND_Y+10);
    ctx.globalAlpha=1;ctx.restore();
}
function drawLevelUpBanner(){
    if(levelUpTimer<=0)return;
    const a=Math.min(levelUpTimer,0.5)*2,s=1+(1-Math.min(levelUpTimer/1.8,1))*0.15;
    ctx.save();ctx.globalAlpha=a;ctx.translate(W/2,H/2-40);ctx.scale(s,s);
    ctx.font='800 42px Outfit,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fillText(`LEVEL ${level}`,2,2);
    ctx.fillStyle='#FFD700';ctx.fillText(`LEVEL ${level}`,0,0);
    ctx.font='600 16px Outfit';ctx.fillStyle='rgba(255,255,255,0.7)';ctx.fillText(getLevelTitle(),0,30);
    ctx.globalAlpha=1;ctx.restore();
}
function getLevelTitle(){
    const t=['','Novice','Apprentice','Sharpshooter','Eagle Eye','Master Bowman','Legendary Shot','Wind Whisperer','Apple Sniper','Robin Hood','Unbreakable','Godlike!'];
    return t[Math.min(level,t.length-1)]||'Legendary!';
}

// ============ INPUT ============
canvas.addEventListener('mousedown',(e)=>{if(state!=='AIMING')return;audioCtx.resume();mouseDown=true;bowDraw=0;const c=canvasCoords(e);mouseX=c.x;mouseY=c.y;});
canvas.addEventListener('mousemove',(e)=>{if(!mouseDown||state!=='AIMING')return;const c=canvasCoords(e);mouseX=c.x;mouseY=c.y;aimAngle=clamp(Math.atan2(mouseY-(GROUND_Y-35),mouseX-(ARCHER_X+5)),-Math.PI/2-0.1,0.05);});
canvas.addEventListener('mouseup',()=>{if(!mouseDown||state!=='AIMING')return;mouseDown=false;if(bowDraw<0.12){bowDraw=0;return;}shoot();});
canvas.addEventListener('mouseleave',()=>{if(mouseDown&&state==='AIMING'&&bowDraw>0.12){mouseDown=false;shoot();}else{mouseDown=false;}});
canvas.addEventListener('touchstart',(e)=>{e.preventDefault();if(state!=='AIMING')return;audioCtx.resume();mouseDown=true;bowDraw=0;const c=canvasCoords(e.touches[0]);mouseX=c.x;mouseY=c.y;},{passive:false});
canvas.addEventListener('touchmove',(e)=>{e.preventDefault();if(!mouseDown||state!=='AIMING')return;const c=canvasCoords(e.touches[0]);mouseX=c.x;mouseY=c.y;aimAngle=clamp(Math.atan2(mouseY-(GROUND_Y-35),mouseX-(ARCHER_X+5)),-Math.PI/2-0.1,0.05);},{passive:false});
canvas.addEventListener('touchend',(e)=>{e.preventDefault();if(!mouseDown||state!=='AIMING')return;mouseDown=false;if(bowDraw<0.12){bowDraw=0;return;}shoot();},{passive:false});

// ============ GAME ACTIONS ============
function shoot(){
    const speed=ARROW_SPEED*bowDraw;
    arrow={x:ARCHER_X+5,y:GROUND_Y-35,vx:Math.cos(aimAngle)*speed,vy:Math.sin(aimAngle)*speed,angle:aimAngle};
    state='FLYING';totalShots++;shotTimerActive=false;sfxShoot();
}
function resetRound(){
    arrow=null;bowDraw=0;mouseDown=false;state='AIMING';randomWind();
    targetSwaySpeed=activePower==='freeze'?0:0.5+level*0.25;
    manWalkSpeed=(level>=5&&activePower!=='freeze')?rand(15,25+level*2):0;
    if(challengeType==='moving')manWalkSpeed=rand(40,60);
    appleRadius=activePower==='bigapple'?16:Math.max(9-level*0.3,5);
    if(challengeType==='tiny')appleRadius=5;
    shotTimer=getShotTime();shotTimerActive=true;
    distanceText.textContent=`Level ${level} · ${distance.toFixed(0)} px`;
    // spawn extras
    if(Math.random()<0.4)spawnBird();
    trySpawnBonusApple();trySpawnPowerUp();
    checkChallengeRound();
}
function startGame(){
    score=0;lives=MAX_LIVES;combo=0;maxCombo=0;level=1;totalShots=0;totalHits=0;
    distance=INITIAL_DISTANCE;newHighScoreFlag=false;missArrows=[];
    particles=[];floatingTexts=[];trailParticles=[];birds=[];
    bonusApple=null;powerUp=null;activePower=null;activePowerTime=0;
    challengeRound=false;challengeType='';manWalkOffset=0;appleRadius=9;
    screenShake=0;hitFlash=0;slowMo=1;slowMoTimer=0;levelUpTimer=0;
    updateLivesDisplay();updateComboDisplay();scoreEl.textContent='0';highscoreEl.textContent=highScore;
    resetRound();
}
function updateLivesDisplay(){livesEl.textContent='❤️'.repeat(Math.max(lives,0))+'🖤'.repeat(Math.max(MAX_LIVES-lives,0));}
function updateComboDisplay(){
    if(combo>=2){comboDisplay.classList.remove('combo-hidden');comboDisplay.classList.add('combo-active');comboEl.textContent=`x${combo}`;comboEl.classList.remove('combo-pulse');void comboEl.offsetWidth;comboEl.classList.add('combo-pulse');}
    else{comboDisplay.classList.add('combo-hidden');comboDisplay.classList.remove('combo-active');comboEl.textContent='x1';}
}
function loseLife(){
    lives--;updateLivesDisplay();sfxLifeLost();screenShake=0.3;combo=0;updateComboDisplay();
    if(lives<=0){gameOver();}else{
        state='MISS';
        if(arrow){missArrows.push({x:arrow.x,y:Math.min(arrow.y,GROUND_Y-2),angle:arrow.angle});if(missArrows.length>8)missArrows.shift();}
        spawnFloatingText(W/2,H/2-20,`💔 ${lives} ${lives===1?'life':'lives'} left`,'#ff6b6b',20);
        setTimeout(()=>resetRound(),1000);
    }
}
function gameOver(){
    state='GAMEOVER';sfxGameOver();screenShake=0.8;
    if(score>highScore){highScore=score;localStorage.setItem('appleArcherHigh',highScore);newHighScoreFlag=true;}
    highscoreEl.textContent=highScore;
    gameOverScore.textContent=score;gameOverBest.textContent=highScore;
    gameOverCombo.textContent=`x${maxCombo}`;gameOverLevel.textContent=level;
    gameOverAccuracy.textContent=totalShots>0?Math.round(totalHits/totalShots*100)+'%':'0%';
    gameOverTitle.textContent=newHighScoreFlag?'🎉 NEW BEST!':'GAME OVER';
    setTimeout(()=>gameOverOverlay.classList.remove('hidden'),700);
}
function appleHit(isPerfect){
    state='HIT';totalHits++;combo++;if(combo>maxCombo)maxCombo=combo;
    const cBonus=combo>=2?combo-1:0,pBonus=isPerfect?3:0;
    let pts=1+cBonus+pBonus;
    if(activePower==='doublepoints')pts*=2;
    score+=pts;
    scoreEl.textContent=score;scoreEl.classList.remove('score-pop');void scoreEl.offsetWidth;scoreEl.classList.add('score-pop');
    updateComboDisplay();
    sfxApple(1+combo*0.08);if(isPerfect)sfxPerfect();if(combo>=3)sfxCombo(combo);
    hitFlash=isPerfect?0.6:0.35;
    const tx=targetX()+targetSwayOffset(),ay=GROUND_Y-68;
    spawnParticles(tx,ay,'#E53935',16);spawnParticles(tx,ay,'#FFEB3B',10);spawnParticles(tx,ay,'#66BB6A',6);
    if(isPerfect){spawnFloatingText(tx,ay-30,'⭐ PERFECT!','#FFD700',28);spawnStarBurst(tx,ay,24);}
    if(combo>=2){spawnFloatingText(tx,ay-(isPerfect?60:30),`x${combo} COMBO!`,combo>=5?'#FF4081':combo>=3?'#FF9800':'#43E97B',22);}
    spawnFloatingText(tx+30,ay-10,`+${pts}`,'#fff',18);
    if(isPerfect||combo>=3){slowMo=0.3;slowMoTimer=0.5;}
    const prevLvl=level;level=Math.floor(totalHits/3)+1;if(level<prevLvl)level=prevLvl;
    if(level>prevLvl){levelUpTimer=2.0;sfxLevelUp();spawnStarBurst(W/2,H/2-40,32);if(challengeRound)endChallengeRound();}
    distance=Math.min(distance+DISTANCE_STEP,MAX_DISTANCE);
    setTimeout(()=>resetRound(),isPerfect||combo>=3?1100:800);
}

// ============ UPDATE ============
function update(dt){
    if(slowMoTimer>0){slowMoTimer-=dt;if(slowMoTimer<=0)slowMo=1;}
    const sDt=dt*slowMo;
    targetSwayAngle+=targetSwaySpeed*sDt;
    // Man walking
    if(manWalkSpeed>0){
        manWalkOffset+=manWalkDir*manWalkSpeed*sDt;
        if(Math.abs(manWalkOffset)>25){manWalkDir*=-1;manWalkOffset=clamp(manWalkOffset,-25,25);}
    }
    if(state==='AIMING'&&mouseDown){bowDraw=Math.min(bowDraw+sDt*1.1,1);}
    // Shot timer countdown
    if(state==='AIMING'&&shotTimerActive){
        shotTimer-=dt;
        if(shotTimer<=2&&shotTimer>1.9)sfxTimeTick();
        if(shotTimer<=1&&shotTimer>0.9)sfxTimeTick();
        if(shotTimer<=0){sfxMiss();combo=0;updateComboDisplay();spawnFloatingText(W/2,H/2-20,'⏰ TIME UP!','#FF5722',26);loseLife();return;}
    }
    if(state==='FLYING'&&arrow){
        arrow.vx+=wind*sDt;arrow.vy+=GRAVITY*sDt;arrow.x+=arrow.vx*sDt;arrow.y+=arrow.vy*sDt;
        arrow.angle=Math.atan2(arrow.vy,arrow.vx);
        if(Math.random()<0.6)trailParticles.push({x:arrow.x-Math.cos(arrow.angle)*15,y:arrow.y-Math.sin(arrow.angle)*15,r:rand(1,2.5),color:'rgba(255,255,255,0.6)',life:0.3,maxLife:0.3});
        const tx=targetX()+targetSwayOffset(),tipX=arrow.x+Math.cos(arrow.angle)*22,tipY=arrow.y+Math.sin(arrow.angle)*22;
        // Apple
        const ad=distFn(tipX,tipY,tx,GROUND_Y-68);
        if(ad<appleRadius+4){appleHit(ad<appleRadius*0.5);return;}
        // Man body
        if(tipX>=tx-14&&tipX<=tx+14&&tipY>=GROUND_Y-64&&tipY<=GROUND_Y){loseLife();return;}
        // Man head
        if(distFn(tipX,tipY,tx,GROUND_Y-52)<13){loseLife();return;}
        // Bird collision
        for(let i=birds.length-1;i>=0;i--){
            if(distFn(tipX,tipY,birds[i].x,birds[i].y)<18*birds[i].size){
                sfxBirdHit();spawnParticles(birds[i].x,birds[i].y,'#333',8);spawnFloatingText(birds[i].x,birds[i].y-20,'🐦 BLOCKED!','#FF9800',18);
                birds.splice(i,1);arrow=null;combo=0;updateComboDisplay();resetRound();return;
            }
        }
        // Bonus apple
        if(bonusApple&&distFn(tipX,tipY,bonusApple.x,bonusApple.y)<12){
            sfxBonus();const bp=5*(activePower==='doublepoints'?2:1);score+=bp;scoreEl.textContent=score;
            spawnStarBurst(bonusApple.x,bonusApple.y,20);spawnFloatingText(bonusApple.x,bonusApple.y-20,'🌟 +'+bp+' BONUS!','#FFD700',24);
            bonusApple=null;
            // Don't end the shot — arrow keeps flying to still try hitting apple
        }
        // Power-up
        if(powerUp&&distFn(tipX,tipY,powerUp.x,powerUp.y)<16){activatePowerUp(powerUp.type);}
        // Out of bounds
        if(arrow&&(arrow.x>W+50||arrow.y>GROUND_Y+20||arrow.x<-50||arrow.y<-200)){
            sfxMiss();combo=0;updateComboDisplay();spawnFloatingText(W/2,H/2-20,'MISS!','rgba(255,255,255,0.6)',24);resetRound();
        }
    }
    if(screenShake>0)screenShake-=dt*2.5;
    if(hitFlash>0)hitFlash-=dt*1.5;
    if(levelUpTimer>0)levelUpTimer-=dt;
    updateParticles(sDt);updateTrail(dt);updateFloatingTexts(dt);
    updateBirds(sDt);updateBonusApple(dt);updatePowerUp(dt);updateActivePower(dt);
}

// ============ RENDER ============
function render(){
    ctx.save();
    if(screenShake>0){ctx.translate(rand(-screenShake*12,screenShake*12),rand(-screenShake*12,screenShake*12));}
    drawBackground();drawTrajectory();drawBirds();drawArcher();drawTargetMan();
    drawBonusApple();drawPowerUp();drawTrail();drawArrow();drawParticles();
    drawPowerBar();drawShotTimer();drawFloatingTexts();drawLevelUpBanner();
    drawActivePower();drawChallengeIndicator();
    if(state==='AIMING'||state==='FLYING'){
        ctx.save();ctx.setLineDash([6,6]);ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=1;ctx.beginPath();
        const ttx=targetX()+targetSwayOffset();ctx.moveTo(ttx,GROUND_Y-80);ctx.lineTo(ttx,GROUND_Y);ctx.stroke();ctx.setLineDash([]);ctx.restore();
    }
    if(hitFlash>0){ctx.fillStyle=`rgba(255,235,59,${hitFlash*0.25})`;ctx.fillRect(0,0,W,H);}
    if(state==='GAMEOVER'){ctx.fillStyle='rgba(200,30,30,0.15)';ctx.fillRect(0,0,W,H);if(arrow)drawArrow();}
    if(slowMo<1){const grad=ctx.createRadialGradient(W/2,H/2,H*0.3,W/2,H/2,H*0.8);grad.addColorStop(0,'rgba(0,0,0,0)');grad.addColorStop(1,'rgba(0,0,0,0.25)');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);}
    ctx.restore();
}

// ============ LOOP ============
function gameLoop(ts){
    if(!lastTime)lastTime=ts;const dt=Math.min((ts-lastTime)/1000,0.05);lastTime=ts;
    if(state!=='START'){update(dt);render();}
    requestAnimationFrame(gameLoop);
}
startBtn.addEventListener('click',()=>{audioCtx.resume();startOverlay.classList.add('hidden');startGame();});
restartBtn.addEventListener('click',()=>{gameOverOverlay.classList.add('hidden');startGame();});
highscoreEl.textContent=highScore;
requestAnimationFrame(gameLoop);
})();
