import React, { useState } from 'react';
import { Terminal, Send, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

interface LogEntry {
  id: string;
  time: string;
  command: string;
  response?: string | null;
  success: boolean;
}

interface CommandConsoleProps {
  onSendCommand: (cmd: string) => Promise<{ success: boolean; message: string; response?: string | null }>;
  isLoading: boolean;
}

const COMMON_COMMANDS = [
  { label: '?V (Volume)', cmd: '?V' },
  { label: '?P (Power)', cmd: '?P' },
  { label: '?F (Input)', cmd: '?F' },
  { label: '?M (Mute)', cmd: '?M' },
  { label: 'VU (Vol +)', cmd: 'VU' },
  { label: 'VD (Vol -)', cmd: 'VD' },
];

export const CommandConsole: React.FC<CommandConsoleProps> = ({ onSendCommand, isLoading }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [command, setCommand] = useState<string>('');
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const handleSend = async (cmdToSend?: string) => {
    const target = (cmdToSend || command).trim();
    if (!target) return;

    triggerHaptic('medium');
    const now = new Date().toLocaleTimeString();

    try {
      const res = await onSendCommand(target);
      const newEntry: LogEntry = {
        id: Math.random().toString(36).substring(7),
        time: now,
        command: target,
        response: res.response || res.message,
        success: res.success,
      };
      setLogs((prev) => [newEntry, ...prev].slice(0, 30));
      if (!cmdToSend) setCommand('');
    } catch (err: any) {
      const newEntry: LogEntry = {
        id: Math.random().toString(36).substring(7),
        time: now,
        command: target,
        response: err.message || 'Error executing command',
        success: false,
      };
      setLogs((prev) => [newEntry, ...prev].slice(0, 30));
    }
  };

  const handleToggle = () => {
    triggerHaptic('light');
    setIsOpen(!isOpen);
  };

  return (
    <div className="bg-receiver-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl transition-all">
      {/* Accordion Toggle Header */}
      <button
        onClick={handleToggle}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center space-x-2.5">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-display">
            Telnet Command Terminal
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Expanded Console Body */}
      {isOpen && (
        <div className="p-4 pt-0 border-t border-slate-800/80 space-y-3">
          {/* Quick Macro Chips */}
          <div className="flex flex-wrap gap-1.5 pt-3">
            {COMMON_COMMANDS.map((item) => (
              <button
                key={item.cmd}
                onClick={() => handleSend(item.cmd)}
                disabled={isLoading}
                className="px-2.5 py-1 rounded-lg bg-receiver-800 border border-slate-700/60 text-[11px] font-mono text-cyan-300 hover:border-cyan-500/40 active:scale-95 transition-all"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Command Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex space-x-2"
          >
            <input
              type="text"
              placeholder="e.g. ?V, PO, PF, 04FN, etc."
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-xl bg-receiver-950 border border-slate-700 text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
            />
            <button
              type="submit"
              disabled={isLoading || !command.trim()}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow-glow-cyan disabled:opacity-40 transition-all flex items-center space-x-1"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>

          {/* Log Window */}
          <div className="mt-3 bg-receiver-950 border border-slate-800 rounded-xl p-3 min-h-[120px] max-h-[180px] overflow-y-auto font-mono text-[11px] space-y-1.5 scrollbar-thin">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-[10px] text-slate-500 uppercase">
              <span>Terminal Log</span>
              {logs.length > 0 && (
                <button
                  onClick={() => setLogs([])}
                  className="hover:text-rose-400 flex items-center space-x-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {logs.length === 0 ? (
              <div className="text-slate-600 text-center py-4">No command activity yet</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start space-x-2">
                  <span className="text-slate-500 shrink-0">[{log.time}]</span>
                  <span className="text-cyan-400 font-semibold shrink-0">&gt; {log.command}</span>
                  <span className={`truncate ${log.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                    &larr; {log.response || '(no response)'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
