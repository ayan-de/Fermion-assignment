export interface HlsStream {
  id: string;
  url: string;
  name: string;
  isActive: boolean;
}

export type LayoutType = "main+side" | "grid" | "single"; 