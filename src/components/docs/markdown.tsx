import * as React from "react";

/**
 * Renderizador de Markdown MÍNIMO e dependency-free (#24). Suporta títulos
 * (#, ##, ###), parágrafos, listas (- / *), listas numeradas, blocos de código
 * (```), e inline **negrito** + `código`. Seguro: monta JSX, sem
 * dangerouslySetInnerHTML. Conteúdo vem de fontes internas confiáveis.
 */

/** Aplica **negrito** e `código` inline dentro de um trecho de texto. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Divide mantendo os delimitadores **...** e `...`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  parts.forEach((part, i) => {
    if (!part) return;
    if (part.startsWith("**") && part.endsWith("**")) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${i}`} className="font-semibold text-gray-900">
          {part.slice(2, -2)}
        </strong>
      );
    } else if (part.startsWith("`") && part.endsWith("`")) {
      nodes.push(
        <code
          key={`${keyPrefix}-c-${i}`}
          className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[0.85em] text-brand-700"
        >
          {part.slice(1, -1)}
        </code>
      );
    } else {
      nodes.push(<React.Fragment key={`${keyPrefix}-t-${i}`}>{part}</React.Fragment>);
    }
  });
  return nodes;
}

export function Markdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];

  let i = 0;
  let key = 0;
  const nextKey = () => `md-${key++}`;

  while (i < lines.length) {
    const line = lines[i];

    // Bloco de código ```
    if (line.trim().startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code.push(lines[i]);
        i++;
      }
      i++; // pula o ``` de fechamento
      blocks.push(
        <pre
          key={nextKey()}
          className="my-4 overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs leading-relaxed text-gray-100"
        >
          <code className="font-mono">{code.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Títulos
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = h[2];
      if (level === 1) {
        blocks.push(
          <h2 key={nextKey()} className="mb-3 mt-8 font-heading text-2xl font-normal text-gray-900 first:mt-0">
            {renderInline(text, nextKey())}
          </h2>
        );
      } else if (level === 2) {
        blocks.push(
          <h3 key={nextKey()} className="mb-2 mt-6 text-base font-bold text-gray-900">
            {renderInline(text, nextKey())}
          </h3>
        );
      } else {
        blocks.push(
          <h4 key={nextKey()} className="mb-1.5 mt-4 text-sm font-semibold uppercase tracking-wider text-brand-600">
            {renderInline(text, nextKey())}
          </h4>
        );
      }
      i++;
      continue;
    }

    // Lista não ordenada
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={nextKey()} className="my-3 space-y-1.5 pl-1">
          {items.map((it, idx) => (
            <li key={idx} className="flex gap-2 text-sm leading-relaxed text-gray-600">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden="true" />
              <span>{renderInline(it, `${nextKey()}-${idx}`)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Lista numerada
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={nextKey()} className="my-3 list-decimal space-y-1.5 pl-6 text-sm leading-relaxed text-gray-600 marker:text-brand-400 marker:font-semibold">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `${nextKey()}-${idx}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Linha em branco
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Parágrafo (junta linhas até a próxima em branco/estrutura)
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !lines[i].trim().startsWith("```")
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={nextKey()} className="my-3 text-sm leading-relaxed text-gray-600">
        {renderInline(para.join(" "), nextKey())}
      </p>
    );
  }

  return <div className="max-w-none">{blocks}</div>;
}
