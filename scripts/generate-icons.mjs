/* LifeOS install icons: pure Node.js PNG generator, no paid or binary dependencies. */
import {deflateSync} from 'node:zlib';
import {mkdirSync, writeFileSync} from 'node:fs';
const out='dist';
const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n));
const mix=(a,b,t)=>a+(b-a)*t;
const rgba=(r,g,b)=>[Math.round(clamp(r,0,255)),Math.round(clamp(g,0,255)),Math.round(clamp(b,0,255))];
function seg(px,py,ax,ay,bx,by){
 const vx=bx-ax,vy=by-ay, t=clamp(((px-ax)*vx+(py-ay)*vy)/(vx*vx+vy*vy));
 return Math.hypot(px-(ax+vx*t),py-(ay+vy*t));
}
const smooth=(distance,radius,blur)=>clamp((radius-distance)/blur+.5);
function pixel(x,y,maskable=false){
 // Coordinates remain in a square 512px design space. Maskable logos use extra padding.
 const cx=256,cy=256,scale=maskable?.77:1,px=(x-cx)/scale+cx,py=(y-cy)/scale+cy;
 const radial=Math.hypot(x-340,y-140),t=clamp(radial/480),v=clamp((x+y)/1024);
 let c=[mix(28,10,v),mix(26,17,v),mix(57,40,v)];
 const glow=clamp(1-radial/340)*.28;
 c=c.map((z,i)=>mix(z,[73,48,149][i],glow));
 const edge=Math.hypot(px-256,py-256),ang=Math.atan2(py-cy,px-cx);
 function paint(target,opacity){let a=clamp(opacity);for(let i=0;i<3;i++)c[i]=mix(c[i],target[i],a);}
 // restrained aura and outer orbit
 paint([94,77,199],smooth(edge,164,72)*.10);
 const outer=smooth(Math.abs(edge-144),5,2.4),inner=smooth(Math.abs(edge-123),2.5,2);
 paint([117,105,227],outer*.4);
 paint([157,132,244],inner*.20);
 // Two luminous arcs. The second arc supplies balance without making a star.
 if(ang>-2.8&&ang<-.05){paint([151,111,255],outer*.90);paint([153,114,252],smooth(Math.abs(edge-144),13,8)*.10);}
 if(ang>.75&&ang<2.55){paint([92,211,237],outer*.88);paint([93,224,247],smooth(Math.abs(edge-144),11,8)*.13);}
 // Slightly inclined orbit behind core
 const dx=(px-cx)*.90+(py-cy)*.43,dy=(py-cy)*.9-(px-cx)*.43;
 const orb=Math.hypot(dx/1.30,dy/0.78);
 paint([183,170,250],smooth(Math.abs(orb-112),2.8,2.2)*.33);
 // Center disk layered for depth
 const core=Math.hypot(px-cx,py-cy);
 paint([79,61,161],smooth(core,72,3)*.96);
 paint([123,103,213],smooth(Math.abs(core-70),2,2)*.65);
 paint([47,51,111],smooth(core,58,14)*.74);
 // Letterform / progress path: clean, white and identifiable at small sizes.
 const l=Math.min(seg(px,py,236,226,236,291),seg(px,py,236,291,281,291));
 paint([12,24,68],smooth(l,15,3)*.25);
 paint([246,246,255],smooth(l,8,2.5)*.97);
 // Tiny endpoint gives the icon a sense of purposeful progression.
 const dot=Math.hypot(px-281,py-291);paint([125,230,251],smooth(dot,7.6,2)*.91);
 // Satellites
 const n1=Math.hypot(px-367,py-165),n2=Math.hypot(px-133,py-333);
 paint([48,222,255],smooth(n1,20,15)*.20);
 paint([131,235,255],smooth(n1,7.6,2)*.98);
 paint([195,148,255],smooth(n2,8,3)*.96);
 // Thin edge highlight for app-native materials.
 const border=Math.max(Math.abs(x-256),Math.abs(y-256));
 paint([150,134,250],smooth(Math.abs(border-252),1,1)*.08);
 return rgba(...c);
}
const table=Array.from({length:256},(_,n)=>{let c=n;for(let j=0;j<8;j++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);return c>>>0;});
function crc(b){let c=0xffffffff;for(const x of b)c=table[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function chunk(type,data){const typeBytes=Buffer.from(type),len=Buffer.alloc(4),checksum=Buffer.alloc(4);len.writeUInt32BE(data.length);const body=Buffer.concat([typeBytes,data]);checksum.writeUInt32BE(crc(body));return Buffer.concat([len,body,checksum]);}
function generate(size,file,maskable=false){
 const stride=size*4,raw=Buffer.alloc(size*(stride+1));
 for(let j=0;j<size;j++){const off=j*(stride+1);raw[off]=0;for(let i=0;i<size;i++){
   const rgba=pixel((i+.5)*512/size,(j+.5)*512/size,maskable),at=off+1+i*4;
   raw[at]=rgba[0];raw[at+1]=rgba[1];raw[at+2]=rgba[2];raw[at+3]=255;
 }}
 const head=Buffer.alloc(13);head.writeUInt32BE(size,0);head.writeUInt32BE(size,4);head[8]=8;head[9]=6;
 const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
 writeFileSync(out+'/'+file,png);return png.length;
}
mkdirSync(out,{recursive:true});
for(const [size,name,maskable] of [[192,'icon-192.png',false],[512,'icon-512.png',false],[512,'icon-maskable-512.png',true],[180,'apple-touch-icon.png',false]]){
 const bytes=generate(size,name,maskable);console.log('LifeOS icon:',name,bytes,'bytes');
}
