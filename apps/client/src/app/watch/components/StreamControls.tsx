import { HlsStream, LayoutType } from "../../shared/types";

interface StreamControlsProps {
  streams: HlsStream[];
  mainStream: string | null;
  sideStreams: string[];
  layout: LayoutType;
  onMainStreamChange: (streamId: string) => void;
  onSideStreamAdd: (streamId: string) => void;
  onSideStreamRemove: (streamId: string) => void;
}

export function StreamControls({
  streams,
  mainStream,
  sideStreams,
  layout,
  onMainStreamChange,
  onSideStreamAdd,
  onSideStreamRemove,
}: StreamControlsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Main Stream Selection */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Main Stream</h3>
        <select
          value={mainStream || ""}
          onChange={(e) => onMainStreamChange(e.target.value)}
          className="w-full p-2 border rounded"
        >
          <option value="">Select main stream</option>
          {streams
            .filter((s) => s.isActive)
            .map((stream) => (
              <option key={stream.id} value={stream.id}>
                {stream.name || `Stream ${stream.id.slice(0, 8)}`}
              </option>
            ))}
        </select>
      </div>

      {/* Side Streams */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Side Streams</h3>
        <div className="space-y-2">
          {streams
            .filter((s) => s.isActive && s.id !== mainStream)
            .map((stream) => (
              <div key={stream.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sideStreams.includes(stream.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onSideStreamAdd(stream.id);
                    } else {
                      onSideStreamRemove(stream.id);
                    }
                  }}
                />
                <span className="text-sm">
                  {stream.name || `Stream ${stream.id.slice(0, 8)}`}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Layout Info */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Layout Info</h3>
        <div className="text-sm space-y-1">
          <p>
            <strong>Current:</strong> {layout}
          </p>
          <p>
            <strong>Main:</strong> {mainStream ? "Set" : "None"}
          </p>
          <p>
            <strong>Side:</strong> {sideStreams.length} streams
          </p>
          <p>
            <strong>Total:</strong> {streams.filter((s) => s.isActive).length}{" "}
            active
          </p>
        </div>
      </div>
    </div>
  );
}
