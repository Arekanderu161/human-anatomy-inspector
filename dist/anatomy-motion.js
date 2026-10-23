// Adapted from Anatomy kit/gl.mjs. Copyright (c) 2026 Ryan, MIT.
// Full notice: ANATOMY-LICENSE.txt.
export const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
export function settle(state,target,dt,seconds,calm=false){
  if(calm){state.x=target;state.v=0;return false}
  const w=1/seconds;
  for(let i=0;i<4;i++){const h=dt/4;state.v+=(w*w*(target-state.x)-2*w*state.v)*h;state.x+=state.v*h}
  if(Math.abs(target-state.x)<1e-4&&Math.abs(state.v)<1e-4){state.x=target;state.v=0;return false}
  return true;
}
