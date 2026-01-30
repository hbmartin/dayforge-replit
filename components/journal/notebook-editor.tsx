'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '@/lib/utils';
import { createOfflineEntry, listOfflineEntries } from '@/lib/offline/entries';
import { createOfflineMessage, listOfflineMessages } from '@/lib/offline/messages';
import { format } from 'date-fns';
import { useJournalUser } from '@/hooks/use-journal-user';

const IDLE_DELAY = 3000;

interface MeltingQuestion {
  id: string;
  text: string;
  opacity: number;
}

export function NotebookEditor() {
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  const [meltingQuestion, setMeltingQuestion] = useState<MeltingQuestion | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { userId } = useJournalUser();

  const entries = useLiveQuery(
    () => listOfflineEntries(userId, { mode: 'notebook', limit: 10 }),
    []
  );

  const currentEntry = entries?.[0];

  const messages = useLiveQuery(
    () => currentEntryId ? listOfflineMessages(currentEntryId) : Promise.resolve([]),
    [currentEntryId]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-stone dark:prose-invert prose-lg max-w-none focus:outline-none min-h-[200px] px-8 py-6',
      },
    },
    onUpdate: ({ editor }) => {
      handleTyping(editor.getHTML());
    },
  });

  const handleTyping = useCallback((content: string) => {
    setIsTyping(true);
    setMeltingQuestion(null);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(async () => {
      setIsTyping(false);
      
      if (content && content !== '<p></p>') {
        let entryId = currentEntryId;
        
        if (!entryId) {
          const entry = await createOfflineEntry(userId, 'notebook');
          entryId = entry.id;
          setCurrentEntryId(entryId);
        }

        await createOfflineMessage(entryId, content, 'user', 'text');

        if (questionTimeoutRef.current) {
          clearTimeout(questionTimeoutRef.current);
        }

        questionTimeoutRef.current = setTimeout(() => {
          showMeltingQuestion();
        }, 5000);
      }
    }, IDLE_DELAY);
  }, [currentEntryId]);

  const showMeltingQuestion = useCallback(() => {
    const questions = [
      "What's making this feel important right now?",
      "If you could change one thing about this, what would it be?",
      "What would 'good enough' look like here?",
      "What's the smallest next step you could take?",
      "How do you want to feel about this tomorrow?",
      "What would you tell a friend in this situation?",
      "What's the real obstacle here?",
      "What are you grateful for today?",
    ];

    const randomQuestion = questions[Math.floor(Math.random() * questions.length)] ?? "What's on your mind?";
    
    setMeltingQuestion({
      id: Date.now().toString(),
      text: randomQuestion,
      opacity: 0,
    });

    setTimeout(() => {
      setMeltingQuestion(prev => prev ? { ...prev, opacity: 1 } : null);
    }, 100);
  }, []);

  const dismissQuestion = useCallback(() => {
    setMeltingQuestion(null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        dismissQuestion();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dismissQuestion]);

  useEffect(() => {
    if (currentEntry) {
      setCurrentEntryId(currentEntry.id);
    }
  }, [currentEntry]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (questionTimeoutRef.current) clearTimeout(questionTimeoutRef.current);
    };
  }, []);

  const today = format(new Date(), 'EEEE, MMMM d, yyyy');

  return (
    <div className="h-full flex flex-col bg-amber-50 dark:bg-stone-950">
      <header className="px-8 py-4 border-b border-amber-200/50 dark:border-stone-800/50">
        <time className="text-sm text-stone-500 dark:text-stone-400 font-medium">
          {today}
        </time>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-8">
          {messages && messages.length > 0 && (
            <div className="mb-8 space-y-4 px-8">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'prose prose-stone dark:prose-invert prose-lg max-w-none',
                    msg.role === 'assistant' && 'text-amber-700 dark:text-amber-400 italic'
                  )}
                  dangerouslySetInnerHTML={{ __html: msg.content }}
                />
              ))}
            </div>
          )}

          <div className="relative">
            <EditorContent editor={editor} />

            {meltingQuestion && (
              <div
                className={cn(
                  'absolute left-8 right-8 mt-4 p-4 bg-amber-100/80 dark:bg-stone-800/80 rounded-lg border border-amber-200 dark:border-stone-700 transition-opacity duration-1000',
                )}
                style={{ opacity: meltingQuestion.opacity }}
                onClick={dismissQuestion}
              >
                <p className="text-stone-600 dark:text-stone-300 font-serif italic">
                  {meltingQuestion.text}
                </p>
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-2">
                  Press Escape or click to dismiss
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="px-8 py-3 border-t border-amber-200/50 dark:border-stone-800/50 flex items-center justify-between text-xs text-stone-400 dark:text-stone-500">
        <span>
          {isTyping ? 'Writing...' : 'Ready'}
        </span>
        <span>
          {messages?.length || 0} message{messages?.length !== 1 ? 's' : ''}
        </span>
      </footer>
    </div>
  );
}
