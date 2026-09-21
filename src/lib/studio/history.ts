import { create } from 'zustand';

export interface HistoryCommand {
  execute: () => void;
  undo: () => void;
  label?: string;
}

interface HistoryStore {
  undoStack: HistoryCommand[];
  redoStack: HistoryCommand[];
  maxHistory: number;
  canUndo: boolean;
  canRedo: boolean;
  push: (cmd: HistoryCommand) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  undoStack: [],
  redoStack: [],
  maxHistory: 50,
  canUndo: false,
  canRedo: false,

  push: (cmd) => {
    cmd.execute();
    set((s) => {
      const stack = [...s.undoStack, cmd];
      if (stack.length > s.maxHistory) stack.shift();
      return { undoStack: stack, redoStack: [], canUndo: true, canRedo: false };
    });
  },

  undo: () => {
    const { undoStack, redoStack } = get();
    if (undoStack.length === 0) return;
    const cmd = undoStack[undoStack.length - 1];
    cmd.undo();
    const newUndoStack = undoStack.slice(0, -1);
    set({
      undoStack: newUndoStack,
      redoStack: [...redoStack, cmd],
      canUndo: newUndoStack.length > 0,
      canRedo: true,
    });
  },

  redo: () => {
    const { undoStack, redoStack } = get();
    if (redoStack.length === 0) return;
    const cmd = redoStack[redoStack.length - 1];
    cmd.execute();
    const newRedoStack = redoStack.slice(0, -1);
    set({
      undoStack: [...undoStack, cmd],
      redoStack: newRedoStack,
      canUndo: true,
      canRedo: newRedoStack.length > 0,
    });
  },

  clear: () => set({ undoStack: [], redoStack: [], canUndo: false, canRedo: false }),
}));
