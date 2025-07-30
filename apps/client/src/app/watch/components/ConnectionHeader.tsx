interface ConnectionHeaderProps {
  connectionStatus: string;
  activeStreams: number;
  debugInfo: string;
  onRefresh: () => void;
  onPlayAll: () => void;
  onStopAll: () => void;
}
import { LayoutType } from "../../shared/types";

interface ConnectionHeaderProps {
  connectionStatus: string;
  activeStreams: number;
  debugInfo: string;
  onRefresh: () => void;
  onPlayAll: () => void;
  onStopAll: () => void;
  layout: LayoutType;
  onLayoutChange: (layout: LayoutType) => void;
}

export function ConnectionHeader({
  connectionStatus,
  activeStreams,
  debugInfo,
  onRefresh,
  onPlayAll,
  onStopAll,
  layout,
  onLayoutChange,
}: ConnectionHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="text-3xl font-bold mb-2">Collage Stream Viewer</h1>
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="px-3 py-1 bg-gray-100 rounded-lg">
          <span className="text-sm font-mono">Status: {connectionStatus}</span>
        </div>
        <div className="px-3 py-1 bg-blue-100 rounded-lg">
          <span className="text-sm font-mono">Active Streams: {activeStreams}</span>
        </div>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Refresh Streams
        </button>
        <button
          onClick={onPlayAll}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
        >
          Play All
        </button>
        <button
          onClick={onStopAll}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
        >
          Stop All
        </button>
        <select
          value={layout}
          onChange={(e) => onLayoutChange(e.target.value as LayoutType)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
        >
          <option value="main+side">Main + Side</option>
          <option value="grid">Grid</option>
          <option value="single">Single</option>
        </select>
      </div>

      {/* Debug Info */}
      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm font-mono text-yellow-800">Debug: {debugInfo}</p>
      </div>
    </div>
  );
} 