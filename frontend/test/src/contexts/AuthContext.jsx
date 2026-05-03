
// import { createContext, useState, useEffect } from 'react';
// import jwtDecode from 'jwt-decode';

// export const AuthContext = createContext();

// export const AuthProvider = ({ children }) => {
//   const [user, setUser] = useState(null);

//   useEffect(() => {
//     const token = localStorage.getItem('token');
//     if (token) {
//       try {
//         const decoded = jwtDecode(token);
//         if (decoded.exp * 1000 > Date.now()) {
//           setUser({ id: decoded.id, email: decoded.email });
//         } else {
//           localStorage.removeItem('token');
//         }
//       } catch (error) {
//         localStorage.removeItem('token');
//       }
//     }
//   }, []);

//   const login = (token) => {
//     localStorage.setItem('token', token);
//     const decoded = jwtDecode(token);
//     setUser({ id: decoded.id, email: decoded.email });
//   };

//   const logout = () => {
//     localStorage.removeItem('token');
//     setUser(null);
//   };

//   return (
//     <AuthContext.Provider value={{ user, login, logout }}>
//       {children}
//     </AuthContext.Provider>
//   );
// };




import { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode'; // Use named import

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token); // Use named jwtDecode
        if (decoded.exp * 1000 > Date.now()) {
          setUser({ id: decoded.id, email: decoded.email });
        } else {
          localStorage.removeItem('token');
        }
      } catch (error) {
        localStorage.removeItem('token');
      }
    }
  }, []);

  const login = (token) => {
    localStorage.setItem('token', token);
    const decoded = jwtDecode(token); // Use named jwtDecode
    setUser({ id: decoded.id, email: decoded.email });
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};