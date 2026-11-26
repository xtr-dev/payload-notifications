export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <div style={{ backgroundColor: '#fafafa', minHeight: '100vh' }}>
          <nav style={{
            backgroundColor: 'white',
            borderBottom: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            padding: '1rem 2rem'
          }}>
            <div style={{
              alignItems: 'center',
              display: 'flex',
              justifyContent: 'space-between',
              margin: '0 auto',
              maxWidth: '1200px'
            }}>
              <div style={{ alignItems: 'center', display: 'flex', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🔔</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                  Payload Notifications
                </span>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <a 
                  href="/" 
                  style={{ 
                    borderRadius: '4px', 
                    color: '#007FFF',
                    padding: '0.5rem 1rem',
                    textDecoration: 'none'
                  }}
                >
                  Home
                </a>
                <a 
                  href="/demo" 
                  style={{ 
                    borderRadius: '4px', 
                    color: '#007FFF',
                    padding: '0.5rem 1rem',
                    textDecoration: 'none'
                  }}
                >
                  Push Demo
                </a>
                <a 
                  href="/admin" 
                  style={{ 
                    border: '1px solid #007FFF', 
                    borderRadius: '4px',
                    color: '#007FFF',
                    padding: '0.5rem 1rem',
                    textDecoration: 'none'
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
            backgroundColor: 'white',
            borderTop: '1px solid #e5e7eb',
            color: '#6b7280',
            marginTop: '4rem',
            padding: '2rem',
            textAlign: 'center'
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