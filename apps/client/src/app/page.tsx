import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-10">
      <h1 className="text-5xl font-bold text-center bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
        Fermion Assignment
      </h1>
      <div className="flex gap-6">
        <Link href="/stream">
          <button className="px-6 py-3 bg-blue-600 text-white text-lg font-semibold rounded-lg shadow-md hover:bg-blue-700 transition">
            Stream
          </button>
        </Link>

        <Link href="/watch">
          <button className="px-6 py-3 bg-green-600 text-white text-lg font-semibold rounded-lg shadow-md hover:bg-green-700 transition">
            Watch
          </button>
        </Link>
      </div>
    </div>
  );
}
