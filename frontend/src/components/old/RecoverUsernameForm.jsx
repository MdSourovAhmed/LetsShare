import { useState } from 'react';
import api from '../services/api';

const RecoverUsernameForm = () => {
  const [secondaryEmail, setSecondaryEmail] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/recover-username', { secondaryEmail });
      setSuccess('Username recovery email sent.');
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send recovery email');
      setSuccess(null);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4">Recover Username</h2>
      {error && <div className="text-red-500 mb-4">{error}</div>}
      {success && <div className="text-green-500 mb-4">{success}</div>}
      <div className="mb-4">
        <label className="block text-gray-700">Secondary Email</label>
        <input
          type="email"
          value={secondaryEmail}
          onChange={(e) => setSecondaryEmail(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />
      </div>
      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
        Recover Username
      </button>
    </form>
  );
};

export default RecoverUsernameForm;