import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="container mx-auto p-4 text-center">
      <h1 className="text-4xl font-bold mb-4">Welcome to Event Registration System</h1>
      <p className="text-gray-600 mb-6">Discover and register for exciting events near you!</p>
      <Link to="/events" className="bg-blue-500 text-white px-6 py-3 rounded hover:bg-blue-600">
        Browse Events
      </Link>
    </div>
  );
};

export default Home;