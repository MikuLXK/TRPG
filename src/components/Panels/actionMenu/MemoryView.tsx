import MemoryReviewPanel from '../MemoryReviewPanel';
import type { 记忆压缩任务, 记忆系统结构 } from '../../../types/gameData';

interface MemoryViewProps {
  memorySystem: 记忆系统结构;
  memoryPendingTask: 记忆压缩任务 | null;
  memorySummaryStage: 'idle' | 'remind' | 'processing' | 'review';
  onOpenMemorySummary: () => void;
}

export default function MemoryView({
  memorySystem,
  memoryPendingTask,
  memorySummaryStage,
  onOpenMemorySummary
}: MemoryViewProps) {
  return (
    <MemoryReviewPanel
      memorySystem={memorySystem}
      pendingTask={memoryPendingTask}
      summaryStage={memorySummaryStage}
      onOpenSummary={onOpenMemorySummary}
    />
  );
}
