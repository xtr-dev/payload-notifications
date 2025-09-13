export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', backgroundColor: '#fafafa' }}>
          <nav style={{
            backgroundColor: 'white',
            borderBottom: '1px solid #e5e7eb',
            padding: '1rem 2rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              maxWidth: '1200px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🔔</span>
                <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                  Payload Notifications
                </span>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <a 
                  href="/" 
                  style={{ 
                    color: '#007FFF', 
                    textDecoration: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px'
                  }}
                >
                  Home
                </a>
                <a 
                  href="/demo" 
                  style={{ 
                    color: '#007FFF', 
                    textDecoration: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px'
                  }}
                >
                  Push Demo
                </a>
                <a 
                  href="/admin" 
                  style={{ 
                    color: '#007FFF', 
                    textDecoration: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    border: '1px solid #007FFF'
                  }}
                >
                  Admin Panel
                </a>
              </div>
            </div>
          </nav>
          <main>
            {children}
          </main>
          <footer style={{
            marginTop: '4rem',
            padding: '2rem',
            textAlign: 'center',
            borderTop: '1px solid #e5e7eb',
            backgroundColor: 'white',
            color: '#6b7280'
          }}>
            <p>
              🔔 Payload Notifications Plugin Demo | 
              <a 
                href="https://github.com/xtr-dev/payload-notifications" 
                style={{ color: '#007FFF', marginLeft: '0.5rem' }}
              >
                Documentation
              </a>
            </p>
          </footer>
        </div>
      </body>
    </html>
  )
}