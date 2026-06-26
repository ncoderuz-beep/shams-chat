const COLORS = [
  "oklch(0.7 0.18 30)", "oklch(0.7 0.18 80)", "oklch(0.7 0.18 140)",
  "oklch(0.7 0.18 200)", "oklch(0.7 0.18 260)", "oklch(0.7 0.18 320)",
];

export function Avatar({ name, src, size = 48, online }: { name: string; src?: string | null; size?: number; online?: boolean }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const colorIdx = (name?.charCodeAt(0) || 0) % COLORS.length;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt={name} className="w-full h-full rounded-full object-cover" />
      ) : (
        <div className="w-full h-full rounded-full flex items-center justify-center text-white font-semibold" style={{ background: COLORS[colorIdx], fontSize: size * 0.42 }}>
          {initial}
        </div>
      )}
      {online && (
        <span className="absolute bottom-0 right-0 block rounded-full bg-[color:var(--online)] border-2 border-[color:var(--sidebar-bg)]" style={{ width: size * 0.28, height: size * 0.28 }} />
      )}
    </div>
  );
}
