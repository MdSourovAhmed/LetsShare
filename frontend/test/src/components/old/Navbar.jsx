import { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-blue-600 text-white p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-xl font-bold">Event Registration</Link>
        <div className="space-x-4">
          <Link to="/events" className="hover:text-gray-200">Events</Link>
          {user ? (
            <>
              <Link to="/my-registrations" className="hover:text-gray-200">My Registrations</Link>
              <button onClick={handleLogout} className="hover:text-gray-200">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:text-gray-200">Login</Link>
              <Link to="/signup" className="hover:text-gray-200">Signup</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;