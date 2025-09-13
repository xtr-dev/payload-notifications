import Link from 'next/link'

export default function HomePage() {
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
          🔔 Payload Notifications Plugin
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#666' }}>
          A comprehensive demo of the @xtr-dev/payload-notifications plugin
        </p>
      </div>

      <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <div style={{ 
          padding: '2rem', 
          border: '2px solid #007FFF', 
          borderRadius: '12px',
          backgroundColor: '#f8f9ff'
        }}>
          <h2 style={{ marginBottom: '1rem', color: '#007FFF' }}>🛠️ Admin Panel</h2>
          <p style={{ marginBottom: '1.5rem' }}>
            Access the Payload admin panel to manage notifications, users, orders, and more.
          </p>
          <Link 
            href="/admin" 
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#007FFF',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontWeight: '500'
            }}
          >
            Open Admin Panel
          </Link>
          <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
            <strong>Login:</strong> dev@payloadcms.com / test
          </div>
        </div>

        <div style={{ 
          padding: '2rem', 
          border: '2px solid #28a745', 
          borderRadius: '12px',
          backgroundColor: '#f8fff8'
        }}>
          <h2 style={{ marginBottom: '1rem', color: '#28a745' }}>📱 Push Notifications Demo</h2>
          <p style={{ marginBottom: '1.5rem' }}>
            Test the web push notification features and see how they work in a real application.
          </p>
          <Link 
            href="/demo" 
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#28a745',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontWeight: '500'
            }}
          >
            View Demo
          </Link>
        </div>
      </div>

      <div style={{ marginTop: '3rem', padding: '2rem', backgroundColor: '#f8f9fa', borderRadius: '12px' }}>
        <h2 style={{ marginBottom: '1.5rem' }}>🚀 What&apos;s Included</h2>
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          <div>
            <h3 style={{ color: '#007FFF', marginBottom: '0.5rem' }}>📧 Notifications Collection</h3>
            <p style={{ fontSize: '0.9rem', color: '#666' }}>
              Rich text notifications with read/unread tracking and recipient targeting
            </p>
          </div>
          <div>
            <h3 style={{ color: '#007FFF', marginBottom: '0.5rem' }}>🔗 Relationship Attachments</h3>
            <p style={{ fontSize: '0.9rem', color: '#666' }}>
              Link notifications to orders, products, posts, or any collection
            </p>
          </div>
          <div>
            <h3 style={{ color: '#007FFF', marginBottom: '0.5rem' }}>🔔 Web Push Support</h3>
            <p style={{ fontSize: '0.9rem', color: '#666' }}>
              VAPID-secured push notifications for mobile and desktop browsers
            </p>
          </div>
          <div>
            <h3 style={{ color: '#007FFF', marginBottom: '0.5rem' }}>⚙️ Configurable Access</h3>
            <p style={{ fontSize: '0.9rem', color: '#666' }}>
              Flexible access control with role-based permissions
            </p>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #dee2e6', borderRadius: '8px' }}>
        <h3 style={{ marginBottom: '1rem' }}>📋 Sample Data</h3>
        <p style={{ marginBottom: '1rem' }}>This demo environment includes:</p>
        <ul style={{ marginLeft: '1.5rem', color: '#666' }}>
          <li>Admin user (dev@payloadcms.com) and customer user</li>
          <li>Sample products (headphones, t-shirt, JavaScript guide)</li>
          <li>Sample orders with different statuses</li>
          <li>Sample notifications with relationship attachments</li>
          <li>Push subscription management</li>
        </ul>
      </div>

      <div style={{ marginTop: '2rem', textAlign: 'center', color: '#666' }}>
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