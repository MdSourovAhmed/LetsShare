import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import UserRegistrations from '../components/UserRegistrations';
import { AuthContext } from '../contexts/AuthContext';

const MyRegistrations = () => {
  const { user } = useContext(AuthContext);

  if (!user) return <Navigate to="/login" />;

  return (
    <div className="container mx-auto p-4">
      <UserRegistrations />
    </div>
  );
};

export default MyRegistrations;