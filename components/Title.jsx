import { useRouter } from 'next/router';
import BackToDashboard from './BackToDashboard';

export default function Title({ children, style = {}, className = '', backText = 'Back to Dashboard', href }) {
  const router = useRouter();
  
  // Auto-detect student dashboard pages and use appropriate href
  // If href is explicitly null, use undefined to trigger router.back() in BackToDashboard
  // If href is undefined, use default detection
  const defaultHref = href === null ? undefined : (href || (router.pathname.startsWith('/student_dashboard') ? '/student_dashboard' : '/dashboard'));
  
  return (
    <div
      className={`title-bar ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        background: 'transparent',
        ...style
      }}
    >
      <h1 className="title-text" style={{ margin: 0, fontWeight: 700, fontSize: '2rem', color: '#fff' }}>
        {children}
      </h1>
      <BackToDashboard style={{ marginLeft: 'var(--button-margin-left, 16px)', fontSize: 15, padding: '8px 16px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', width: 'var(--button-width, auto)' }} text={backText} href={defaultHref} />
      <style jsx>{`
        @media (max-width: 768px) {
          .title-text {
            font-size: 1.8rem !important;
          }
        }
        @media (max-width: 480px) {
          .title-text {
            font-size: 1.5rem !important;
          }
        }
      `}</style>
    </div>
  );
} 