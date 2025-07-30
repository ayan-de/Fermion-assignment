export function EmptyState() {
  return (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">📺</div>
      <h2 className="text-2xl font-semibold mb-2">No Streams Available</h2>
      <p className="text-gray-600 mb-4">
        Start streaming from another browser to see live streams here
      </p>
      <div className="bg-blue-50 p-4 rounded-lg max-w-md mx-auto">
        <h3 className="font-semibold mb-2">How to test:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
          <li>
            Open{" "}
            <code className="bg-gray-200 px-1 rounded">
              http://localhost:3000/stream
            </code>{" "}
            in another browser
          </li>
          <li>Allow camera and microphone access</li>
          <li>Come back here and click "Refresh Streams"</li>
        </ol>
      </div>
    </div>
  );
}
