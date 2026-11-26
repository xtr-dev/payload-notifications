import Link from 'next/link'

export default function HomePage() {
  return (
    <div style={{ margin: '0 auto', maxWidth: '800px', padding: '2rem' }}>
      <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
          🔔 Payload Notifications Plugin
        </h1>
        <p style={{ color: '#666', fontSize: '1.2rem' }}>
          A comprehensive demo of the @xtr-dev/payload-notifications plugin
        </p>
      </div>

      <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <div style={{ 
          backgroundColor: '#f8f9ff', 
          border: '2px solid #007FFF', 
          borderRadius: '12px',
          padding: '2rem'
        }}>
          <h2 style={{ color: '#007FFF', marginBottom: '1rem' }}>🛠️ Admin Panel</h2>
          <p style={{ marginBottom: '1.5rem' }}>
            Access the Payload admin panel to manage notifications, users, orders, and more.
          </p>
          <Link 
            href="/admin" 
            style={{
              backgroundColor: '#007FFF',
              borderRadius: '6px',
              color: 'white',
              display: 'inline-block',
              fontWeight: '500',
              padding: '0.75rem 1.5rem',
              textDecoration: 'none'
            }}
          >
            Open Admin Panel
          </Link>
          <div style={{ color: '#666', fontSize: '0.9rem', marginTop: '1rem' }}>
            <strong>Login:</strong> dev@payloadcms.com / test
          </div>
        </div>

        <div style={{ 
          backgroundColor: '#f8fff8', 
          border: '2px solid #28a745', 
          borderRadius: '12px',
          padding: '2rem'
        }}>
          <h2 style={{ color: '#28a745', marginBottom: '1rem' }}>📱 Push Notifications Demo</h2>
          <p style={{ marginBottom: '1.5rem' }}>
            Test the web push notification features and see how they work in a real application.
          </p>
          <Link 
            href="/demo" 
            style={{
              backgroundColor: '#28a745',
              borderRadius: '6px',
              color: 'white',
              display: 'inline-block',
              fontWeight: '500',
              padding: '0.75rem 1.5rem',
              textDecoration: 'none'
            }}
          >
            View Demo
          </Link>
        </div>
      </div>

      <div style={{ backgroundColor: '#f8f9fa', borderRadius: '12px', marginTop: '3rem', padding: '2rem' }}>
        <h2 style={{ marginBottom: '1.5rem' }}>🚀 What&apos;s Included</h2>
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          <div>
            <h3 style={{ color: '#007FFF', marginBottom: '0.5rem' }}>📧 Notifications Collection</h3>
            <p style={{ color: '#666', fontSize: '0.9rem' }}>
              Rich text notifications with read/unread tracking and recipient targeting
            </p>
          </div>
          <div>
            <h3 style={{ color: '#007FFF', marginBottom: '0.5rem' }}>🔗 Relationship Attachments</h3>
            <p style={{ color: '#666', fontSize: '0.9rem' }}>
              Link notifications to orders, products, posts, or any collection
            </p>
          </div>
          <div>
            <h3 style={{ color: '#007FFF', marginBottom: '0.5rem' }}>🔔 Web Push Support</h3>
            <p style={{ color: '#666', fontSize: '0.9rem' }}>
              VAPID-secured push notifications for mobile and desktop browsers
            </p>
          </div>
          <div>
            <h3 style={{ color: '#007FFF', marginBottom: '0.5rem' }}>⚙️ Configurable Access</h3>
            <p style={{ color: '#666', fontSize: '0.9rem' }}>
              Flexible access control with role-based permissions
            </p>
          </div>
        </div>
      </div>

      <div style={{ border: '1px solid #dee2e6', borderRadius: '8px', marginTop: '2rem', padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>📋 Sample Data</h3>
        <p style={{ marginBottom: '1rem' }}>This demo environment includes:</p>
        <ul style={{ color: '#666', marginLeft: '1.5rem' }}>
          <li>Admin user (dev@payloadcms.com) and customer user</li>
          <li>Sample products (headphones, t-shirt, JavaScript guide)</li>
          <li>Sample orders with different statuses</li>
          <li>Sample notifications with relationship attachments</li>
          <li>Push subscription management</li>
        </ul>
      </div>

      <div style={{ color: '#666', marginTop: '2rem', textAlign: 'center' }}>
        <p>
          📖 <a href="https://github.com/xtr-dev/payload-notifications" style={{ color: '#007FFF' }}>
            View Documentation
          </a> | 
          🐙 <a href="https://github.com/xtr-dev/payload-notifications" style={{ color: '#007FFF' }}>
            GitHub Repository
          </a>
        </p>
      </div>
    </div>
  )
}