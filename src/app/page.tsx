import FolderBrowser from "@/components/FolderBrowser";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center p-8">
      <main className="w-full flex flex-col gap-4 items-center sm:items-start">
        <h1 className="text-3xl font-bold mb-4">Church Video Archive</h1>
        <FolderBrowser />
      </main>
    </div>
  );
}
