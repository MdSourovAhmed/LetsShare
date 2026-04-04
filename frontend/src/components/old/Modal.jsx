function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md max-w-md w-full">
        <button
          onClick={onClose}
          className="text-gray-600 dark:text-gray-300 hover:text-red-500 float-right"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

export default Modal;