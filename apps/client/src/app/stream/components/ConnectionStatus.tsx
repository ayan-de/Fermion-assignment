interface ConnectionStatusProps {
  status: string;
}

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const getStatusColor = (status: string) => {
    if (status.includes("Error")) return "bg-red-100 text-red-800";
    if (status === "Ready") return "bg-green-100 text-green-800";
    if (status.includes("Connected")) return "bg-blue-100 text-blue-800";
    return "bg-gray-100 text-gray-800";
  };

  return (
    <div className="mb-4 p-2 bg-gray-100 rounded-lg">
      <p className={`text-sm font-mono ${getStatusColor(status)}`}>
        Status: {status}
      </p>
    </div>
  );
}
