"use client";
import { useHLSStreams } from "./hooks/useHLSStreams";
import { useStreamLayout } from "./hooks/useStreamLayout";
import { StreamCanvas } from "./components/StreamCanvas";
import { StreamControls } from "./components/StreamControls";
import { StreamList } from "./components/StreamList";
import { ConnectionHeader } from "./components/ConnectionHeader";
import { EmptyState } from "./components/EmptyState";

export default function WatchPage() {
  const {
    streams,
    connectionStatus,
    error,
    debugInfo,
    refreshStreams,
    playAllStreams,
    stopAllStreams,
  } = useHLSStreams();

  const {
    layout,
    mainStream,
    sideStreams,
    setLayout,
    setMainStream,
    addSideStream,
    removeSideStream,
  } = useStreamLayout(streams);

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <ConnectionHeader
        connectionStatus={connectionStatus}
        activeStreams={streams.filter((s) => s.isActive).length}
        debugInfo={debugInfo}
        onRefresh={refreshStreams}
        onPlayAll={playAllStreams}
        onStopAll={stopAllStreams}
        layout={layout}
        onLayoutChange={setLayout}
      />

      {streams.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          <StreamCanvas
            layout={layout}
            mainStream={mainStream}
            sideStreams={sideStreams}
            streams={streams}
          />

          <StreamControls
            streams={streams}
            mainStream={mainStream}
            sideStreams={sideStreams}
            layout={layout}
            onMainStreamChange={setMainStream}
            onSideStreamAdd={addSideStream}
            onSideStreamRemove={removeSideStream}
          />

          <StreamList
            streams={streams}
            mainStream={mainStream}
            sideStreams={sideStreams}
            onMainStreamSelect={setMainStream}
            onSideStreamAdd={addSideStream}
          />
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold mb-2">Collage Features:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>
            <strong>Main + Side:</strong> One main stream with smaller side
            streams (like picture-in-picture)
          </li>
          <li>
            <strong>Grid:</strong> All streams in equal-sized grid layout
          </li>
          <li>
            <strong>Single:</strong> Focus on one stream at a time
          </li>
          <li>
            <strong>Real-time Canvas:</strong> Multiple video streams combined
            into one canvas
          </li>
          <li>
            <strong>Dynamic Layout:</strong> Automatically adjusts based on
            available streams
          </li>
          <li>
            <strong>Stream Management:</strong> Easy selection of main and side
            streams
          </li>
        </ul>
      </div>
    </div>
  );
}
