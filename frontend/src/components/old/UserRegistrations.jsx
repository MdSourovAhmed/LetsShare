import { useState, useEffect } from 'react';
import api from '../services/api';

const UserRegistrations = () => {
  const [registrations, setRegistrations] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRegistrations = async () => {
      try {
        const response = await api.get('/registrations/my');
        setRegistrations(response.data);
      } catch (err) {
        setError('Failed to fetch registrations');
      }
    };
    fetchRegistrations();
  }, []);

  const handleCancel = async (registrationId) => {
    try {
      await api.delete(`/registrations/${registrationId}`);
      setRegistrations(registrations.filter((reg) => reg._id !== registrationId));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel registration');
    }
  };

  if (error) return <div className="text-red-500 text-center">{error}</div>;

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">My Registrations</h2>
      {registrations.length === 0 ? (
        <p className="text-gray-600">No registrations yet.</p>
      ) : (
        <div className="space-y-4">
          {registrations.map((reg) => (
            <div key={reg._id} className="bg-white shadow-md rounded-lg p-6">
              <h3 className="text-xl font-semibold">{reg.event.title}</h3>
              <p className="text-gray-600">Date: {new Date(reg.event.date).toLocaleDateString()}</p>
              <p className="text-gray-600">Status: {reg.status}</p>
              <p className="text-gray-600">
                Cancellation Deadline: {new Date(reg.cancellationDeadline).toLocaleDateString()}
              </p>
              {reg.qrCode && <img src={reg.qrCode} alt="QR Code" className="w-32 h-32 mt-2" />}
              {reg.status === 'registered' && new Date() <= new Date(reg.cancellationDeadline) ? (
                <button
                  onClick={() => handleCancel(reg._id)}
                  className="mt-2 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                >
                  Cancel Registration
                </button>
              ) : (
                <p className="text-red-500 mt-2">
                  {reg.status === 'cancelled' ? 'Cancelled' : 'Cancellation period has expired'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserRegistrations;