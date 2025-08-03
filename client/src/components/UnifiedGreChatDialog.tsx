/** DISABLED: Migrated to Pusher chat. Remove or comment out all logic, render null. */

interface UnifiedGreChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatSystemDisabled({ isOpen, onClose }: UnifiedGreChatDialogProps) {
  if (!isOpen) return null;
  
  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: '#1a1a1a',
      color: 'grey',
      padding: '3rem',
      borderRadius: '8px',
      textAlign: 'center',
      zIndex: 1000
    }}>
      <div>❌ This chat is currently disabled. Real-time chat now uses Pusher Channels integration.</div>
      <button 
        onClick={onClose}
        style={{
          marginTop: '1rem',
          padding: '0.5rem 1rem',
          background: '#333',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Close
      </button>
    </div>
  );
}

/*
// LEGACY CODE - DISABLED
// Original UnifiedGreChatDialog functionality has been migrated
// to Pusher Channels integration for better real-time performance
*/