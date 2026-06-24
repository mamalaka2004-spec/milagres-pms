"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

// Dependency-free emoji picker (categories + search + recents in localStorage),
// modelled on the MF OS Support picker. Keeps the bundle light (no emoji-mart).
const CATEGORIES: { id: string; label: string; emojis: string[] }[] = [
  {
    id: "smileys",
    label: "Rostos",
    emojis: "😀 😃 😄 😁 😆 😅 😂 🤣 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 😐 😑 😶 😏 😒 🙄 😬 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤧 🥵 🥶 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬".split(" "),
  },
  {
    id: "gestures",
    label: "Gestos",
    emojis: "👍 👎 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤝 🙏 ✍️ 💪 🦵 👏 🙌 👐 🤲 🤜 🤛 ✊ 👊".split(" "),
  },
  {
    id: "hearts",
    label: "Corações",
    emojis: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ✨ ⭐ 🌟 💫 🔥 🎉 🎊 ✅ ❌ ⚠️ ❓ ❗ 💯".split(" "),
  },
  {
    id: "people",
    label: "Pessoas",
    emojis: "👶 🧒 👦 👧 🧑 👨 👩 🧓 👴 👵 🧔 👮 🕵️ 💂 👷 🤴 👸 👰 🤵 🦸 🦹 🧙 🧚 🧛 👼 🎅 🤶 🙋 🙆 🙅 💁 🙎 🙍 💇 💆 🚶 🏃 💃 🕺 👯".split(" "),
  },
  {
    id: "animals",
    label: "Bichos",
    emojis: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐢 🐍 🐙 🦀 🐠 🐟 🐬 🐳 🐋 🦈".split(" "),
  },
  {
    id: "food",
    label: "Comida",
    emojis: "🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🥦 🌽 🥕 🍞 🧀 🍗 🍖 🍔 🍟 🍕 🌭 🌮 🌯 🥗 🍝 🍜 🍣 🍱 🍦 🍰 🎂 🍫 🍬 🍭 🍩 🍪 ☕ 🍺 🍷 🥂 🍹".split(" "),
  },
  {
    id: "travel",
    label: "Lugares",
    emojis: "🏖️ 🏝️ 🏔️ ⛰️ 🌋 🏕️ 🏡 🏠 🏘️ 🏨 🏩 🏬 🏛️ ⛪ 🕌 🛏️ 🚪 🔑 🗝️ 🚗 🚕 🚙 🚌 🏍️ 🛵 ✈️ 🚀 ⛵ 🛳️ ⚓ 🌴 🌊 🌅 🌄 🌇 🌃 🎡 🎢".split(" "),
  },
  {
    id: "objects",
    label: "Objetos",
    emojis: "📱 💻 ⌨️ 🖥️ 🖨️ 📷 📸 🎥 📞 ☎️ 📟 📠 🔋 💡 🔦 💸 💵 💰 💳 🧾 📅 📆 📌 📎 ✂️ 📝 ✏️ 🔒 🔓 🔔 📣 📢 ⏰ ⏳ 🎁 🎈 🧳 🛒".split(" "),
  },
  {
    id: "symbols",
    label: "Símbolos",
    emojis: "💬 💭 🗯️ ♻️ ✔️ ☑️ 🔘 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 ➕ ➖ ✖️ ➗ 🔝 🔜 🆗 🆕 🆓 ©️ ®️ ™️ 🔇 🔊 🎵 🎶 ⭕ 🚫 ⛔ 🔚 🔛 🔙".split(" "),
  },
];

const RECENT_KEY = "milagres-emoji-recents";

function getRecents(): string[] {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(RECENT_KEY) : null;
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
function pushRecent(e: string) {
  try {
    const next = [e, ...getRecents().filter((x) => x !== e)].slice(0, 24);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [q, setQ] = useState("");
  const [recents] = useState<string[]>(() => getRecents());

  const pick = (e: string) => {
    pushRecent(e);
    onSelect(e);
  };

  // Search just flattens everything (emoji have no names here, so search ≈ "show all")
  const sections = useMemo(() => {
    const base = recents.length ? [{ id: "recent", label: "Recentes", emojis: recents }, ...CATEGORIES] : CATEGORIES;
    return base;
  }, [recents]);

  const filtered = q.trim()
    ? [{ id: "all", label: "Todos", emojis: CATEGORIES.flatMap((c) => c.emojis) }]
    : sections;

  return (
    <div className="w-64">
      <div className="relative mb-2">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar emoji"
          placeholder="Buscar…"
          className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        />
      </div>
      <div className="max-h-56 overflow-y-auto scrollbar-thin pr-1">
        {filtered.map((cat) => (
          <div key={cat.id} className="mb-1.5">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold px-1 mb-0.5">{cat.label}</div>
            <div className="grid grid-cols-8 gap-0.5">
              {cat.emojis.map((e, i) => (
                <button
                  key={`${cat.id}-${i}`}
                  type="button"
                  onClick={() => pick(e)}
                  className="text-lg leading-none p-1 rounded hover:bg-gray-100 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
                  aria-label={`Emoji ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
