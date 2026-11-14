// GLSL for the simulation and the final picture.
// Sim space: one texel = one cell, y up, dt = 1 step. Velocities are cells/step.
// Scalar texture: R mist (suspended droplets), G temperature (0 = room),
//                 B vapour (invisible water), A precipitation made this step.
// Object textures (rasterised on the CPU when placeables change):
//   uObjA: R solid, G surface temperature (0..1 -> -1..+1), B mist emission, A thermal flag
//   uObjB: RG wind direction*speed (signed, 128 = 0), B sink strength, A wind strength
'use strict';
window.MT = window.MT || {};
(function (MT) {
  const HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 uv;
out vec4 o;
uniform vec2 px;
uniform sampler2D uObjA;
bool inBox(vec2 p){ return p.x>0. && p.x<1. && p.y>0. && p.y<1.; }
bool solidAt(vec2 p){ return !inBox(p) || texture(uObjA,p).r>.5; }
`;

  const S = {};

  // Rule 3 (air currents) + rule 2 (buoyancy): move the air along itself, then push it.
  S.advectVel = HEAD + `
uniform sampler2D uVel, uSca, uObjB;
uniform float uBuoyT, uBuoyM, uFan, uDamp, uVmax;
void main(){
  if(solidAt(uv)){ o=vec4(0.); return; }
  vec2 v=texture(uVel,uv).xy;
  vec2 nv=texture(uVel,uv-v*px).xy*uDamp;
  vec4 s=texture(uSca,uv);
  nv.y+=uBuoyT*s.g-uBuoyM*s.r;            // warm air rises, mist-laden air is heavy
  vec4 w=texture(uObjB,uv);
  vec2 dir=(w.rg*255.-128.)/127.;
  nv+=(dir*uFan-nv)*w.a;                   // fans drag the air toward their speed
  o=vec4(clamp(nv,-uVmax,uVmax),0.,1.);
}`;

  S.curl = HEAD + `
uniform sampler2D uVel;
void main(){
  float l=texture(uVel,uv-vec2(px.x,0.)).y, r=texture(uVel,uv+vec2(px.x,0.)).y;
  float b=texture(uVel,uv-vec2(0.,px.y)).x, t=texture(uVel,uv+vec2(0.,px.y)).x;
  o=vec4(.5*((r-l)-(t-b)),0.,0.,1.);
}`;

  // Vorticity confinement: puts back the small curls the solver smears out.
  S.vorticity = HEAD + `
uniform sampler2D uVel, uCurl;
uniform float uVort;
void main(){
  vec2 v=texture(uVel,uv).xy;
  if(solidAt(uv)){ o=vec4(0.); return; }
  float l=abs(texture(uCurl,uv-vec2(px.x,0.)).r), r=abs(texture(uCurl,uv+vec2(px.x,0.)).r);
  float b=abs(texture(uCurl,uv-vec2(0.,px.y)).r), t=abs(texture(uCurl,uv+vec2(0.,px.y)).r);
  float c=texture(uCurl,uv).r;
  vec2 g=.5*vec2(r-l,t-b);
  g/=length(g)+1e-5;
  v+=uVort*c*vec2(g.y,-g.x);
  o=vec4(v,0.,1.);
}`;

  // Rule 4 (obstacles): solids and the glass have zero velocity; pressure makes the
  // air go around them instead of through them.
  S.divergence = HEAD + `
uniform sampler2D uVel;
void main(){
  vec2 L=uv-vec2(px.x,0.), R=uv+vec2(px.x,0.), B=uv-vec2(0.,px.y), T=uv+vec2(0.,px.y);
  float l=solidAt(L)?0.:texture(uVel,L).x, r=solidAt(R)?0.:texture(uVel,R).x;
  float b=solidAt(B)?0.:texture(uVel,B).y, t=solidAt(T)?0.:texture(uVel,T).y;
  o=vec4(.5*((r-l)+(t-b)),0.,0.,1.);
}`;

  S.jacobi = HEAD + `
uniform sampler2D uP, uDiv;
void main(){
  vec2 L=uv-vec2(px.x,0.), R=uv+vec2(px.x,0.), B=uv-vec2(0.,px.y), T=uv+vec2(0.,px.y);
  float c=texture(uP,uv).r;
  float l=solidAt(L)?c:texture(uP,L).r, r=solidAt(R)?c:texture(uP,R).r;
  float b=solidAt(B)?c:texture(uP,B).r, t=solidAt(T)?c:texture(uP,T).r;
  o=vec4((l+r+b+t-texture(uDiv,uv).r)*.25,0.,0.,1.);
}`;

  S.gradient = HEAD + `
uniform sampler2D uP, uVel;
void main(){
  if(solidAt(uv)){ o=vec4(0.); return; }
  vec2 L=uv-vec2(px.x,0.), R=uv+vec2(px.x,0.), B=uv-vec2(0.,px.y), T=uv+vec2(0.,px.y);
  float c=texture(uP,uv).r;
  bool sl=solidAt(L), sr=solidAt(R), sb=solidAt(B), st=solidAt(T);
  float l=sl?c:texture(uP,L).r, r=sr?c:texture(uP,R).r;
  float b=sb?c:texture(uP,B).r, t=st?c:texture(uP,T).r;
  vec2 v=texture(uVel,uv).xy-.5*vec2(r-l,t-b);
  if(sl) v.x=max(v.x,0.); if(sr) v.x=min(v.x,0.);   // nothing flows into a wall
  if(sb) v.y=max(v.y,0.); if(st) v.y=min(v.y,0.);
  o=vec4(v,0.,1.);
}`;

  // Wind carries mist, heat and vapour. Mist droplets also settle slowly.
  S.advectSca = HEAD + `
uniform sampler2D uVel, uSca;
uniform float uSettle;
void main(){
  vec2 v=texture(uVel,uv).xy;
  vec4 a=texture(uSca,uv-v*px);
  float m=texture(uSca,uv-(v-vec2(0.,uSettle))*px).r;
  o=vec4(m,a.g,a.b,0.);
}`;

  // Rule 1 (diffusion), rule 5 (surface temperature), rule 6 (condensation).
  S.update = HEAD + `
uniform sampler2D uSca, uObjB;
uniform float uDm,uDt,uDv,uSurfK,uSurfT,uWallT;
uniform float uS0,uS1,uRc,uRe,uLat;
uniform float uKp,uMcrit,uKs,uKc,uKg,uKv,uVamb,uKt;
uniform float uEmit,uEmitT,uSink,uSeed;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7))+uSeed)*43758.5453); }
void main(){
  vec4 c=texture(uSca,uv);
  vec4 oa=texture(uObjA,uv);
  vec2 pn[4]=vec2[4](uv-vec2(px.x,0.),uv+vec2(px.x,0.),uv-vec2(0.,px.y),uv+vec2(0.,px.y));
  if(oa.r>.5){
    // Inside a solid: mirror the neighbouring air so nothing leaks in or out,
    // and hold the surface temperature for heaters and coolers.
    vec4 sum=vec4(0.); float n=0.;
    for(int i=0;i<4;i++){ if(!solidAt(pn[i])){ sum+=texture(uSca,pn[i]); n+=1.; } }
    vec4 a=n>0.?sum/n:vec4(0.,c.g,0.,0.);
    float T=oa.a>.5?(oa.g*2.-1.)*uSurfT:a.g;
    o=vec4(a.r,T,a.b,0.); return;
  }
  float lm=0.,lt=0.,lv=0.,nearS=0.,cold=0.;
  for(int i=0;i<4;i++){
    vec2 p=pn[i];
    if(!inBox(p)){ lt-=c.g*uWallT; continue; }      // glass sits at room temperature
    vec4 a=texture(uObjA,p);
    if(a.r>.5){
      nearS=1.;
      if(a.a>.5){ float Ts=(a.g*2.-1.)*uSurfT; lt+=(Ts-c.g)*uSurfK; cold=max(cold,-Ts); }
    } else {
      vec4 s=texture(uSca,p);
      lm+=s.r-c.r; lt+=s.g-c.g; lv+=s.b-c.b;
    }
  }
  float m=c.r+uDm*lm, T=c.g+uDt*lt, v=c.b+uDv*lv;

  // Warm air holds more water. Above saturation vapour turns to mist, below it mist evaporates.
  float sat=max(uS0+uS1*T,.02);
  float ex=v-sat;
  if(ex>0.){ float q=ex*uRc; v-=q; m+=q; T+=uLat*q; }
  else { float q=min(m,-ex*uRe); m-=q; v+=q; T-=uLat*q; }

  // Dense mist coalesces into drops; surfaces (cold ones most) collect it.
  float p=min(m,uKp*max(m-uMcrit,0.)+m*(uKs*nearS+uKc*cold));
  m-=p;
  m*=1.-uKg;                 // slow loss onto the front and back panes
  v+=(uVamb-v)*uKv;
  T*=1.-uKt;

  vec4 ob=texture(uObjB,uv);
  float e=oa.b*(.5+hash(uv));
  m+=e*uEmit; T=mix(T,uEmitT,min(e*.3,1.));
  float sk=ob.b*uSink; m*=1.-sk; v=mix(v,uVamb*.4,sk);
  o=vec4(max(m,0.),clamp(T,-1.5,1.5),max(v,0.),p);
}`;

  // Precipitation, shrunk 8x and packed into bytes for a cheap CPU read-back.
  S.precip = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D uSca; uniform vec2 px; uniform float uGain;
void main(){
  float s=0.;
  for(int j=0;j<4;j++) for(int i=0;i<4;i++)
    s+=texture(uSca,uv+(vec2(float(i),float(j))-1.5)*2.*px).a;
  o=vec4(clamp(s/16.*uGain,0.,1.),0.,0.,1.);
}`;

  // Final picture at pixel-art resolution: room, placeables, mist, glass.
  S.composite = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D uScene, uFront, uSca, uObjA;
