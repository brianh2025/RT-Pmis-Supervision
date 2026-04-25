import React, { useEffect, useRef } from 'react';

const PARTICLE_COUNT = 55;
const MAX_DIST = 130;
const REPEL_RADIUS = 90;
const REPEL_FORCE  = 2.5;

function randomBetween(a, b) { return a + Math.random() * (b - a); }

export function ParticleCanvas() {
  const canvasRef = useRef(null);
  const mouse = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let w = canvas.offsetWidth;
    let h = canvas.offsetHeight;
    canvas.width  = w;
    canvas.height = h;

    // 粒子初始化
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x:  randomBetween(0, w),
      y:  randomBetween(0, h),
      vx: randomBetween(-0.35, 0.35),
      vy: randomBetween(-0.35, 0.35),
      r:  randomBetween(1.5, 3),
    }));

    const section = canvas.closest('section') || canvas.parentElement;
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const handleMouseLeave = () => { mouse.current = { x: -9999, y: -9999 }; };
    section.addEventListener('mousemove', handleMouseMove);
    section.addEventListener('mouseleave', handleMouseLeave);

    // 主色（從 CSS variable 讀取，解析為 RGB 使用 rgba()）
    const style = getComputedStyle(document.documentElement);
    const raw = style.getPropertyValue('--color-primary').trim() || '#1565C0';
    let r = 21, g = 101, b = 192;
    const hexM = raw.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (hexM) { r = parseInt(hexM[1], 16); g = parseInt(hexM[2], 16); b = parseInt(hexM[3], 16); }
    else { const rgbM = raw.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/); if (rgbM) { r = +rgbM[1]; g = +rgbM[2]; b = +rgbM[3]; } }
    const color = (a) => `rgba(${r},${g},${b},${a})`;
    const isDark   = document.documentElement.classList.contains('dark');
    const baseAlpha = isDark ? 0.7 : 0.5;

    let rafId;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // 更新粒子位置（含滑鼠排斥）
      particles.forEach(p => {
        const dx = p.x - mouse.current.x;
        const dy = p.y - mouse.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < REPEL_RADIUS && dist > 0) {
          const force = (REPEL_RADIUS - dist) / REPEL_RADIUS * REPEL_FORCE;
          p.vx += (dx / dist) * force * 0.06;
          p.vy += (dy / dist) * force * 0.06;
        }
        // 速度阻尼（緩慢回到正常速度）
        p.vx *= 0.98;
        p.vy *= 0.98;
        // 最小速度保持漂移感
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed < 0.1) { p.vx += randomBetween(-0.05, 0.05); p.vy += randomBetween(-0.05, 0.05); }

        p.x += p.vx;
        p.y += p.vy;
        // 邊界反彈
        if (p.x < 0)  { p.x = 0;  p.vx =  Math.abs(p.vx); }
        if (p.x > w)  { p.x = w;  p.vx = -Math.abs(p.vx); }
        if (p.y < 0)  { p.y = 0;  p.vy =  Math.abs(p.vy); }
        if (p.y > h)  { p.y = h;  p.vy = -Math.abs(p.vy); }
      });

      // 繪製連線
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < MAX_DIST) {
            const alpha = (1 - d / MAX_DIST) * baseAlpha * 0.6;
            ctx.strokeStyle = color(alpha.toFixed(3));
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // 繪製粒子
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = color(baseAlpha.toFixed(3));
        ctx.fill();
      });

      rafId = requestAnimationFrame(draw);
    };

    draw();

    // 視窗大小改變
    const handleResize = () => {
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width  = w;
      canvas.height = h;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      section.removeEventListener('mousemove', handleMouseMove);
      section.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
