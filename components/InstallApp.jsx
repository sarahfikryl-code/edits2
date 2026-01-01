import { useEffect, useRef } from 'react';
import Image from 'next/image';

export default function InstallApp({ isOpen, onClose }) {
  const modalRef = useRef(null);

  // Close modal when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Close on Escape key
  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.3s ease;
          padding: 20px;
        }
        .modal-content {
          position: relative;
          background: white;
          border-radius: 20px;
          padding: 30px;
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          animation: slideUp 0.3s ease;
          z-index: 10000;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }
        .modal-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 2px solid #e9ecef;
        }
        .modal-header h2 {
          margin: 0;
          font-size: 1.75rem;
          font-weight: 700;
          color: #1FA8DC;
        }
        .close-btn {
          position: absolute;
          top: 20px;
          right: 20px;
          background: #dc3545;
          border: none;
          font-size: 20px;
          color: white;
          cursor: pointer;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s ease;
          padding: 0;
          line-height: 1;
          box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
        }
        .close-btn:hover {
          background: #c82333;
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4);
        }
        .close-btn:active {
          transform: scale(0.95);
        }
        .instructions-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .instruction-item {
          padding: 16px;
          margin-bottom: 12px;
          background: #f8f9fa;
          border-radius: 12px;
          border-left: 4px solid #1FA8DC;
          transition: all 0.2s ease;
        }
        .instruction-item:hover {
          background: #e9ecef;
          transform: translateX(4px);
        }
        .instruction-item strong {
          display: block;
          font-size: 1.1rem;
          color: #1FA8DC;
          margin-bottom: 8px;
          font-weight: 700;
        }
        .instruction-item p {
          margin: 0;
          color: #495057;
          font-size: 0.95rem;
          line-height: 1.6;
        }
        .icon-install {
          margin: 0 4px;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(30px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (max-width: 768px) {
          .modal-overlay {
            padding: 10px;
          }
          .modal-content {
            padding: 20px;
            border-radius: 16px;
          }
          .modal-header {
            align-items: flex-start;
            gap: 12px;
          }
          .modal-header h2 {
            font-size: 1.5rem;
          }
          .close-btn {
            top: 15px;
            right: 15px;
            width: 32px;
            height: 32px;
            font-size: 18px;
          }
          .instruction-item {
            padding: 12px;
          }
          .instruction-item strong {
            font-size: 1rem;
          }
          .instruction-item p {
            font-size: 0.9rem;
          }
        }
        @media (max-width: 480px) {
          .modal-content {
            padding: 16px;
            max-height: 85vh;
          }
          .modal-header h2 {
            font-size: 1.3rem;
          }
          .instruction-item {
            padding: 10px;
            margin-bottom: 10px;
          }
          .instruction-item strong {
            font-size: 0.95rem;
          }
          .instruction-item p {
            font-size: 0.85rem;
            line-height: 1.5;
          }
        }
      `}</style>
      <div className="modal-overlay">
        <div className="modal-content" ref={modalRef}>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
          <div className="modal-header">
            <Image 
              src="/install.svg" 
              alt="Install App" 
              width={35} 
              height={35}
              style={{ flexShrink: 0 }}
            />
            <h2>How to Download the App</h2>
          </div>
          <ul className="instructions-list">
            <li className="instruction-item">
              <strong>📱 Android</strong>
              <p>Open in Chrome →<span className="icon-install">⋮</span>Menu → Add to Home Screen</p>
            </li>
            <li className="instruction-item">
              <strong>🍏 iOS (iPhone / iPad)</strong>
              <p>Open in Safari →<span className="icon-install">⬆</span>Share → Add to Home Screen</p>
            </li>
            <li className="instruction-item">
              <strong>🖥 Windows</strong>
              <p>Open in Chrome / Edge → Install<span className="icon-install">⬇</span>icon in address bar → Install</p>
            </li>
            <li className="instruction-item">
              <strong>🍎 macOS</strong>
              <p>Open in Chrome / Edge → Install<span className="icon-install">⬇</span>icon in address bar → Install</p>
            </li>
            <li className="instruction-item">
              <strong>🐧 Linux</strong>
              <p>Open in Chrome / Edge → Install<span className="icon-install">⬇</span>icon in address bar → Install</p>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}

