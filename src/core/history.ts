// 撤销/重做：基于 Uint8Array(52*52) 快照

export const MAX_HISTORY = 50;

export class HistoryStack {
  private stack: Uint8Array[] = [];
  private index = -1;

  push(grid: Uint8Array) {
    // 丢弃当前索引之后的所有记录
    if (this.index < this.stack.length - 1) {
      this.stack = this.stack.slice(0, this.index + 1);
    }
    // 拷贝一份，避免引用共享
    this.stack.push(new Uint8Array(grid));
    if (this.stack.length > MAX_HISTORY) {
      this.stack.shift();
    } else {
      this.index++;
    }
  }

  undo(current: Uint8Array): Uint8Array | null {
    if (this.index <= 0) return null;
    this.index--;
    return new Uint8Array(this.stack[this.index]);
  }

  redo(current: Uint8Array): Uint8Array | null {
    if (this.index >= this.stack.length - 1) return null;
    this.index++;
    return new Uint8Array(this.stack[this.index]);
  }

  canUndo(): boolean {
    return this.index > 0;
  }

  canRedo(): boolean {
    return this.index < this.stack.length - 1;
  }

  clear() {
    this.stack = [];
    this.index = -1;
  }

  init(grid: Uint8Array) {
    this.clear();
    this.stack.push(new Uint8Array(grid));
    this.index = 0;
  }
}
