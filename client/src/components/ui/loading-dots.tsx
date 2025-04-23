export default function LoadingDots() {
  return (
    <div className="flex space-x-1">
      <div className="w-2 h-2 bg-gray-400 dark:bg-gray-600 rounded-full animate-bounce"></div>
      <div className="w-2 h-2 bg-gray-400 dark:bg-gray-600 rounded-full animate-bounce delay-200"></div>
      <div className="w-2 h-2 bg-gray-400 dark:bg-gray-600 rounded-full animate-bounce delay-400"></div>
    </div>
  );
}
