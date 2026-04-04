import { Link } from 'react-router-dom';

const EventCard = ({ event }) => {
  return (
    <div className="bg-white shadow-md rounded-lg p-6 m-4 hover:shadow-lg transition">
      <h3 className="text-xl font-semibold">{event.title}</h3>
      <p className="text-gray-600">{new Date(event.date).toLocaleDateString()}</p>
      <p className="text-gray-600">{event.location}</p>
      <p className="text-gray-500">{event.description}</p>
      <Link to={`/events/${event._id}`} className="mt-4 inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
        View Details
      </Link>
    </div>
  );
};

export default EventCard;