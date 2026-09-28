/**
 * js/neural-body.js — Animated Neural Body Canvas
 * ================================================
 * Renders a stylised human silhouette with animated
 * neural network overlay. The 3D body is a VISUAL METAPHOR
 * for the EEG/neural system — no anatomical localisation claims.
 *
 * Color responds to the currently selected IC decision:
 *   KEEP   → #00ff88 (green)
 *   REMOVE → #ff3333 (red)
 *   REVIEW → #ffaa00 (amber)
 */

'use strict';

class NeuralBodyRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx    = this.canvas.getContext('2d');
    this.W      = this.canvas.width;
    this.H      = this.canvas.height;
    this.cx     = this.W / 2;
    this.t      = 0;
    this.decision = 'REVIEW';
    this.view     = 'anterior';

    this._buildNodes();
    this._buildParticles();
    this._raf = null;
    this.start();
  }

  // ── Color based on decision ─────────────────────────────
  get color() {
    return { KEEP: '#00ff88', REMOVE: '#ff3333', REVIEW: '#ffaa00' }[this.decision] || '#00ff88';
  }

  setDecision(d) { this.decision = d; }
  setView(v)     { this.view = v; }

  // ── Neural nodes ────────────────────────────────────────
  _buildNodes() {
    const cx = this.cx;
    this.nodes = [
      // Brain cluster
      {x:cx,    y:52,  r:7,  group:'brain'},
      {x:cx-18, y:44,  r:4,  group:'brain'},
      {x:cx+18, y:44,  r:4,  group:'brain'},
      {x:cx-22, y:60,  r:3,  group:'brain'},
      {x:cx+22, y:58,  r:3,  group:'brain'},
      // Cervical spine
      {x:cx,    y:95,  r:4,  group:'spine'},
      // Thoracic
      {x:cx,    y:140, r:4,  group:'spine'},
      {x:cx,    y:185, r:4,  group:'spine'},
      {x:cx,    y:230, r:3,  group:'spine'},
      // Lumbar
      {x:cx,    y:268, r:4,  group:'spine'},
      // Shoulders
      {x:cx-60, y:120, r:4,  group:'shoulder'},
      {x:cx+60, y:120, r:4,  group:'shoulder'},
      // Arms
      {x:cx-85, y:165, r:3,  group:'arm'},
      {x:cx+85, y:165, r:3,  group:'arm'},
      {x:cx-98, y:215, r:3,  group:'arm'},
      {x:cx+98, y:215, r:3,  group:'arm'},
      {x:cx-95, y:258, r:2,  group:'arm'},
      {x:cx+95, y:258, r:2,  group:'arm'},
      // Torso sides
      {x:cx-45, y:170, r:3,  group:'torso'},
      {x:cx+45, y:170, r:3,  group:'torso'},
      {x:cx-40, y:220, r:3,  group:'torso'},
      {x:cx+40, y:220, r:3,  group:'torso'},
      // Hips
      {x:cx-48, y:272, r:4,  group:'hip'},
      {x:cx+48, y:272, r:4,  group:'hip'},
      // Legs
      {x:cx-38, y:320, r:3,  group:'leg'},
      {x:cx+38, y:320, r:3,  group:'leg'},
      {x:cx-32, y:375, r:3,  group:'leg'},
      {x:cx+32, y:375, r:3,  group:'leg'},
      {x:cx-28, y:428, r:2,  group:'leg'},
      {x:cx+28, y:428, r:2,  group:'leg'},
    ];

    this.edges = [
      [0,1],[0,2],[0,3],[0,4],[1,3],[2,4],   // brain
      [0,5],[5,6],[6,7],[7,8],[8,9],          // spine
      [5,10],[5,11],                           // to shoulders
      [10,12],[12,14],[14,16],                // left arm
      [11,13],[13,15],[15,17],                // right arm
      [6,18],[6,19],[7,20],[7,21],            // torso
      [9,22],[9,23],                          // hips
      [22,24],[24,26],[26,28],                // left leg
      [23,25],[25,27],[27,29],                // right leg
      [18,20],[19,21],[22,23],                // cross
    ];

    // Signal pulse state per edge
    this.pulses = this.edges.map(() => ({ t: Math.random(), speed: 0.008 + Math.random() * 0.012 }));
  }

  _buildParticles() {
    this.particles = Array.from({length: 25}, () => ({
      x: Math.random() * this.W,
      y: Math.random() * this.H,
      vx:(Math.random()-0.5)*0.4,
      vy:(Math.random()-0.5)*0.4,
      r: Math.random()*1.5+0.5,
      phase: Math.random()*Math.PI*2,
    }));
  }

  // ── Drawing ─────────────────────────────────────────────

  _drawBody() {
    const {ctx, cx, color} = this;
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle   = color;

    // Head
    ctx.beginPath(); ctx.ellipse(cx,50,28,34,0,0,Math.PI*2); ctx.fill();

    // Torso
    ctx.beginPath();
    ctx.moveTo(cx-58,105); ctx.bezierCurveTo(cx-68,140,cx-62,215,cx-52,272);
    ctx.lineTo(cx+52,272); ctx.bezierCurveTo(cx+62,215,cx+68,140,cx+58,105);
    ctx.closePath(); ctx.fill();

    // Left arm
    ctx.beginPath();
    ctx.moveTo(cx-58,110); ctx.bezierCurveTo(cx-80,145,cx-100,195,cx-105,260);
    ctx.lineTo(cx-88,264); ctx.bezierCurveTo(cx-84,200,cx-64,150,cx-44,116);
    ctx.closePath(); ctx.fill();

    // Right arm
    ctx.beginPath();
    ctx.moveTo(cx+58,110); ctx.bezierCurveTo(cx+80,145,cx+100,195,cx+105,260);
    ctx.lineTo(cx+88,264); ctx.bezierCurveTo(cx+84,200,cx+64,150,cx+44,116);
    ctx.closePath(); ctx.fill();

    // Left leg
    ctx.beginPath();
    ctx.moveTo(cx-50,272); ctx.bezierCurveTo(cx-55,330,cx-50,385,cx-44,440);
    ctx.lineTo(cx-26,440); ctx.bezierCurveTo(cx-22,385,cx-26,330,cx-24,272);
    ctx.closePath(); ctx.fill();

    // Right leg
    ctx.beginPath();
    ctx.moveTo(cx+50,272); ctx.bezierCurveTo(cx+55,330,cx+50,385,cx+44,440);
    ctx.lineTo(cx+26,440); ctx.bezierCurveTo(cx+22,385,cx+26,330,cx+24,272);
    ctx.closePath(); ctx.fill();

    ctx.restore();
  }

  _drawOutline() {
    const {ctx, cx, color, t} = this;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth   = 0.6;
    ctx.globalAlpha = 0.12 + 0.06 * Math.sin(t*0.5);

    ctx.beginPath(); ctx.ellipse(cx,50,28,34,0,0,Math.PI*2); ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx-58,105); ctx.bezierCurveTo(cx-68,140,cx-62,215,cx-52,272);
    ctx.lineTo(cx+52,272); ctx.bezierCurveTo(cx+62,215,cx+68,140,cx+58,105);
    ctx.closePath(); ctx.stroke();

    ctx.restore();
  }

  _drawBrain() {
    const {ctx, cx, color, t} = this;

    // Outer glow
    const grd = ctx.createRadialGradient(cx,48,4,cx,48,48);
    grd.addColorStop(0,   color+'bb');
    grd.addColorStop(0.4, color+'44');
    grd.addColorStop(1,   'transparent');
    ctx.save();
    ctx.globalAlpha = 0.28 + 0.14 * Math.sin(t*1.1);
    ctx.fillStyle   = grd;
    ctx.beginPath(); ctx.ellipse(cx,48,48,48,0,0,Math.PI*2); ctx.fill();
    ctx.restore();

    // Brain fold lines
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth   = 0.9;
    ctx.globalAlpha = 0.55;
    [[cx-8,28,cx+2,38,cx-2,50,cx+8,62],
     [cx-22,34,cx-16,46,cx-24,58],
     [cx+12,30,cx+20,42,cx+14,56]
    ].forEach(pts => {
      ctx.beginPath();
      ctx.moveTo(pts[0],pts[1]);
      for (let i=2;i<pts.length;i+=2) ctx.lineTo(pts[i],pts[i+1]);
      ctx.stroke();
    });
    ctx.restore();
  }

  _drawSpine() {
    const {ctx, cx, color, t} = this;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.2;
    ctx.globalAlpha = 0.35;
    ctx.setLineDash([5,4]);
    ctx.beginPath();
    ctx.moveTo(cx,85);
    for (let y=90;y<=275;y+=8) {
      ctx.lineTo(cx + Math.sin(t*0.8+y*0.05)*1.5, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  _drawEdges() {
    const {ctx, color, t} = this;
    this.edges.forEach(([a,b], i) => {
      const na = this.nodes[a], nb = this.nodes[b];
      const pulse = Math.sin(t*1.8 + i*0.6)*0.5+0.5;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth   = 0.6;
      ctx.globalAlpha = 0.08 + 0.14 * pulse;
      ctx.beginPath(); ctx.moveTo(na.x,na.y); ctx.lineTo(nb.x,nb.y); ctx.stroke();
      ctx.restore();
    });
  }

  _drawSignalPulses() {
    const {ctx, color} = this;
    this.pulses.forEach((p, i) => {
      p.t = (p.t + p.speed) % 1;
      const [a,b] = this.edges[i];
      const na = this.nodes[a], nb = this.nodes[b];
      const px = na.x + (nb.x-na.x)*p.t;
      const py = na.y + (nb.y-na.y)*p.t;
      const fade = 1 - Math.abs(p.t*2-1);
      ctx.save();
      ctx.fillStyle   = color;
      ctx.globalAlpha = fade * 0.85;
      ctx.shadowBlur  = 8;
      ctx.shadowColor = color;
      ctx.beginPath(); ctx.arc(px,py,2,0,Math.PI*2); ctx.fill();
      ctx.restore();
    });
  }

  _drawNodes() {
    const {ctx, color, t} = this;
    this.nodes.forEach((n,i) => {
      const pulse = Math.sin(t*1.4+i*0.9)*0.5+0.5;
      ctx.save();
      ctx.fillStyle   = color;
      ctx.globalAlpha = 0.25 + 0.5*pulse;
      ctx.shadowBlur  = n.r*5;
      ctx.shadowColor = color;
      ctx.beginPath(); ctx.arc(n.x,n.y,n.r*(0.8+0.2*pulse),0,Math.PI*2); ctx.fill();
      ctx.restore();
    });
  }

  _drawParticles() {
    const {ctx, color, t} = this;
    this.particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x<0||p.x>this.W) p.vx*=-1;
      if (p.y<0||p.y>this.H) p.vy*=-1;
      const a = 0.15 + 0.2*Math.sin(t*2+p.phase);
      ctx.save();
      ctx.fillStyle   = color;
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
      ctx.restore();
    });
  }

  _drawLabel() {
    const {ctx, cx, color, decision} = this;
    ctx.save();
    ctx.font      = 'bold 9px "JetBrains Mono",monospace';
    ctx.textAlign = 'center';

    if (decision === 'KEEP') {
      ctx.fillStyle   = '#00ff88'; ctx.globalAlpha = 0.85;
      ctx.fillText('CLEAN BRAIN SIGNALS', cx-72, 148);
      ctx.font = '8px "JetBrains Mono",monospace';
      ctx.fillText('after artifact removal', cx-72, 160);
    } else if (decision === 'REMOVE') {
      ctx.fillStyle   = '#ff3333'; ctx.globalAlpha = 0.9;
      ctx.fillText('ARTIFACT', cx+74, 112);
      ctx.fillText('COMPONENT', cx+74, 124);
      ctx.font = '8px "JetBrains Mono",monospace';
      ctx.fillStyle   = '#ff333399';
      ctx.fillText('to be removed', cx+74, 136);
    } else {
      ctx.fillStyle   = '#ffaa00'; ctx.globalAlpha = 0.8;
      ctx.fillText('UNDER REVIEW', cx, 460);
    }
    ctx.restore();
  }

  // ── Render loop ─────────────────────────────────────────
  draw() {
    const {ctx,W,H} = this;
    ctx.clearRect(0,0,W,H);
    this._drawBody();
    this._drawOutline();
    this._drawBrain();
    this._drawSpine();
    this._drawEdges();
    this._drawSignalPulses();
    this._drawNodes();
    this._drawParticles();
    this._drawLabel();
    this.t += 0.016;
  }

  start() {
    const loop = () => { this.draw(); this._raf = requestAnimationFrame(loop); };
    loop();
  }
  stop() { if (this._raf) cancelAnimationFrame(this._raf); }
}

window.NeuralBodyRenderer = NeuralBodyRenderer;
