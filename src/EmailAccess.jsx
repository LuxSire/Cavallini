import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from './BrandLogo';

const EmailAccess = () => {
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/emails.csv');
      if (!res.ok) throw new Error('Could not load emails list');
      const text = await res.text();
      // Split by line, trim, and check for the email
      const emails = text.split(/\r?\n/).map(line => line.trim().toLowerCase()).filter(Boolean);
      if (emails.includes(email.trim().toLowerCase())) {
        navigate('/cavallini');
      } else {
        alert('This email is not authorized. Please request approval');
      }
    } catch (err) {
      alert('Error checking email access: ' + err.message);
    }
  };


  class ApprovalEmail {
    static recipient = 'info@luxsire.com';
    static subject = 'Access Request';
  static body = 'Dear LuxSire,\n\nI am interested in your products and would like to request access to your website.';

    static getMailtoLink() {
      const subject = encodeURIComponent(ApprovalEmail.subject);
      const body = encodeURIComponent(ApprovalEmail.body);
      return `mailto:${ApprovalEmail.recipient}?subject=${subject}&body=${body}`;
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '2rem auto', padding: 24, border: '1px solid #ccc', borderRadius: 8 }}>
      <div className="brand-container" style={{ marginBottom: 24 }}>
        <BrandLogo />
      </div>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email" style={{ display: 'block', marginBottom: 8 }}>Email:</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', padding: 8, marginBottom: 16 }}
          required
        />
        <div style={{ display: 'flex', gap: 16 }}>
          <a
            href={ApprovalEmail.getMailtoLink()}
            style={{ color: '#1976d2', textDecoration: 'underline', cursor: 'pointer' }}
          >
            Ask to Get Approved
          </a>

          <a
            href="#"
            onClick={handleSubmit}
            style={{ color: '#1976d2', textDecoration: 'underline', cursor: 'pointer' }}
          >
            Submit
          </a>
        </div>
      </form>
    </div>
  );
};

export default EmailAccess;