uniform vec2 uRes;
uniform vec4 uBox;            // x, y (from bottom), w, h in art pixels
uniform vec4 uLights[16];     // x, y, intensity, kind (0 lamp, 1 heater, 2 cooler)
uniform int uNumLights;
uniform float uDens, uShadow, uLevels;
float bayer(vec2 p){
  ivec2 i=ivec2(p)&3;
  int b=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5)[i.y*4+i.x];
  return (float(b)+.5)/16.;
}
void main(){
  vec2 fc=gl_FragCoord.xy;
  vec3 col=texture(uScene,fc/uRes).rgb;
  vec2 b=(fc-uBox.xy)/uBox.zw;
  if(b.x>0.&&b.x<1.&&b.y>0.&&b.y<1.){
    vec4 s=texture(uSca,b);
    float open=1.-step(.5,texture(uObjA,b).r);
    // light comes from the upper left; mist between here and there shades this spot
    vec2 L=normalize(vec2(-.55,.83))*2.5/uBox.zw;
    float sh=0.;
    for(int i=1;i<=5;i++) sh+=texture(uSca,b+L*float(i)).r;
    float lit=exp(-sh*uShadow);
    float a=1.-exp(-s.r*uDens);
    vec3 mc=mix(vec3(.30,.36,.34),vec3(.80,.84,.74),lit);
    mc*=mix(vec3(1.,1.03,.98),vec3(.86,.74,.64),smoothstep(.25,1.,fc.x/uRes.x));
    mc+=vec3(.16,.05,-.04)*clamp(s.g,0.,1.)+vec3(-.05,.0,.05)*clamp(-s.g,0.,1.);
    a=floor(a*uLevels+bayer(fc))/uLevels;         // banded and dithered, like the art
    a*=open;
    col=mix(col,mc,clamp(a,0.,.94));
    for(int i=0;i<16;i++){
      if(i>=uNumLights) break;
      vec4 l=uLights[i];
      vec3 lc=l.w<.5?vec3(1.,.82,.5):(l.w<1.5?vec3(1.,.38,.1):vec3(.45,.7,.9));
      float R=l.w<.5?16.:7.;
      float d=distance(fc,l.xy)/R;
      float g=l.z/pow(1.+d*d,1.5);
      g=floor(g*10.+bayer(fc+2.))/10.;
      col+=lc*g*(.10+.55*a);
    }
  }
  vec4 f=texture(uFront,fc/uRes);
  col=mix(col,f.rgb,f.a);
  o=vec4(col,1.);
}`;

  MT.SHADERS = S;
})(window.MT);
