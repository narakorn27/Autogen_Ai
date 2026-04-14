import { useEffect, useState } from "react";

const WHISPERS = ["...ยังอยู่ไหม...", "...มองอะไร...", "...อยู่ข้างหลัง..."];

export default function GhostOverlay() {
  const [idleText, setIdleText] = useState("");
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let idleTimer = window.setTimeout(showIdleWhisper, 30000);

    function resetIdleTimer() {
      setIdleText("");
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(showIdleWhisper, 30000);
    }

    function showIdleWhisper() {
      setIdleText(WHISPERS[Math.floor(Math.random() * WHISPERS.length)]);
    }

    window.addEventListener("mousemove", resetIdleTimer);
    window.addEventListener("keypress", resetIdleTimer);
    window.addEventListener("ghostai:jumpscare", triggerJumpScare);

    function triggerJumpScare() {
      setFlash(true);
      document.body.style.filter = "contrast(150%) hue-rotate(90deg)";
      window.setTimeout(() => {
        setFlash(false);
        document.body.style.filter = "";
      }, 220);
    }

    return () => {
      window.clearTimeout(idleTimer);
      window.removeEventListener("mousemove", resetIdleTimer);
      window.removeEventListener("keypress", resetIdleTimer);
      window.removeEventListener("ghostai:jumpscare", triggerJumpScare);
      document.body.style.filter = "";
    };
  }, []);

  return (
    <>
      <div className={`jumpscare-overlay ${flash ? "visible" : ""}`} />
      <div className={`idle-ghost-text ${idleText ? "visible" : ""}`}>{idleText}</div>
    </>
  );
}

export function triggerGhostJumpScare() {
  window.dispatchEvent(new Event("ghostai:jumpscare"));
}
