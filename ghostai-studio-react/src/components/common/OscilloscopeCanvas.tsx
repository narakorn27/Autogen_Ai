import { useEffect, useRef } from "react";

type OscilloscopeCanvasProps = {
  active?: boolean;
  color?: string;
  intensity?: number;
  className?: string;
};

export default function OscilloscopeCanvas({
  active = true,
  color = "#22c55e",
  intensity = 1,
  className
}: OscilloscopeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, rect.width * dpr);
      canvas.height = Math.max(1, rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    let frame = 0;
    let animationId = 0;
    const draw = () => {
      frame += 1;
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);
      ctx.fillStyle = "rgba(5,5,5,0.22)";
      ctx.fillRect(0, 0, width, height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.shadowBlur = active ? 14 : 4;
      ctx.shadowColor = color;
      ctx.beginPath();

      for (let x = 0; x < width; x += 3) {
        const wave = Math.sin((x + frame * 3) / 22) * 18 * intensity;
        const noise = (Math.random() - 0.5) * (active ? 28 : 10) * intensity;
        const y = height / 2 + wave + noise;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.stroke();
      ctx.shadowBlur = 0;
      animationId = window.requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, [active, color, intensity]);

  return <canvas ref={canvasRef} className={className} />;
}
