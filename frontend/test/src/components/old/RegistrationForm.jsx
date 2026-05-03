import { useState, useContext } from 'react';
import api from '../services/api';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const RegistrationForm = ({ eventId }) => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/registrations', { eventId });
      setSuccess('Registration successful! Check your email for confirmation.');
      setTimeout(() => navigate('/my-registrations'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      {error && <div className="text-red-500 mb-4">{error}</div>}
      {success && <div className="text-green-500 mb-4">{success}</div>}
      <button
        type="submit"
        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
      >
        Register for Event
      </button>
    </form>
  );
};

export default RegistrationForm;