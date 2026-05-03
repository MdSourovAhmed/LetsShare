import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { AuthContext } from '../contexts/AuthContext';
import RegistrationForm from './RegistrationForm';

const EventDetails = () => {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await api.get(`/events/${id}`);
        setEvent(response.data);
      } catch (err) {
        setError('Failed to fetch event details');
      }
    };
    fetchEvent();
  }, [id]);

  if (error) return <div className="text-red-500 text-center">{error}</div>;
  if (!event) return <div className="text-center">Loading...</div>;

  return (
    <div className="container mx-auto p-4">
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">{event.title}</h2>
        <p className="text-gray-600 mb-2">Date: {new Date(event.date).toLocaleDateString()}</p>
        <p className="text-gray-600 mb-2">Location: {event.location}</p>
        <p className="text-gray-600 mb-4">{event.description}</p>
        <p className="text-gray-600 mb-4">Available Seats: {event.capacity - event.registeredUsers.length}</p>
        {user ? (
          <RegistrationForm eventId={event._id} />
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Login to Register
          </button>
        )}
      </div>
    </div>
  );
};

export default EventDetails;