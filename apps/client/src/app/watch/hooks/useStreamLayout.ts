import { useState, useEffect } from "react";

import { HlsStream, LayoutType } from "../../shared/types";

export function useStreamLayout(streams: HlsStream[]) {
  const [layout, setLayout] = useState<LayoutType>("main+side");
  const [mainStream, setMainStream] = useState<string | null>(null);
  const [sideStreams, setSideStreams] = useState<string[]>([]);

  // Auto-setup layout when streams change
  useEffect(() => {
    if (streams.length > 0) {
      const activeStreams = streams.filter((s) => s.isActive);
      if (activeStreams.length === 1) {
        setLayout("single");
        setMainStream(activeStreams[0].id);
      } else if (activeStreams.length === 2) {
        setLayout("main+side");
        setMainStream(activeStreams[0].id);
        setSideStreams([activeStreams[1].id]);
      } else if (activeStreams.length > 2) {
        setLayout("grid");
      }
    }
  }, [streams]);

  const addSideStream = (streamId: string) => {
    if (!sideStreams.includes(streamId) && streamId !== mainStream) {
      setSideStreams((prev) => [...prev, streamId]);
    }
  };

  const removeSideStream = (streamId: string) => {
    setSideStreams((prev) => prev.filter((id) => id !== streamId));
  };

  return {
    layout,
    mainStream,
    sideStreams,
    setLayout,
    setMainStream,
    addSideStream,
    removeSideStream,
  };
} 