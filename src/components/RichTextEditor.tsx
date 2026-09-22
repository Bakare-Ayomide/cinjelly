import React, { useRef, useState, useEffect } from 'react';
import { 
  Bold, Italic, Underline, Strikethrough, Heading1, Heading2, Heading3, 
  List, ListOrdered, Quote, Code, Link as LinkIcon, AlignLeft, 
  AlignCenter, AlignRight, AlignJustify, Eraser, Undo, Redo, 
  Minus, Code2, Eye, Palette
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

const COLOR_PRESETS = [
  { label: 'White', color: '#ffffff' },
  { label: 'Cinode Red', color: '#d31d38' },
  { label: 'Rose Light', color: '#ff4d64' },
  { label: 'Gold Amber', color: '#f59e0b' },
  { label: 'Emerald', color: '#10b981' },
  { label: 'Sky Blue', color: '#0ea5e9' },
  { label: 'Muted Slate', color: '#94a3b8' },
  { label: 'Soft Gray', color: '#cfc2c4' },
];

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write content here...',
  minHeight = '280px',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showLinkPrompt, setShowLinkPrompt] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [rawHtml, setRawHtml] = useState(value || '');

  // Keep editor content in sync with external value
  useEffect(() => {
    if (editorRef.current && !isHtmlMode) {
      if (editorRef.current.innerHTML !== (value || '')) {
        editorRef.current.innerHTML = value || '';
      }
    }
    setRawHtml(value || '');
  }, [value, isHtmlMode]);

  const exec = (command: string, arg?: string) => {
    if (isHtmlMode) return;
    document.execCommand(command, false, arg);
    if (editorRef.current) {
      const updated = editorRef.current.innerHTML;
      onChange(updated);
      setRawHtml(updated);
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      const updated = editorRef.current.innerHTML;
      onChange(updated);
      setRawHtml(updated);
    }
  };

  const handleRawHtmlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const updated = e.target.value;
    setRawHtml(updated);
    onChange(updated);
  };

  const applyLink = () => {
    if (!linkUrl) return;
    let formatted = linkUrl;
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://') && !formatted.startsWith('#') && !formatted.startsWith('mailto:')) {
      formatted = 'https://' + formatted;
    }
    exec('createLink', formatted);
    setLinkUrl('');
    setShowLinkPrompt(false);
  };

  const applyColor = (color: string) => {
    exec('foreColor', color);
    setShowColorPicker(false);
  };

  return (
    <div className="border border-[#2e1015] rounded-2xl bg-[#120507] overflow-hidden shadow-xl">
      {/* Toolbar */}
      <div className="bg-[#180608] border-b border-[#2e1015] p-2.5 flex flex-wrap items-center gap-1.5 select-none">
        
        {/* History */}
        <div className="flex items-center gap-1 pr-1.5 border-r border-[#2e1015]">
          <button
            type="button"
            onClick={() => exec('undo')}
            disabled={isHtmlMode}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#240a0e] transition disabled:opacity-30 cursor-pointer"
            title="Undo"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => exec('redo')}
            disabled={isHtmlMode}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#240a0e] transition disabled:opacity-30 cursor-pointer"
            title="Redo"
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>

        {/* Text formatting */}
        <div className="flex items-center gap-1 pr-1.5 border-r border-[#2e1015]">
          <button
            type="button"
            onClick={() => exec('bold')}
            disabled={isHtmlMode}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#240a0e] transition disabled:opacity-30 cursor-pointer font-bold"
            title="Bold (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => exec('italic')}
            disabled={isHtmlMode}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#240a0e] transition disabled:opacity-30 cursor-pointer"
            title="Italic (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => exec('underline')}
            disabled={isHtmlMode}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#240a0e] transition disabled:opacity-30 cursor-pointer"
            title="Underline (Ctrl+U)"
          >
            <Underline className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => exec('strikeThrough')}
            disabled={isHtmlMode}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#240a0e] transition disabled:opacity-30 cursor-pointer"
            title="Strikethrough"
          >
            <Strikethrough className="w-4 h-4" />
          </button>
        </div>

        {/* Headings */}
        <div className="flex items-center gap-1 pr-1.5 border-r border-[#2e1015]">
          <button
            type="button"
            onClick={() => exec('formatBlock', '<h1>')}
            disabled={isHtmlMode}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#240a0e] transition disabled:opacity-30 cursor-pointer text-xs font-bold"
            title="Heading 1"
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => exec('formatBlock', '<h2>')}
            disabled={isHtmlMode}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#240a0e] transition disabled:opacity-30 cursor-pointer text-xs font-bold"
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => exec('formatBlock', '<h3>')}
            disabled={isHtmlMode}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#240a0e] transition disabled:opacity-30 cursor-pointer text-xs font-bold"
            title="Heading 3"
          >
            <Heading3 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => exec('formatBlock', '<p>')}
            disabled={isHtmlMode}
            className="px-2 py-1 rounded-lg text-zinc-400 hover:text-white hover:bg-[#240a0e] transition disabled:opacity-30 cursor-pointer text-[11px] font-bold"
            title="Paragraph"
          >
            ¶ Normal
          </button>
        </div>

        {/* Lists & Alignment */}
        <div className="flex items-center gap-1 pr-1.5 border-r border-[#2e1015]">
          <button
            type="button"
            onClick={() => exec('insertUnorderedList')}
            disabled={isHtmlMode}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#240a0e] transition disabled:opacity-30 cursor-pointer"
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => exec('insertOrderedList')}
            disabled={isHtmlMode}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#240a0e] transition disabled:opacity-30 cursor-pointer"
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => exec('justifyLeft')}
            disabled={isHtmlMode}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#240a0e] transition disabled:opacity-30 cursor-pointer"
            title="Align Left"
          >
            <AlignLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => exec('justifyCenter')}
            disabled={isHtmlMode}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#240a0e] transition disabled:opacity-30 cursor-pointer"
            title="Align Center"
          >
            <AlignCenter className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => exec('justifyRight')}
            disabled={isHtmlMode}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#240a0e] transition disabled:opacity-30 cursor-pointer"
            title="Align Right"
          >
            <AlignRight className="w-4 h-4" />
          </button>
        </div>

        {/* Special elements */}
        <div className="flex items-center gap-1 pr-1.5 border-r border-[#2e1015] relative">
          <button
            type="button"
            onClick={() => exec('formatBlock', '<blockquote>')}
            disabled={isHtmlMode}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#240a0e] transition disabled:opacity-30 cursor-pointer"
            title="Blockquote"
          >
            <Quote className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => exec('insertHorizontalRule')}
            disabled={isHtmlMode}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#240a0e] transition disabled:opacity-30 cursor-pointer"
            title="Divider Line"
          >
            <Minus className="w-4 h-4" />
          </button>

          {/* Color palette */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColorPicker(!showColorPicker)}
              disabled={isHtmlMode}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-[#240a0e] transition disabled:opacity-30 cursor-pointer flex items-center gap-1"
              title="Text Color"
            >
              <Palette className="w-4 h-4" />
            </button>

            {showColorPicker && (
              <div className="absolute top-full left-0 mt-2 z-30 bg-[#180608] border border-[#2e1015] rounded-xl p-2.5 shadow-2xl flex flex-col gap-1 w-40">
                <span className="text-[10px] font-bold uppercase text-zinc-400 mb-1">Select Text Color</span>
                {COLOR_PRESETS.map((p) => (
                  <button
                    key={p.color}
                    type="button"
                    onClick={() => applyColor(p.color)}
                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#240a0e] text-xs font-semibold text-left transition cursor-pointer"
                  >
                    <span className="w-3.5 h-3.5 rounded-full border border-black/40 shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-zinc-300">{p.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Link button */}
          <button
            type="button"
            onClick={() => setShowLinkPrompt(!showLinkPrompt)}
            disabled={isHtmlMode}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-sky-400 hover:bg-[#240a0e] transition disabled:opacity-30 cursor-pointer"
            title="Insert Link"
          >
            <LinkIcon className="w-4 h-4" />
          </button>

          {showLinkPrompt && (
            <div className="absolute top-full left-0 mt-2 z-30 bg-[#180608] border border-[#2e1015] rounded-xl p-3 shadow-2xl flex flex-col gap-2 w-64">
              <span className="text-[10px] font-bold uppercase text-zinc-400">Insert URL Link</span>
              <input
                type="text"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="w-full bg-[#0d0304] border border-[#2e1015] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#d31d38]"
              />
              <div className="flex justify-end gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setShowLinkPrompt(false)}
                  className="text-[11px] px-2.5 py-1 text-zinc-400 hover:text-white rounded"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyLink}
                  className="text-[11px] px-3 py-1 bg-[#d31d38] hover:bg-[#b0162c] text-white font-bold rounded cursor-pointer"
                >
                  Add Link
                </button>
              </div>
            </div>
          )}

          {/* Clear Format */}
          <button
            type="button"
            onClick={() => exec('removeFormat')}
            disabled={isHtmlMode}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#240a0e] transition disabled:opacity-30 cursor-pointer"
            title="Clear Formatting"
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        {/* View Mode Toggle: WYSIWYG vs HTML */}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsHtmlMode(!isHtmlMode)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              isHtmlMode 
                ? 'bg-[#d31d38] text-white shadow-[0_0_12px_rgba(211,29,56,0.4)]' 
                : 'bg-[#240a0e] text-zinc-300 hover:text-white border border-[#2e1015]'
            }`}
          >
            {isHtmlMode ? (
              <>
                <Eye className="w-3.5 h-3.5" /> Visual Editor
              </>
            ) : (
              <>
                <Code2 className="w-3.5 h-3.5 text-[#ff4d64]" /> HTML Source
              </>
            )}
          </button>
        </div>

      </div>

      {/* Editor Body */}
      <div className="p-4 bg-[#0e0405] relative">
        {isHtmlMode ? (
          <textarea
            value={rawHtml}
            onChange={handleRawHtmlChange}
            placeholder="<p>Write raw HTML here...</p>"
            style={{ minHeight }}
            className="w-full bg-[#080203] border border-[#2e1015] rounded-xl p-4 font-mono text-xs text-zinc-200 focus:outline-none focus:border-[#d31d38] leading-relaxed resize-y"
          />
        ) : (
          <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            onBlur={handleInput}
            style={{ minHeight }}
            data-placeholder={placeholder}
            className="w-full text-zinc-200 text-sm leading-relaxed focus:outline-none overflow-y-auto rich-text-content"
          />
        )}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 bg-[#120507] border-t border-[#2e1015] flex items-center justify-between text-[10px] text-zinc-500 font-mono">
        <span>Rich Text WYSIWYG &bull; HTML5 Output</span>
        <span>{rawHtml.length} characters</span>
      </div>
    </div>
  );
}
