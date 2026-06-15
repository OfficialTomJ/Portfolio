"use client";

import ReactMarkdown from "react-markdown";

// Renders a lesson outline. Styling comes from the .bp-prose rules in mentor.css.
export default function MarkdownOutline({ markdown }: { markdown: string }) {
  return (
    <div className="bp-prose">
      <ReactMarkdown
        components={{
          a: ({ node, ...props }) => (
            <a target="_blank" rel="noopener noreferrer" {...props} />
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
