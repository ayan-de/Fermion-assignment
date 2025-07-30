import { HlsStream } from "../../shared/types";

interface StreamListProps {
  streams: HlsStream[];
  mainStream: string | null;
  sideStreams: string[];
  onMainStreamSelect: (streamId: string) => void;
  onSideStreamAdd: (streamId: string) => void;
}

export function StreamList({
  streams,
  mainStream,
  sideStreams,
  onMainStreamSelect,
  onSideStreamAdd,
}: StreamListProps) {
  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <h3 className="font-semibold mb-2">Available Streams</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {streams.map((stream) => (
          <div
            key={stream.id}
            className={`p-3 border rounded-lg ${
              mainStream === stream.id
                ? "border-blue-500 bg-blue-50"
                : sideStreams.includes(stream.id)
                ? "border-green-500 bg-green-50"
                : "border-gray-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">
                  {stream.name || `Stream ${stream.id.slice(0, 8)}`}
                </h4>
                <p className="text-xs text-gray-600">{stream.id}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      stream.isActive ? "bg-green-500" : "bg-gray-400"
                    }`}
                  />
                  <span className="text-xs">
                    {stream.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => onMainStreamSelect(stream.id)}
                  className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                >
                  Main
                </button>
                <button
                  onClick={() => onSideStreamAdd(stream.id)}
                  className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                >
                  Side
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
